from pydantic import BaseModel, Field


class StudentProfileIn(BaseModel):
    student_id: str
    known_skills: list[str] = Field(default_factory=list)
    preferred_domain: str | None = None


class RoadmapRequest(BaseModel):
    profile: StudentProfileIn
    company_name: str | None = None
    target_role: str
    job_description: str
    syllabus_text: str | None = None
    previous_year_questions: list[str] = Field(default_factory=list)
    hours_per_week: int = 10


class RoadmapItemOut(BaseModel):
    week: int
    topic: str
    category: str
    priority_score: float
    estimated_hours: int
    reason: str


class RoadmapResponse(BaseModel):
    student_id: str
    target_role: str
    match_percentage: float
    matched_topics: list[str]
    missing_topics: list[str]
    estimated_total_weeks: int
    roadmap: list[RoadmapItemOut]
