import pytest

from app.pipelines.recommendation.interview_question_generator import (
    build_prompt, extract_json, generate_questions,
)
from app.services.llm.mock_provider import MockLLMProvider


def test_build_prompt_extracts_skills():
    resume = "Backend developer skilled in Java, Spring Boot, SQL."
    jd = "Looking for Java, Spring Boot, AWS, Kubernetes skills."
    prompt, skills = build_prompt(resume, jd, 5, 3)
    assert "java" in skills and "spring boot" in skills
    assert "EXTRACTED_SKILLS:" in prompt


def test_extract_json_handles_clean_json():
    result = extract_json('{"technical_questions": [], "hr_questions": []}')
    assert result == {"technical_questions": [], "hr_questions": []}


def test_extract_json_handles_markdown_fences():
    raw = '```json\n{"technical_questions": [], "hr_questions": []}\n```'
    assert extract_json(raw) is not None


def test_extract_json_handles_preamble_text():
    raw = 'Here you go:\n{"technical_questions": [{"question": "Q1"}], "hr_questions": []}\nHope this helps!'
    result = extract_json(raw)
    assert result is not None
    assert result["technical_questions"][0]["question"] == "Q1"


def test_extract_json_handles_braces_inside_a_question_string():
    raw = 'Preamble {"technical_questions": [{"question": "What does {x: 1} mean?"}], "hr_questions": []} trailing'
    result = extract_json(raw)
    assert result is not None
    assert result["technical_questions"][0]["question"] == "What does {x: 1} mean?"


def test_extract_json_returns_none_for_garbage():
    assert extract_json("not json at all") is None
    assert extract_json("") is None


@pytest.mark.asyncio
async def test_generate_questions_end_to_end_with_mock_provider():
    result = await generate_questions(
        MockLLMProvider(),
        resume_text="Backend developer with Java, Spring Boot, SQL experience.",
        jd_text="Hiring for Java, Spring Boot, AWS, Docker.",
        num_technical=4, num_hr=2,
    )
    assert result.source == "llm"
    assert len(result.technical_questions) == 4
    assert len(result.hr_questions) == 2
    assert all(q.category == "TECHNICAL" for q in result.technical_questions)
    assert all(q.category == "HR" for q in result.hr_questions)


class FailingProvider:
    async def complete(self, prompt, *, system):
        raise RuntimeError("provider unavailable")


@pytest.mark.asyncio
async def test_generate_questions_returns_a_safe_result_when_provider_fails():
    result = await generate_questions(FailingProvider(), "Java", "Java developer")
    assert result.source == "fallback_provider_error"
    assert result.technical_questions == []
    assert result.hr_questions == []


def test_build_prompt_rejects_negative_question_counts():
    with pytest.raises(ValueError, match="non-negative"):
        build_prompt("resume", "jd", -1, 1)
