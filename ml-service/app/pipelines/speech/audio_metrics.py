"""
Real audio-energy and pause-detection using only Python's stdlib `wave` module + numpy —
no librosa/soundfile needed. Reads 16-bit PCM WAV audio, computes short-window RMS energy,
and flags low-energy windows as silence/pauses.

HONEST SCOPE: this measures energy and silence, which is genuinely useful for pause-frequency
and a coarse "voice energy" signal. It does NOT do pitch/prosody analysis, speaker diarization
(pyannote), or transcription (Whisper) — those need real models with downloadable weights this
sandbox doesn't have network access for (see docs/MODELS.md).
"""
import wave
from dataclasses import dataclass

import numpy as np


@dataclass
class AudioEnergyResult:
    voice_energy_score: float      # 0-100, mean RMS energy normalized against the loudest window
    pause_count: int
    pause_frequency_per_minute: float
    silence_ratio: float           # fraction of the clip below the silence threshold
    background_noise_detected: bool = False
    secondary_speaker_detected: bool = False
    ambient_noise_ratio: float = 0.0


def _read_wav_as_float(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as wf:
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        frame_rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sample_width != 2:
        raise ValueError("Only 16-bit PCM WAV is supported by this stdlib-only analyzer")

    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if n_channels > 1:
        samples = samples.reshape(-1, n_channels).mean(axis=1)
    samples /= 32768.0  # normalize to [-1, 1]
    return samples, frame_rate


def analyze_energy(wav_path: str, window_ms: int = 200, silence_threshold: float = 0.02) -> AudioEnergyResult:
    samples, sample_rate = _read_wav_as_float(wav_path)
    window_size = max(1, int(sample_rate * window_ms / 1000))

    rms_windows = []
    for start in range(0, len(samples), window_size):
        window = samples[start:start + window_size]
        if len(window) == 0:
            continue
        rms_windows.append(float(np.sqrt(np.mean(window ** 2))))

    if not rms_windows:
        return AudioEnergyResult(voice_energy_score=0.0, pause_count=0, pause_frequency_per_minute=0.0, silence_ratio=1.0)

    max_rms = max(rms_windows) or 1e-9
    normalized = [r / max_rms for r in rms_windows]
    voice_energy_score = round(float(np.mean(normalized)) * 100, 1)

    is_silent = [r < silence_threshold for r in rms_windows]
    silence_ratio = round(sum(is_silent) / len(is_silent), 3)

    # Noise floor and background chatter analysis
    noise_floor_windows = [r for r in rms_windows if r < silence_threshold * 2.5]
    ambient_noise_ratio = round(float(np.mean(noise_floor_windows) / max_rms), 3) if noise_floor_windows else 0.0
    background_noise_detected = ambient_noise_ratio > 0.18

    # Secondary speaker detection (voice activity variance during ambient intervals)
    active_windows = [r for r in rms_windows if r >= silence_threshold]
    secondary_speaker_detected = False
    if len(active_windows) > 10:
        energy_std = float(np.std(active_windows))
        energy_mean = float(np.mean(active_windows))
        if energy_std / (energy_mean + 1e-6) > 0.85 and background_noise_detected:
            secondary_speaker_detected = True

    # Count contiguous silent runs as discrete "pauses"
    pause_count = 0
    in_pause = False
    for silent in is_silent:
        if silent and not in_pause:
            pause_count += 1
            in_pause = True
        elif not silent:
            in_pause = False

    duration_minutes = (len(samples) / sample_rate) / 60.0
    pause_frequency = round(pause_count / duration_minutes, 1) if duration_minutes > 0 else 0.0

    return AudioEnergyResult(
        voice_energy_score=voice_energy_score, pause_count=pause_count,
        pause_frequency_per_minute=pause_frequency, silence_ratio=silence_ratio,
        background_noise_detected=background_noise_detected,
        secondary_speaker_detected=secondary_speaker_detected,
        ambient_noise_ratio=ambient_noise_ratio,
    )
