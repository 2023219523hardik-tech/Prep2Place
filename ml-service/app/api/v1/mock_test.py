from fastapi import APIRouter

from app.pipelines.analytics.mock_test_analyzer import QuestionAttempt, analyze_mock_test
from app.schemas.mock_test import MockTestReportOut, MockTestRequest, TopicPerformanceOut

router = APIRouter(tags=["mock-test"])


@router.post("/analyze/mock-test", response_model=MockTestReportOut)
async def analyze_mock_test_endpoint(request: MockTestRequest):
    attempts = [
        QuestionAttempt(question_id=a.question_id, topic=a.topic, difficulty=a.difficulty,
                         correct=a.correct, time_taken_seconds=a.time_taken_seconds)
        for a in request.attempts
    ]
    report = analyze_mock_test(attempts)

    return MockTestReportOut(
        total_questions=report.total_questions, correct_count=report.correct_count,
        accuracy=report.accuracy, avg_time_per_question=report.avg_time_per_question,
        fastest_topic=report.fastest_topic, slowest_topic=report.slowest_topic,
        topic_performance=[
            TopicPerformanceOut(topic=t.topic, attempted=t.attempted, correct=t.correct,
                                 accuracy=t.accuracy, avg_time_seconds=t.avg_time_seconds)
            for t in report.topic_performance
        ],
        weak_topics=report.weak_topics, strong_topics=report.strong_topics,
        improvement_suggestions=report.improvement_suggestions,
    )
