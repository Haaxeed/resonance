use std::collections::HashMap;

#[derive(Clone)]
pub struct SoundBuffer {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub cursor: f64,
    pub active: bool,
    pub volume: f32,
    pub play_mode: String,
}

pub struct MixerState {
    pub sounds: HashMap<String, Vec<SoundBuffer>>,
    pub mic_volume: f32,
    pub master_volume: f32,
    pub soundboard_volume: f32,
    pub soundboard_live_enabled: bool,
    pub mic_buffer: Vec<f32>,
    pub mic_cursor: usize,
    pub sample_rate: u32,
    pub channels: u16,
}

impl MixerState {
    pub fn new(sample_rate: u32, channels: u16) -> Self {
        Self {
            sounds: HashMap::new(),
            mic_volume: 1.0,
            master_volume: 1.0,
            soundboard_volume: 1.0,
            soundboard_live_enabled: true,
            mic_buffer: vec![],
            mic_cursor: 0,
            sample_rate,
            channels,
        }
    }

    pub fn play_sound(&mut self, id: String, samples: Vec<f32>, sample_rate: u32, channels: u16, volume: f32, play_mode: String) {
        let sb = SoundBuffer {
            samples,
            sample_rate,
            channels,
            cursor: 0.0,
            active: true,
            volume,
            play_mode: play_mode.clone(),
        };
        let entry = self.sounds.entry(id.clone()).or_default();
        if play_mode == "restart" && !entry.is_empty() {
            entry.clear();
        }
        entry.push(sb);
    }

    pub fn stop_all(&mut self) {
        self.sounds.clear();
    }

    pub fn set_volumes(&mut self, mic: f32, master: f32, sb: f32) {
        self.mic_volume = mic.clamp(0.0, 2.0);
        self.master_volume = master.clamp(0.0, 4.0);
        self.soundboard_volume = sb.clamp(0.0, 12.0);
    }

    pub fn set_soundboard_live_enabled(&mut self, enabled: bool) {
        self.soundboard_live_enabled = enabled;
    }

    pub fn set_mic_buffer(&mut self, buf: &[f32]) {
        self.mic_buffer.extend_from_slice(buf);
    }

    pub fn clear_consumed_mic(&mut self) {
        if self.mic_cursor >= self.mic_buffer.len() {
            self.mic_buffer.clear();
            self.mic_cursor = 0;
        } else if self.mic_cursor > 0 {
            self.mic_buffer.drain(..self.mic_cursor);
            self.mic_cursor = 0;
        }
    }

    /// Mix exactly `frame_count` output frames into `out`.
    /// `out.len()` must be `frame_count * self.channels`.
    pub fn process(&mut self, frame_count: usize, out: &mut [f32]) {
        let out_ch = self.channels.max(1) as usize;
        let samples = frame_count * out_ch;
        assert_eq!(out.len(), samples);
        out.fill(0.0);

        // Mix mic
        if !self.mic_buffer.is_empty() && self.mic_cursor < self.mic_buffer.len() {
            let mic_available = self.mic_buffer.len() - self.mic_cursor;
            let mic_len = mic_available.min(samples);
            for i in 0..mic_len {
                out[i] += self.mic_buffer[self.mic_cursor + i] * self.mic_volume;
            }
            self.mic_cursor += mic_len;
        }

        if self.soundboard_live_enabled {
            self.mix_sounds(frame_count, out);
        }

        // Soft limiter / clipper
        for s in out.iter_mut() {
            *s = soft_clip(*s * self.master_volume);
        }
    }

    /// Mix sounds only (no mic), without advancing sound cursors.
    /// Used for monitoring output.
    pub fn process_sounds_only(&self, frame_count: usize, out: &mut [f32]) {
        let out_ch = self.channels.max(1) as usize;
        let samples = frame_count * out_ch;
        assert_eq!(out.len(), samples);
        out.fill(0.0);

        self.mix_sounds_no_advance(frame_count, out);

        for s in out.iter_mut() {
            *s = soft_clip(*s * self.master_volume);
        }
    }

    fn mix_sounds(&mut self, frame_count: usize, out: &mut [f32]) {
        let out_ch = self.channels.max(1) as usize;
        let mut to_remove = Vec::new();
        for (sound_id, instances) in &mut self.sounds {
            let mut instance_done = Vec::new();
            for (idx, inst) in instances.iter_mut().enumerate() {
                if !inst.active { continue; }
                let inst_ch = inst.channels.max(1) as usize;
                let total_input_frames = inst.samples.len() / inst_ch;

                let ratio = if inst.sample_rate == 0 || self.sample_rate == 0 {
                    1.0f64
                } else {
                    inst.sample_rate as f64 / self.sample_rate as f64
                };

                for out_f in 0..frame_count {
                    if !inst.active { break; }
                    let input_pos = inst.cursor;
                    let input_frame = input_pos as usize;

                    if input_frame >= total_input_frames {
                        if inst.play_mode == "loop" {
                            inst.cursor = 0.0;
                            let input_pos = inst.cursor;
                            let input_frame = input_pos as usize;
                            if input_frame >= total_input_frames {
                                inst.active = false;
                                break;
                            }
                        } else {
                            inst.active = false;
                            break;
                        }
                    }

                    let frac = (input_pos - input_frame as f64) as f32;
                    let base = input_frame * inst_ch;
                    let next_base = ((input_frame + 1) * inst_ch).min(inst.samples.len().saturating_sub(inst_ch));

                    let out_idx = out_f * out_ch;
                    for och in 0..out_ch {
                        let ich = if och < inst_ch { och } else { 0 };
                        let s0 = inst.samples[base + ich];
                        let s1 = inst.samples[next_base + ich];
                        let sample = (s0 + (s1 - s0) * frac) * inst.volume * self.soundboard_volume;
                        out[out_idx + och] += sample;
                    }

                    inst.cursor += ratio;
                }

                if !inst.active {
                    instance_done.push(idx);
                }
            }
            for idx in instance_done.into_iter().rev() {
                instances.remove(idx);
            }
            if instances.is_empty() {
                to_remove.push(sound_id.clone());
            }
        }
        for id in to_remove {
            self.sounds.remove(&id);
        }
    }

    fn mix_sounds_no_advance(&self, frame_count: usize, out: &mut [f32]) {
        let out_ch = self.channels.max(1) as usize;
        for (_sound_id, instances) in &self.sounds {
            for inst in instances.iter() {
                if !inst.active { continue; }
                let inst_ch = inst.channels.max(1) as usize;
                let total_input_frames = inst.samples.len() / inst_ch;

                let ratio = if inst.sample_rate == 0 || self.sample_rate == 0 {
                    1.0f64
                } else {
                    inst.sample_rate as f64 / self.sample_rate as f64
                };

                let mut cursor = inst.cursor;
                for out_f in 0..frame_count {
                    let input_pos = cursor;
                    let input_frame = input_pos as usize;

                    if input_frame >= total_input_frames {
                        break;
                    }

                    let frac = (input_pos - input_frame as f64) as f32;
                    let base = input_frame * inst_ch;
                    let next_base = ((input_frame + 1) * inst_ch).min(inst.samples.len().saturating_sub(inst_ch));

                    let out_idx = out_f * out_ch;
                    for och in 0..out_ch {
                        let ich = if och < inst_ch { och } else { 0 };
                        let s0 = inst.samples[base + ich];
                        let s1 = inst.samples[next_base + ich];
                        let sample = (s0 + (s1 - s0) * frac) * inst.volume * self.soundboard_volume;
                        out[out_idx + och] += sample;
                    }

                    cursor += ratio;
                }
            }
        }
    }
}

fn soft_clip(x: f32) -> f32 {
    if x > 1.0 {
        1.0 + 0.25 * (1.0 - (-4.0 * (x - 1.0)).exp())
    } else if x < -1.0 {
        -1.0 - 0.25 * (1.0 - (-4.0 * (-x - 1.0)).exp())
    } else {
        x
    }
}
