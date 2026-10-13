"""
Resume + JD -> interview question generation endpoint. Uses whichever LLM provider is
configured (Ollama by default, free/local; Gemini if GEMINI_API_KEY is set; mock as a
zero-setup deterministic fallback) — see app/services/llm/factory.py.
"""
from fastapi import APIRouter

from app.config.settings import get_settings
from app.pipelines.recommendation.interview_question_generator import generate_questions
from app.schemas.interview_questions import (
    GenerateQuestionsRequest, GenerateQuestionsResponse, GeneratedQuestionOut,
)
from app.services.llm.factory import get_llm_provider

router = APIRouter(tags=["interview-questions"])


@router.post("/generate/interview-questions", response_model=GenerateQuestionsResponse)
async def generate_interview_questions(request: GenerateQuestionsRequest):
    settings = get_settings()
    llm = get_llm_provider()

    result = await generate_questions(
        llm, request.resume_text, request.job_description,
        num_technical=request.num_technical, num_hr=request.num_hr,
    )

    return GenerateQuestionsResponse(
        technical_questions=[GeneratedQuestionOut(**vars(q)) for q in result.technical_questions],
        hr_questions=[GeneratedQuestionOut(**vars(q)) for q in result.hr_questions],
        extracted_skills=result.extracted_skills,
        source=result.source,
        provider=settings.llm_provider,
    )
