from app.pipelines.analytics.mock_test_analyzer import QuestionAttempt, analyze_mock_test


def test_identifies_weak_and_strong_topics():
    attempts = [
        QuestionAttempt("q1", "Arrays", "EASY", True, 30),
        QuestionAttempt("q2", "Arrays", "MEDIUM", True, 45),
        QuestionAttempt("q3", "DP", "HARD", False, 120),
        QuestionAttempt("q4", "DP", "HARD", False, 110),
    ]
    report = analyze_mock_test(attempts)
    assert report.accuracy == 50.0
    assert "DP" in report.weak_topics
    assert "Arrays" in report.strong_topics


def test_empty_attempts_returns_zeroed_report():
    report = analyze_mock_test([])
    assert report.total_questions == 0
    assert report.accuracy == 0.0
    assert report.improvement_suggestions  # non-empty guidance even with no data
