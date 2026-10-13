"""
Real, deterministic mock-test analytics: accuracy, per-question timing, topic-wise
performance, weak/strong topic detection, and improvement suggestions. No ML model needed —
this is genuine statistical aggregation over the submitted answers.
"""
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class QuestionAttempt:
    question_id: str
    topic: str
    difficulty: str
    correct: bool
    time_taken_seconds: float


@dataclass
class TopicPerformance:
    topic: str
    attempted: int
    correct: int
    accuracy: float
    avg_time_seconds: float


@dataclass
class MockTestReport:
    total_questions: int
    correct_count: int
    accuracy: float
    avg_time_per_question: float
    fastest_topic: str | None
    slowest_topic: str | None
    topic_performance: list[TopicPerformance]
    weak_topics: list[str]
    strong_topics: list[str]
    improvement_suggestions: list[str] = field(default_factory=list)


def analyze_mock_test(attempts: list[QuestionAttempt]) -> MockTestReport:
    if not attempts:
        return MockTestReport(0, 0, 0.0, 0.0, None, None, [], [], [],
                               ["No attempts submitted — take a mock test to get analytics."])

    total = len(attempts)
    correct_count = sum(1 for a in attempts if a.correct)
    accuracy = round((correct_count / total) * 100, 1)
    avg_time = round(sum(a.time_taken_seconds for a in attempts) / total, 1)

    by_topic: dict[str, list[QuestionAttempt]] = defaultdict(list)
    for a in attempts:
        by_topic[a.topic].append(a)

    topic_performance: list[TopicPerformance] = []
    for topic, topic_attempts in by_topic.items():
        n = len(topic_attempts)
        c = sum(1 for a in topic_attempts if a.correct)
        topic_performance.append(TopicPerformance(
            topic=topic, attempted=n, correct=c,
            accuracy=round((c / n) * 100, 1),
            avg_time_seconds=round(sum(a.time_taken_seconds for a in topic_attempts) / n, 1),
        ))
    topic_performance.sort(key=lambda t: t.accuracy)

    weak_topics = [t.topic for t in topic_performance if t.accuracy < 50]
    strong_topics = [t.topic for t in topic_performance if t.accuracy >= 80]

    by_avg_time = sorted(topic_performance, key=lambda t: t.avg_time_seconds)
    fastest_topic = by_avg_time[0].topic if by_avg_time else None
    slowest_topic = by_avg_time[-1].topic if by_avg_time else None

    suggestions = []
    for topic in weak_topics:
        suggestions.append(f"Revisit fundamentals in '{topic}' — accuracy is below 50%.")
    if slowest_topic and slowest_topic not in weak_topics:
        suggestions.append(f"Practice more timed questions in '{slowest_topic}' to improve speed.")
    if not suggestions:
        suggestions.append("Solid performance across topics — keep practicing to maintain consistency.")

    return MockTestReport(
        total_questions=total, correct_count=correct_count, accuracy=accuracy,
        avg_time_per_question=avg_time, fastest_topic=fastest_topic, slowest_topic=slowest_topic,
        topic_performance=topic_performance, weak_topics=weak_topics, strong_topics=strong_topics,
        improvement_suggestions=suggestions,
    )
