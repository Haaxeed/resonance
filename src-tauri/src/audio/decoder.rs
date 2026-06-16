use anyhow::Result;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use std::fs::File;

pub struct DecodedAudio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_ms: u64,
}

fn normalize_samples(samples: &mut [f32]) {
    if samples.is_empty() {
        return;
    }

    let peak = samples
        .iter()
        .fold(0.0f32, |acc, sample| acc.max(sample.abs()));
    if peak <= 0.0001 {
        return;
    }

    let rms = (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt();
    let peak_gain = 0.98 / peak;
    let rms_gain = if rms > 0.0001 { 0.22 / rms } else { peak_gain };
    let gain = peak_gain.min(rms_gain).clamp(1.0, 12.0);

    if gain <= 1.01 {
        return;
    }

    for sample in samples.iter_mut() {
        *sample = (*sample * gain).clamp(-1.0, 1.0);
    }
}

pub fn decode_file(path: &str) -> Result<DecodedAudio> {
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let hint = Hint::new();
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe().format(&hint, mss, &format_opts, &metadata_opts)?;
    let mut format = probed.format;

    let track = format.tracks().iter().find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| anyhow::anyhow!("No audio track found"))?;

    let mut decoder = symphonia::default::get_codecs().make(&track.codec_params, &decoder_opts)?;
    let track_id = track.id;

    let sample_rate = track.codec_params.sample_rate.unwrap_or(48000);
    let channels = track.codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);
    let mut samples: Vec<f32> = Vec::new();
    let mut total_samples: u64 = 0;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e.into()),
        };
        if packet.track_id() != track_id { continue; }

        let decoded = decoder.decode(&packet)?;
        let spec = *decoded.spec();
        let cap = decoded.capacity() as u64;
        let mut sample_buf = SampleBuffer::<f32>::new(cap, spec);
        sample_buf.copy_interleaved_ref(decoded);
        total_samples += sample_buf.samples().len() as u64;
        samples.extend_from_slice(sample_buf.samples());
    }

    normalize_samples(&mut samples);

    let duration_ms = (total_samples as f64 / sample_rate as f64 / channels as f64 * 1000.0) as u64;

    Ok(DecodedAudio {
        samples,
        sample_rate,
        channels,
        duration_ms,
    })
}
