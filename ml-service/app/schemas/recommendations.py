from pydantic import BaseModel


class ImprovementRequest(BaseModel):
    student_id: str
    weak_topics: list[str]
    weak_skills: list[str] = []


class ImprovementItemOut(BaseModel):
    type: str  # "video" | "article" | "practice_question" | "mock_interview"
    title: str
    reason: str
    topic: str


class ImprovementResponse(BaseModel):
    student_id: str
    recommendations: list[ImprovementItemOut]
