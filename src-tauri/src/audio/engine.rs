use anyhow::{anyhow, Result};
use crossbeam::channel::{bounded, Receiver, Sender};
use parking_lot::Mutex;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::thread::{self, JoinHandle};
use windows::Win32::Media::Audio::{
    eCapture, eMultimedia, eRender, IAudioCaptureClient, IAudioClient, IAudioRenderClient,
    IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED,
    WAVEFORMATEX, WAVEFORMATEXTENSIBLE,
};
use windows::core::Interface;
use windows::Win32::System::Com::{
    CLSCTX_ALL, CoCreateInstance, CoInitializeEx, COINIT_MULTITHREADED, CoTaskMemFree,
};
use windows::core::PCWSTR;

use crate::audio::decoder::decode_file;
use crate::audio::mixer::MixerState;
use crate::db;
use rusqlite::Connection;
use std::collections::HashMap;

const SAMPLE_RATE: u32 = 48000;
const CHANNELS: u16 = 2;
const BUFFER_MS: u32 = 10;
const WAVE_FORMAT_PCM: u16 = 0x0001;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 0x0003;
const WAVE_FORMAT_EXTENSIBLE: u16 = 0xFFFE;

// KSDATAFORMAT_SUBTYPE_IEEE_FLOAT
const SUBTYPE_IEEE_FLOAT: windows::core::GUID = windows::core::GUID::from_values(
    0x00000003, 0x0000, 0x0010, [0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71]
);

#[link(name = "winmm")]
extern "system" {
    fn timeBeginPeriod(period: u32) -> u32;
    fn timeEndPeriod(period: u32) -> u32;
}

#[derive(Debug, Clone)]
pub enum EngineCommand {
    Play(PlayRequest),
    StopAll,
    SetVolumes(f64, f64, f64),
    SetMonitorVolume(f64),
    SetSoundboardLiveEnabled(bool),
    Restart(Option<String>, Option<String>),
    Shutdown,
}

#[derive(Debug, Clone)]
pub struct PlayRequest {
    pub sound_id: String,
    pub board_id: Option<String>,
}

struct AudioStream {
    client: IAudioClient,
    capture: Option<IAudioCaptureClient>,
    render: Option<IAudioRenderClient>,
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    format_tag: u16,
    sub_format: windows::core::GUID,
    native_format: *mut WAVEFORMATEX,
}

unsafe impl Send for AudioStream {}
unsafe impl Sync for AudioStream {}

fn is_float_format(tag: u16, sub_format: &windows::core::GUID) -> bool {
    tag == WAVE_FORMAT_IEEE_FLOAT || (tag == WAVE_FORMAT_EXTENSIBLE && *sub_format == SUBTYPE_IEEE_FLOAT)
}

fn build_preferred_format(sample_rate: u32, channels: u16) -> WAVEFORMATEXTENSIBLE {
    let block_align = channels * 4;
    unsafe {
        let mut ext: WAVEFORMATEXTENSIBLE = std::mem::zeroed();
        ext.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
        ext.Format.nChannels = channels;
        ext.Format.nSamplesPerSec = sample_rate;
        ext.Format.nAvgBytesPerSec = sample_rate * block_align as u32;
        ext.Format.nBlockAlign = block_align;
        ext.Format.wBitsPerSample = 32;
        ext.Format.cbSize = 22;
        ext.Samples.wValidBitsPerSample = 32;
        ext.dwChannelMask = if channels == 2 { 3 } else { 4 };
        ext.SubFormat = SUBTYPE_IEEE_FLOAT;
        ext
    }
}

fn get_device_by_id(id: &str) -> Result<IMMDevice> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();
        let device = enumerator.GetDevice(PCWSTR::from_raw(wide.as_ptr()))?;
        Ok(device)
    }
}

fn get_default_device(data_flow: windows::Win32::Media::Audio::EDataFlow) -> Result<IMMDevice> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(data_flow, eMultimedia)?;
        Ok(device)
    }
}

/// Convert a raw WASAPI buffer to f32 interleaved.
unsafe fn buffer_to_f32(src: *const u8, frame_count: usize, channels: u16, bits: u16, tag: u16, sub_format: &windows::core::GUID) -> Vec<f32> {
    let sample_count = frame_count * channels as usize;
    let mut out = vec![0.0f32; sample_count];
    if src.is_null() || sample_count == 0 { return out; }

    let bytes_per_sample = (bits as usize / 8).max(1);
    let src_slice = std::slice::from_raw_parts(src, frame_count * channels as usize * bytes_per_sample);
    let float_mode = is_float_format(tag, sub_format);

    if float_mode && bits == 32 {
        out.copy_from_slice(std::slice::from_raw_parts(src as *const f32, sample_count));
        return out;
    }

    match (tag, bits) {
        (WAVE_FORMAT_PCM, 16) => {
            for i in 0..sample_count {
                let offset = i * 2;
                let sample = i16::from_ne_bytes([src_slice[offset], src_slice[offset + 1]]) as f32 / 32768.0;
                out[i] = sample;
            }
        }
        (WAVE_FORMAT_PCM, 24) => {
            for i in 0..sample_count {
                let offset = i * 3;
                let b0 = src_slice[offset] as i32;
                let b1 = src_slice[offset + 1] as i32;
                let b2 = src_slice[offset + 2] as i32;
                let sample = if b2 & 0x80 != 0 {
                    ((b0) | (b1 << 8) | (b2 << 16) | (0xFF << 24)) as f32 / 8388608.0
                } else {
                    ((b0) | (b1 << 8) | (b2 << 16)) as f32 / 8388608.0
                };
                out[i] = sample;
            }
        }
        (WAVE_FORMAT_PCM, 32) | (WAVE_FORMAT_EXTENSIBLE, 32) => {
            for i in 0..sample_count {
                let offset = i * 4;
                let sample = i32::from_ne_bytes([src_slice[offset], src_slice[offset+1], src_slice[offset+2], src_slice[offset+3]]) as f32 / 2147483648.0;
                out[i] = sample;
            }
        }
        _ => {
        }
    }
    out
}

/// Convert f32 interleaved to native WASAPI buffer format.
unsafe fn f32_to_buffer(src: &[f32], dst: *mut u8, frame_count: usize, channels: u16, bits: u16, tag: u16, sub_format: &windows::core::GUID) {
    if dst.is_null() { return; }
    let sample_count = frame_count * channels as usize;
    let bytes_per_sample = (bits as usize / 8).max(1);
    let dst_slice = std::slice::from_raw_parts_mut(dst, frame_count * channels as usize * bytes_per_sample);
    let float_mode = is_float_format(tag, sub_format);

    if float_mode && bits == 32 {
        let dst_f32 = std::slice::from_raw_parts_mut(dst as *mut f32, sample_count);
        dst_f32.copy_from_slice(&src[..sample_count]);
        return;
    }

    match (tag, bits) {
        (WAVE_FORMAT_PCM, 16) => {
            for i in 0..sample_count {
                let clamped = src[i].clamp(-1.0, 1.0);
                let sample = (clamped * 32767.0) as i16;
                let bytes = sample.to_ne_bytes();
                dst_slice[i * 2] = bytes[0];
                dst_slice[i * 2 + 1] = bytes[1];
            }
        }
        (WAVE_FORMAT_PCM, 24) => {
            for i in 0..sample_count {
                let clamped = src[i].clamp(-1.0, 1.0);
                let sample = (clamped * 8388607.0) as i32;
                let bytes = sample.to_ne_bytes();
                dst_slice[i * 3] = bytes[0];
                dst_slice[i * 3 + 1] = bytes[1];
                dst_slice[i * 3 + 2] = bytes[2];
            }
        }
        (WAVE_FORMAT_PCM, 32) | (WAVE_FORMAT_EXTENSIBLE, 32) => {
            for i in 0..sample_count {
                let clamped = src[i].clamp(-1.0, 1.0);
                let sample = (clamped * 2147483647.0) as i32;
                let bytes = sample.to_ne_bytes();
                dst_slice[i * 4] = bytes[0];
                dst_slice[i * 4 + 1] = bytes[1];
                dst_slice[i * 4 + 2] = bytes[2];
                dst_slice[i * 4 + 3] = bytes[3];
            }
        }
        _ => {
        }
    }
}

fn open_stream_with_start(device: &IMMDevice, render: bool, start_immediately: bool) -> Result<AudioStream> {
    unsafe {
        let endpoint = device.cast::<windows::Win32::Media::Audio::IMMEndpoint>()?;
        let flow = endpoint.GetDataFlow()?;
        let expected_flow = if render { eRender } else { eCapture };
        if flow != expected_flow {
            return Err(anyhow!(
                "Device data flow mismatch: expected {:?} but got {:?}",
                if render { "render" } else { "capture" },
                if flow == eRender { "render" } else { "capture" }
            ));
        }

        let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
        let preferred = build_preferred_format(SAMPLE_RATE, CHANNELS);
        let buffer_duration_hns = (BUFFER_MS as i64) * 10000i64 * 2i64;

        let init_result = client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            0,
            buffer_duration_hns,
            0,
            &preferred.Format,
            None,
        );

        let (native_format, sample_rate, channels, bits_per_sample, format_tag, sub_format) = match init_result {
            Ok(()) => {
                (std::ptr::null_mut(), SAMPLE_RATE, CHANNELS, 32, WAVE_FORMAT_EXTENSIBLE, SUBTYPE_IEEE_FLOAT)
            }
            Err(e) => {
                let code = e.code().0 as u32;
                if code == 0x88890008 {
                } else {
                }
                let mix_format = client.GetMixFormat()?;
                if mix_format.is_null() {
                    return Err(anyhow!("GetMixFormat returned null"));
                }
                let nSamplesPerSec = std::ptr::addr_of!((*mix_format).nSamplesPerSec).read_unaligned();
                let nChannels = std::ptr::addr_of!((*mix_format).nChannels).read_unaligned();
                let wBitsPerSample = std::ptr::addr_of!((*mix_format).wBitsPerSample).read_unaligned();
                let wFormatTag = std::ptr::addr_of!((*mix_format).wFormatTag).read_unaligned();

                let sub = if wFormatTag == WAVE_FORMAT_EXTENSIBLE && wBitsPerSample >= 22 {
                    let ext = mix_format as *mut WAVEFORMATEXTENSIBLE;
                    std::ptr::addr_of!((*ext).SubFormat).read_unaligned()
                } else {
                    if wFormatTag == WAVE_FORMAT_IEEE_FLOAT {
                        SUBTYPE_IEEE_FLOAT
                    } else {
                        windows::core::GUID::from_values(0x00000001, 0x0000, 0x0010, [0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71])
                    }
                };

                let _is_float = is_float_format(wFormatTag, &sub);

                client.Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    0,
                    buffer_duration_hns,
                    0,
                    mix_format,
                    None,
                )?;
                (mix_format, nSamplesPerSec, nChannels, wBitsPerSample, wFormatTag, sub)
            }
        };

        let capture_client = if !render {
            Some(client.GetService::<IAudioCaptureClient>()?)
        } else {
            None
        };
        let render_client = if render {
            Some(client.GetService::<IAudioRenderClient>()?)
        } else {
            None
        };

        if start_immediately {
            client.Start()?;
        }

        Ok(AudioStream {
            client,
            capture: capture_client,
            render: render_client,
            sample_rate,
            channels,
            bits_per_sample,
            format_tag,
            sub_format,
            native_format,
        })
    }
}

fn open_stream(device: &IMMDevice, render: bool) -> Result<AudioStream> {
    open_stream_with_start(device, render, true)
}

pub struct AudioEngineHandle {
    cmd_tx: Sender<EngineCommand>,
    handle: Option<JoinHandle<()>>,
    current_input: Arc<Mutex<Option<String>>>,
    current_output: Arc<Mutex<Option<String>>>,
}

impl AudioEngineHandle {
    pub fn new(db_path: std::path::PathBuf, input_id: Option<String>, output_id: Option<String>) -> Result<Self> {
        let (cmd_tx, cmd_rx) = bounded::<EngineCommand>(256);
        let current_input = Arc::new(Mutex::new(input_id.clone()));
        let current_output = Arc::new(Mutex::new(output_id.clone()));

        let handle = thread::spawn(move || {
            if let Err(_e) = audio_thread(db_path, input_id, output_id, cmd_rx) {
            }
        });

        Ok(Self {
            cmd_tx,
            handle: Some(handle),
            current_input,
            current_output,
        })
    }

    pub fn play(&self, req: PlayRequest) -> Result<()> {
        self.cmd_tx.send(EngineCommand::Play(req)).map_err(|_| anyhow!("Engine down"))
    }

    pub fn stop_all(&self) -> Result<()> {
        self.cmd_tx.send(EngineCommand::StopAll).map_err(|_| anyhow!("Engine down"))
    }

    pub fn set_volumes(&self, mic: f64, master: f64, sb: f64) -> Result<()> {
        self.cmd_tx.send(EngineCommand::SetVolumes(mic, master, sb)).map_err(|_| anyhow!("Engine down"))
    }

    pub fn set_monitor_volume(&self, volume: f64) -> Result<()> {
        self.cmd_tx.send(EngineCommand::SetMonitorVolume(volume)).map_err(|_| anyhow!("Engine down"))
    }

    pub fn set_soundboard_live_enabled(&self, enabled: bool) -> Result<()> {
        self.cmd_tx.send(EngineCommand::SetSoundboardLiveEnabled(enabled)).map_err(|_| anyhow!("Engine down"))
    }

    pub fn restart(&mut self, input: Option<String>, output: Option<String>) -> Result<()> {
        *self.current_input.lock() = input.clone();
        *self.current_output.lock() = output.clone();
        self.cmd_tx.send(EngineCommand::Restart(input, output)).map_err(|_| anyhow!("Engine down"))
    }
}

impl Drop for AudioEngineHandle {
    fn drop(&mut self) {
        let _ = self.cmd_tx.send(EngineCommand::Shutdown);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn close_stream(s: AudioStream) {
    unsafe {
        let _ = s.client.Stop();
        if !s.native_format.is_null() {
            CoTaskMemFree(Some(s.native_format as *const std::ffi::c_void));
        }
    }
}

#[derive(Debug)]
struct PlaybackVolumes {
    master: f32,
    soundboard: f32,
    monitor: f32,
}

fn playback_soft_clip(x: f32) -> f32 {
    if x > 1.0 {
        1.0 + 0.25 * (1.0 - (-4.0 * (x - 1.0)).exp())
    } else if x < -1.0 {
        -1.0 - 0.25 * (1.0 - (-4.0 * (-x - 1.0)).exp())
    } else {
        x
    }
}

struct PlaybackWorker {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl PlaybackWorker {
    fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

fn spawn_sound_playback(
    device_id: Option<String>,
    use_default_device: bool,
    samples: Vec<f32>,
    sample_rate: u32,
    channels: u16,
    base_gain: f32,
    repeat: bool,
    live_volumes: Arc<Mutex<PlaybackVolumes>>,
) -> PlaybackWorker {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();
    let handle = thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
            let _ = timeBeginPeriod(1);

            let device = if use_default_device {
                get_default_device(eRender)
            } else if let Some(id) = device_id.as_deref() {
                get_device_by_id(id)
            } else {
                get_default_device(eRender)
            };

            let Ok(device) = device else {
                let _ = timeEndPeriod(1);
                return;
            };

            let Ok(stream) = open_stream_with_start(&device, true, false) else {
                let _ = timeEndPeriod(1);
                return;
            };

            let playback_samples = if stream.sample_rate != sample_rate || stream.channels != channels {
                resample_buffer(&samples, sample_rate, channels, stream.sample_rate, stream.channels)
            } else {
                samples
            };

            let total_frames = playback_samples.len() / stream.channels.max(1) as usize;
            let frame_count = stream.client.GetBufferSize().unwrap_or(0).max(1);
            let sleep_ms = (((frame_count as u64) * 1000) / stream.sample_rate.max(1) as u64 / 2).max(1);
            let sleep_duration = std::time::Duration::from_millis(sleep_ms);
            let mut frame_cursor = 0usize;
            let mut draining = false;

            let write_chunk = |stream: &AudioStream, rc: &IAudioRenderClient, frame_cursor: &mut usize, frames_requested: u32| {
                let mut tmp = vec![0.0f32; frames_requested as usize * stream.channels as usize];
                let mut wrote_audio = false;
                let volumes = live_volumes.lock();
                let live_gain = if use_default_device {
                    (base_gain * volumes.monitor * volumes.master).clamp(0.0, 16.0)
                } else {
                    (base_gain * volumes.soundboard * volumes.master).clamp(0.0, 16.0)
                };

                for frame in 0..frames_requested as usize {
                    let source_frame = if total_frames == 0 {
                        None
                    } else if *frame_cursor < total_frames {
                        Some(*frame_cursor)
                    } else if repeat {
                        *frame_cursor = 0;
                        Some(*frame_cursor)
                    } else {
                        None
                    };

                    let Some(source_frame) = source_frame else { break; };
                    let src_start = source_frame * stream.channels as usize;
                    let dst_start = frame * stream.channels as usize;
                    for i in 0..stream.channels as usize {
                        tmp[dst_start + i] = playback_soft_clip(playback_samples[src_start + i] * live_gain).clamp(-1.0, 1.0);
                    }
                    *frame_cursor += 1;
                    wrote_audio = true;
                }

                drop(volumes);

                if let Ok(buffer) = rc.GetBuffer(frames_requested) {
                    if !buffer.is_null() {
                        f32_to_buffer(
                            &tmp,
                            buffer as *mut u8,
                            frames_requested as usize,
                            stream.channels,
                            stream.bits_per_sample,
                            stream.format_tag,
                            &stream.sub_format,
                        );
                        let _ = rc.ReleaseBuffer(frames_requested, 0);
                    }
                }

                wrote_audio
            };

            if let Some(ref rc) = stream.render {
                let _ = write_chunk(&stream, rc, &mut frame_cursor, frame_count);
            }
            let _ = stream.client.Start();

            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }

                let padding = stream.client.GetCurrentPadding().unwrap_or(0);
                let frames_available = frame_count.saturating_sub(padding);

                if draining {
                    if padding == 0 {
                        break;
                    }
                    std::thread::sleep(sleep_duration);
                    continue;
                }

                if frame_cursor >= total_frames && !repeat {
                    draining = true;
                    std::thread::sleep(sleep_duration);
                    continue;
                }

                if frames_available == 0 {
                    std::thread::sleep(sleep_duration);
                    continue;
                }

                let wrote_audio = if let Some(ref rc) = stream.render {
                    write_chunk(&stream, rc, &mut frame_cursor, frames_available)
                } else {
                    false
                };

                if !wrote_audio && !repeat {
                    draining = true;
                }

                std::thread::sleep(sleep_duration);
            }

            close_stream(stream);
            let _ = timeEndPeriod(1);
        }
    });

    PlaybackWorker { stop, handle: Some(handle) }
}

fn stop_playback_group(workers: Vec<PlaybackWorker>) {
    for worker in workers {
        worker.stop();
    }
}

fn audio_thread(db_path: std::path::PathBuf, input_id: Option<String>, output_id: Option<String>, rx: Receiver<EngineCommand>) -> Result<()> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
        let _ = timeBeginPeriod(1);
        let conn = Connection::open(&db_path)?;
        let settings = db::get_settings(&conn)?;
        let live_playback_volumes = Arc::new(Mutex::new(PlaybackVolumes {
            master: settings.master_volume as f32,
            soundboard: settings.soundboard_volume as f32,
            monitor: settings.monitor_volume as f32,
        }));
        let mut sound_cache: HashMap<String, (Vec<f32>, u32, u16)> = HashMap::new();
        let mut current_output_id = output_id.clone();
        let mut active_playbacks: HashMap<String, Vec<PlaybackWorker>> = HashMap::new();
        let mut mic_accumulator: Vec<f32> = vec![];

        let (mut cap_stream, mut ren_stream) = init_streams(&input_id, &output_id)?;

        let mut mon_stream = match get_default_device(eRender) {
            Ok(d) => match open_stream(&d, true) {
                Ok(s) => Some(s),
                Err(_) => None,
            },
            Err(_) => None,
        };

        let (mixer_sr, mixer_ch) = match &ren_stream {
            Some(s) => (s.sample_rate, s.channels),
            None => (SAMPLE_RATE, CHANNELS),
        };
        let mut mixer = MixerState::new(mixer_sr, mixer_ch);
        mixer.set_volumes(
            settings.mic_volume as f32,
            settings.master_volume as f32,
            settings.soundboard_volume as f32,
        );
        mixer.set_soundboard_live_enabled(settings.soundboard_live_enabled);

        loop {
            match rx.try_recv() {
                Ok(EngineCommand::Shutdown) => break,
                Ok(EngineCommand::Play(req)) => {
                    if let Ok(Some(sound)) = db::get_sound_by_id(&conn, &req.sound_id) {
                        let cached = sound_cache.get(&req.sound_id);
                        let (samples, sr, ch) = if let Some(c) = cached {
                            c.clone()
                        } else {
                            match decode_file(&sound.path) {
                                Ok(dec) => {
                                    let entry = (dec.samples.clone(), dec.sample_rate, dec.channels);
                                    sound_cache.insert(req.sound_id.clone(), entry.clone());
                                    entry
                                }
                                Err(e) => {
                                    continue;
                                }
                            }
                        };

                        let settings = match db::get_settings(&conn) {
                            Ok(s) => s,
                            Err(e) => {
                                continue;
                            }
                        };

                        if sound.play_mode == "restart" {
                            if let Some(workers) = active_playbacks.remove(&req.sound_id) {
                                stop_playback_group(workers);
                            }
                        }

                        if !settings.overlap_enabled {
                            mixer.stop_all();
                            let old_playbacks = std::mem::take(&mut active_playbacks);
                            for (_, workers) in old_playbacks {
                                stop_playback_group(workers);
                            }
                        }

                        let base_gain = if sound.custom_volume {
                            sound.volume as f32
                        } else {
                            1.0
                        };
                        let repeat = sound.play_mode == "loop";

                        let mut workers = active_playbacks.remove(&req.sound_id).unwrap_or_default();
                        if settings.soundboard_live_enabled {
                            workers.push(spawn_sound_playback(
                                current_output_id.clone(),
                                false,
                                samples.clone(),
                                sr,
                                ch,
                                base_gain,
                                repeat,
                                live_playback_volumes.clone(),
                            ));
                        }

                        if settings.monitoring_enabled {
                            workers.push(spawn_sound_playback(
                                None,
                                true,
                                samples,
                                sr,
                                ch,
                                base_gain,
                                repeat,
                                live_playback_volumes.clone(),
                            ));
                        }

                        active_playbacks.insert(req.sound_id.clone(), workers);
                    }
                }
                Ok(EngineCommand::StopAll) => {
                    mixer.stop_all();
                    let playbacks = std::mem::take(&mut active_playbacks);
                    for (_sound_id, workers) in playbacks {
                        stop_playback_group(workers);
                    }
                }
                Ok(EngineCommand::SetVolumes(mic, master, sb)) => {
                    mixer.set_volumes(mic as f32, master as f32, sb as f32);
                    let mut volumes = live_playback_volumes.lock();
                    volumes.master = master as f32;
                    volumes.soundboard = sb as f32;
                },
                Ok(EngineCommand::SetMonitorVolume(volume)) => {
                    let mut volumes = live_playback_volumes.lock();
                    volumes.monitor = volume as f32;
                },
                Ok(EngineCommand::SetSoundboardLiveEnabled(enabled)) => {
                    mixer.set_soundboard_live_enabled(enabled);
                },
                Ok(EngineCommand::Restart(inp, out)) => {
                    current_output_id = out.clone();
                    let playbacks = std::mem::take(&mut active_playbacks);
                    for (_sound_id, workers) in playbacks {
                        stop_playback_group(workers);
                    }
                    if let Ok((c, r)) = init_streams(&inp, &out) {
                        if let Some(s) = cap_stream.take() { close_stream(s); }
                        if let Some(s) = ren_stream.take() { close_stream(s); }
                        if let Some(s) = mon_stream.take() { close_stream(s); }
                        let (new_sr, new_ch) = match &r {
                            Some(s) => (s.sample_rate, s.channels),
                            None => (SAMPLE_RATE, CHANNELS),
                        };
                        mixer = MixerState::new(new_sr, new_ch);
                        if let Ok(settings) = db::get_settings(&conn) {
                            mixer.set_volumes(
                                settings.mic_volume as f32,
                                settings.master_volume as f32,
                                settings.soundboard_volume as f32,
                            );
                            mixer.set_soundboard_live_enabled(settings.soundboard_live_enabled);
                            let mut volumes = live_playback_volumes.lock();
                            volumes.master = settings.master_volume as f32;
                            volumes.soundboard = settings.soundboard_volume as f32;
                            volumes.monitor = settings.monitor_volume as f32;
                        }
                        cap_stream = c;
                        ren_stream = r;
                        mon_stream = match get_default_device(eRender) {
                            Ok(d) => match open_stream(&d, true) {
                                Ok(s) => Some(s),
                                Err(_) => None,
                            },
                            Err(_) => None,
                        };
                    }
                }
                _ => {}
            }

            // Read all available mic packets
            let mut mic_samples: Vec<f32> = vec![];
            if let Some(ref cap) = cap_stream {
                if let Some(ref cc) = cap.capture {
                    loop {
                        match cc.GetNextPacketSize() {
                            Ok(frames) if frames > 0 => {
                                let mut buffer = std::ptr::null_mut::<u8>();
                                let mut frames_read = 0u32;
                                let mut flags = 0u32;
                                if cc.GetBuffer(&mut buffer, &mut frames_read, &mut flags, None, None).is_ok() {
                                    if frames_read > 0 && !buffer.is_null() {
                                        let packet = buffer_to_f32(buffer, frames_read as usize, cap.channels, cap.bits_per_sample, cap.format_tag, &cap.sub_format);
                                        mic_samples.extend_from_slice(&packet);
                                    }
                                    let _ = cc.ReleaseBuffer(frames_read);
                                }
                            }
                            _ => break,
                        }
                    }
                }
            }
            if !mic_samples.is_empty() {
                if let Some(cap) = cap_stream.as_ref() {
                    if cap.sample_rate != mixer_sr || cap.channels != mixer_ch {
                        mic_samples = resample_buffer(&mic_samples, cap.sample_rate, cap.channels, mixer_sr, mixer_ch);
                    }
                }
                mic_accumulator.extend_from_slice(&mic_samples);
                // Safety cap to prevent extreme drift / silence bursts
                let max_acc = (mixer_sr * mixer_ch as u32 * 4 / 10) as usize; // 400ms
                if mic_accumulator.len() > max_acc {
                    let excess = mic_accumulator.len() - max_acc;
                    mic_accumulator.drain(..excess);
                }
            }

            // Render to VB-Cable (output) — write ALL available frames
            let mut mixed: Vec<f32> = vec![];
            let mut frames_to_write = 0u32;
            if let Some(ref ren) = ren_stream {
                if let Some(ref rc) = ren.render {
                    let padding = ren.client.GetCurrentPadding().unwrap_or(0);
                    let frame_count = ren.client.GetBufferSize().unwrap_or(0);
                    let frames_available = frame_count.saturating_sub(padding);
                    frames_to_write = frames_available;
                    if frames_to_write > 0 {
                        // Feed exactly the samples needed for this render block to keep mic in sync
                        let needed = (frames_to_write * ren.channels as u32) as usize;
                        let available = mic_accumulator.len().min(needed);
                        if available > 0 {
                            mixer.set_mic_buffer(&mic_accumulator[..available]);
                            mic_accumulator.drain(..available);
                        } else {
                            mixer.set_mic_buffer(&[]);
                        }
                        let buffer = rc.GetBuffer(frames_to_write)?;
                        if !buffer.is_null() {
                            let samples_to_write = (frames_to_write * ren.channels as u32) as usize;
                            mixed = vec![0.0f32; samples_to_write];
                            mixer.process(frames_to_write as usize, &mut mixed);
                            f32_to_buffer(&mixed, buffer as *mut u8, frames_to_write as usize, ren.channels, ren.bits_per_sample, ren.format_tag, &ren.sub_format);
                            let _ = rc.ReleaseBuffer(frames_to_write, 0);
                        }
                    }
                }
            }
            mixer.clear_consumed_mic();

            // Monitoring to headphones (local playback) — soundboard only, no mic
            if frames_to_write > 0 {
                if let Some(ref mon) = mon_stream {
                    if let Some(ref mc) = mon.render {
                        let mon_padding = mon.client.GetCurrentPadding().unwrap_or(0);
                        let mon_frame_count = mon.client.GetBufferSize().unwrap_or(0);
                        let mon_frames_available = mon_frame_count.saturating_sub(mon_padding);
                        let mon_frames_to_write = mon_frames_available.min(frames_to_write);
                        if mon_frames_to_write > 0 {
                            let mon_buffer = mc.GetBuffer(mon_frames_to_write)?;
                            if !mon_buffer.is_null() {
                                let mon_samples = (mon_frames_to_write * mon.channels as u32) as usize;
                                let mut mixed_mon = vec![0.0f32; mon_samples];
                                mixer.process_sounds_only(mon_frames_to_write as usize, &mut mixed_mon);
                                let monitor_gain = live_playback_volumes.lock().monitor.clamp(0.0, 4.0);
                                for sample in mixed_mon.iter_mut() { *sample *= monitor_gain; }
                                f32_to_buffer(&mixed_mon, mon_buffer as *mut u8, mon_frames_to_write as usize, mon.channels, mon.bits_per_sample, mon.format_tag, &mon.sub_format);
                                let _ = mc.ReleaseBuffer(mon_frames_to_write, 0);
                            }
                        }
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let playbacks = std::mem::take(&mut active_playbacks);
        for (_sound_id, workers) in playbacks {
            stop_playback_group(workers);
        }
        if let Some(s) = cap_stream.take() { close_stream(s); }
        if let Some(s) = ren_stream.take() { close_stream(s); }
        if let Some(s) = mon_stream.take() { close_stream(s); }
        let _ = timeEndPeriod(1);
        Ok(())
    }
}

fn resample_buffer(input: &[f32], from_sr: u32, from_ch: u16, to_sr: u32, to_ch: u16) -> Vec<f32> {
    if from_sr == 0 || to_sr == 0 { return input.to_vec(); }
    let from_ch = from_ch.max(1) as usize;
    let to_ch = to_ch.max(1) as usize;
    let in_frames = input.len() / from_ch;
    if in_frames == 0 { return vec![]; }

    let ratio = to_sr as f64 / from_sr as f64;
    let out_frames = ((in_frames as f64 * ratio).ceil() as usize).max(1);
    let mut out = vec![0.0f32; out_frames * to_ch];

    for of in 0..out_frames {
        let in_pos = of as f64 / ratio;
        let in_frame = in_pos as usize;
        let frac = (in_pos - in_frame as f64) as f32;
        let base = in_frame * from_ch;
        let next_base = ((in_frame + 1) * from_ch).min(input.len().saturating_sub(from_ch));

        for och in 0..to_ch {
            let ich = if och < from_ch { och } else { 0 };
            let s0 = input[base + ich];
            let s1 = input[next_base + ich];
            let sample = s0 + (s1 - s0) * frac;
            out[of * to_ch + och] = sample;
        }
    }

    out
}

fn init_streams(input_id: &Option<String>, output_id: &Option<String>) -> Result<(Option<AudioStream>, Option<AudioStream>)> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();
    }
    let cap_device = match input_id {
        Some(id) => get_device_by_id(id),
        None => get_default_device(eCapture),
    };
    let ren_device = match output_id {
        Some(id) => get_device_by_id(id),
        None => get_default_device(eRender),
    };

    let cap_stream = match cap_device {
        Ok(d) => match open_stream(&d, false) {
            Ok(s) => Some(s),
            Err(_) => None,
        },
        Err(_) => None,
    };
    let ren_stream = match ren_device {
        Ok(d) => match open_stream(&d, true) {
            Ok(s) => Some(s),
            Err(_) => None,
        },
        Err(_) => None,
    };

    Ok((cap_stream, ren_stream))
}
