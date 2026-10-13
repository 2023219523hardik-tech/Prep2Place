from app.pipelines.speech.text_metrics import count_filler_words, lexicon_sentiment, speech_rate_wpm


def test_speech_rate_calculation():
    transcript = " ".join(["word"] * 150)  # 150 words
    assert speech_rate_wpm(transcript, duration_seconds=60) == 150.0


def test_filler_word_detection():
    transcript = "Um, so basically I think, like, this is a good approach, actually."
    fillers = count_filler_words(transcript)
    assert fillers.get("um") == 1
    assert fillers.get("like") == 1
    assert fillers.get("basically") == 1


def test_sentiment_detects_positive_language():
    result = lexicon_sentiment("I felt confident and the project was a great success.")
    assert result["sentiment"] == "positive"
