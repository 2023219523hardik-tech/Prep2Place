from pydantic import BaseModel


class QuestionAttemptIn(BaseModel):
    question_id: str
    topic: str
    difficulty: str
    correct: bool
    time_taken_seconds: float


class MockTestRequest(BaseModel):
    student_id: str
    attempts: list[QuestionAttemptIn]


class TopicPerformanceOut(BaseModel):
    topic: str
    attempted: int
    correct: int
    accuracy: float
    avg_time_seconds: float


class MockTestReportOut(BaseModel):
    total_questions: int
    correct_count: int
    accuracy: float
    avg_time_per_question: float
    fastest_topic: str | None
    slowest_topic: str | None
    topic_performance: list[TopicPerformanceOut]
    weak_topics: list[str]
    strong_topics: list[str]
    improvement_suggestions: list[str]
