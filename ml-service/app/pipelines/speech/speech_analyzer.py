"""
Combines the real text-based and audio-based metrics above into the full SpeechAnalysisResult
shape the spec asks for. `pronunciation_score` and `emotion` are honestly None here — real
pronunciation scoring needs phoneme-level forced alignment and emotion needs a trained
classifier (e.g. a SpeechBrain model); both require downloadable weights (see docs/MODELS.md).
Transcription itself is NOT performed here — this pipeline expects a transcript to already
be available (e.g. from Whisper in a production deployment, or typed by the candidate).
"""
from dataclasses import dataclass

from app.pipelines.speech.audio_metrics import AudioEnergyResult, analyze_energy
from app.pipelines.speech.text_metrics import count_filler_words, lexicon_sentiment, speech_rate_wpm


@dataclass
class SpeechAnalysisResult:
    speech_rate_wpm: float
    filler_words: dict[str, int]
    filler_word_total: int
    sentiment: str
    sentiment_polarity: float
    voice_energy_score: float | None
    pause_count: int | None
    pause_frequency_per_minute: float | None
    pronunciation_score: float | None  # None: needs a real ASR-alignment model, see docstring
    emotion: str | None                # None: needs a trained emotion classifier, see docstring
    communication_score: float


def analyze_speech(transcript: str, duration_seconds: float, wav_path: str | None = None) -> SpeechAnalysisResult:
    rate = speech_rate_wpm(transcript, duration_seconds)
    fillers = count_filler_words(transcript)
    filler_total = sum(fillers.values())
    sentiment_result = lexicon_sentiment(transcript)

    audio_result: AudioEnergyResult | None = None
    if wav_path:
        try:
            audio_result = analyze_energy(wav_path)
        except Exception:
            audio_result = None  # malformed/unsupported audio -> degrade gracefully, don't fail the request

    communication_score = _communication_score(rate, filler_total, audio_result)

    return SpeechAnalysisResult(
        speech_rate_wpm=rate,
        filler_words=fillers,
        filler_word_total=filler_total,
        sentiment=sentiment_result["sentiment"],
        sentiment_polarity=sentiment_result["polarity"],
        voice_energy_score=audio_result.voice_energy_score if audio_result else None,
        pause_count=audio_result.pause_count if audio_result else None,
        pause_frequency_per_minute=audio_result.pause_frequency_per_minute if audio_result else None,
        pronunciation_score=None,
        emotion=None,
        communication_score=communication_score,
    )


def _communication_score(rate_wpm: float, filler_total: int, audio: AudioEnergyResult | None) -> float:
    """Real, explainable scoring formula: ideal speech rate is ~130-160 WPM; fillers and
    excessive silence both reduce the score."""
    if rate_wpm <= 0:
        return 0.0

    rate_penalty = 0.0
    if rate_wpm < 100:
        rate_penalty = (100 - rate_wpm) * 0.5
    elif rate_wpm > 180:
        rate_penalty = (rate_wpm - 180) * 0.5

    filler_penalty = min(30, filler_total * 4)
    silence_penalty = (audio.silence_ratio * 30) if audio and audio.silence_ratio > 0.4 else 0

    score = 100 - rate_penalty - filler_penalty - silence_penalty
    return round(max(0.0, min(100.0, score)), 1)
