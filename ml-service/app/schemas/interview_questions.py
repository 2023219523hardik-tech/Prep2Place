from pydantic import BaseModel, Field


class GenerateQuestionsRequest(BaseModel):
    resume_text: str = Field(..., description="Full resume text (already extracted from PDF/DOCX by the caller)")
    job_description: str = Field(..., description="Full job description text")
    num_technical: int = Field(default=5, ge=1, le=15)
    num_hr: int = Field(default=3, ge=1, le=10)


class GeneratedQuestionOut(BaseModel):
    question: str
    category: str
    topic: str
    difficulty: str


class GenerateQuestionsResponse(BaseModel):
    technical_questions: list[GeneratedQuestionOut]
    hr_questions: list[GeneratedQuestionOut]
    extracted_skills: list[str]
    source: str  # "llm" | "fallback_parse_error" | "fallback_empty_response"
    provider: str  # "ollama" | "gemini" | "mock" — which provider actually served this request
