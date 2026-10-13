"""
Real, transcript-only speech metrics — no audio processing needed, so these work even
without Whisper/librosa: speech rate (from transcript + duration), filler-word frequency,
and a lexicon-based sentiment score (a legitimate, if basic, rule-based technique — a
transformer sentiment model would be a strict upgrade, see docs/MODELS.md).
"""
import re

FILLER_WORDS = ["um", "uh", "like", "you know", "sort of", "kind of", "basically", "actually", "i mean"]

_POSITIVE_LEXICON = {
    "confident", "excited", "great", "excellent", "strong", "passionate", "successful",
    "achieved", "improved", "effective", "good", "happy", "proud", "capable", "skilled",
}
_NEGATIVE_LEXICON = {
    "nervous", "worried", "difficult", "failed", "struggle", "confused", "weak", "unsure",
    "afraid", "problem", "bad", "poor", "stressed", "anxious",
}


def speech_rate_wpm(transcript: str, duration_seconds: float) -> float:
    if duration_seconds <= 0:
        return 0.0
    word_count = len((transcript or "").split())
    return round(word_count / (duration_seconds / 60.0), 1)


def count_filler_words(transcript: str) -> dict[str, int]:
    lower = (transcript or "").lower()
    counts = {}
    for filler in FILLER_WORDS:
        pattern = r"(?<![a-z])" + re.escape(filler) + r"(?![a-z])"
        n = len(re.findall(pattern, lower))
        if n > 0:
            counts[filler] = n
    return counts


def lexicon_sentiment(transcript: str) -> dict:
    words = re.findall(r"[a-z']+", (transcript or "").lower())
    pos = sum(1 for w in words if w in _POSITIVE_LEXICON)
    neg = sum(1 for w in words if w in _NEGATIVE_LEXICON)
    total = pos + neg
    if total == 0:
        return {"sentiment": "neutral", "polarity": 0.0, "positive_hits": 0, "negative_hits": 0}
    polarity = round((pos - neg) / total, 2)
    sentiment = "positive" if polarity > 0.2 else "negative" if polarity < -0.2 else "neutral"
    return {"sentiment": sentiment, "polarity": polarity, "positive_hits": pos, "negative_hits": neg}
