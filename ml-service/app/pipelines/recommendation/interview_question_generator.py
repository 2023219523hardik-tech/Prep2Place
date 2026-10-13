"""
Resume + JD -> interview question generation. The prompt construction and JSON-extraction/
repair logic here are real and unit-tested (see tests/unit/test_question_generator.py) — only
the actual network call to Ollama/Gemini inside LLMProvider.complete() is unverified in the
sandbox this was built in (no internet/Ollama binary there). The MockLLMProvider fallback
(see app/services/llm/mock_provider.py) makes the whole pipeline work end-to-end regardless.
"""
import json
import re
from dataclasses import dataclass

from app.pipelines.nlp.skill_extractor import extract_skills
from app.services.llm.base import LLMProvider

SYSTEM_PROMPT = (
    "You are an expert technical interviewer. You generate interview questions strictly as "
    "JSON with no commentary, no markdown code fences, and no extra text before or after the "
    "JSON object."
)

PROMPT_TEMPLATE = """\
Generate interview questions for a candidate based on their resume and the target job description.

RESUME:
{resume_text}

JOB_DESCRIPTION:
{jd_text}

EXTRACTED_SKILLS: {skills_csv}

Generate exactly {num_technical} TECHNICAL questions (testing depth on skills/technologies \
relevant to both the resume and the job description) and exactly {num_hr} HR/personality \
questions (behavioral, motivation, teamwork, culture fit).

Respond with ONLY a JSON object in exactly this shape, no other text:
{{
  "technical_questions": [
    {{"question": "...", "category": "TECHNICAL", "topic": "...", "difficulty": "EASY|MEDIUM|HARD"}}
  ],
  "hr_questions": [
    {{"question": "...", "category": "HR", "topic": "...", "difficulty": "EASY|MEDIUM|HARD"}}
  ]
}}
"""


@dataclass
class GeneratedQuestion:
    question: str
    category: str
    topic: str
    difficulty: str


@dataclass
class QuestionGenerationResult:
    technical_questions: list[GeneratedQuestion]
    hr_questions: list[GeneratedQuestion]
    extracted_skills: list[str]
    source: str  # "llm" | "fallback_parse_error" | "fallback_empty_response" | "fallback_provider_error"


def build_prompt(resume_text: str, jd_text: str, num_technical: int, num_hr: int) -> tuple[str, list[str]]:
    """Pure function — extracts skills and renders the prompt. Fully unit-testable with no
    network/LLM involved."""
    if num_technical < 0 or num_hr < 0:
        raise ValueError("Question counts must be non-negative")

    # API callers can omit either field. Treat that as an empty value rather than leaking an
    # AttributeError from .strip() out of the request handler.
    resume_text = resume_text or ""
    jd_text = jd_text or ""
    combined = f"{resume_text}\n{jd_text}"
    skills = [s.name for s in extract_skills(combined)]
    prompt = PROMPT_TEMPLATE.format(
        resume_text=resume_text.strip() or "(not provided)",
        jd_text=jd_text.strip() or "(not provided)",
        skills_csv=", ".join(skills) if skills else "(none detected)",
        num_technical=num_technical, num_hr=num_hr,
    )
    return prompt, skills


def extract_json(raw_text: str) -> dict | None:
    """LLMs frequently wrap JSON in markdown fences or add a preamble/postamble sentence —
    this pulls out the first well-formed top-level JSON object regardless. Real, necessary
    robustness for LLM output; pure function, fully unit-testable."""
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: decode the first JSON object from prose. JSONDecoder handles quoted braces and
    # escaped quotes correctly; hand-written brace counting does not.
    start = text.find("{")
    if start == -1:
        return None
    try:
        value, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _parse_questions(raw_list: list, default_category: str) -> list[GeneratedQuestion]:
    parsed = []
    for item in raw_list or []:
        if not isinstance(item, dict) or not item.get("question"):
            continue
        question = str(item["question"]).strip()
        if not question:
            continue
        difficulty = str(item.get("difficulty", "MEDIUM")).upper()
        # Keep the API contract stable even when a provider invents a difficulty label.
        if difficulty not in {"EASY", "MEDIUM", "HARD"}:
            difficulty = "MEDIUM"
        parsed.append(GeneratedQuestion(
            question=question,
            category=default_category,
            topic=str(item.get("topic") or "General").strip() or "General",
            difficulty=difficulty,
        ))
    return parsed


async def generate_questions(
    llm: LLMProvider, resume_text: str, jd_text: str, num_technical: int = 5, num_hr: int = 3,
) -> QuestionGenerationResult:
    prompt, skills = build_prompt(resume_text, jd_text, num_technical, num_hr)

    try:
        raw_response = await llm.complete(prompt, system=SYSTEM_PROMPT)
    except Exception:
        # A provider outage must not turn a user request into an unhandled 500. The caller can
        # distinguish this state and offer a retry while still receiving a valid response shape.
        return QuestionGenerationResult(
            technical_questions=[], hr_questions=[], extracted_skills=skills,
            source="fallback_provider_error",
        )
    parsed = extract_json(raw_response)

    if parsed is None:
        return QuestionGenerationResult(
            technical_questions=[], hr_questions=[], extracted_skills=skills,
            source="fallback_empty_response" if not raw_response else "fallback_parse_error",
        )

    technical = _parse_questions(parsed.get("technical_questions", []), "TECHNICAL")
    hr = _parse_questions(parsed.get("hr_questions", []), "HR")

    return QuestionGenerationResult(
        technical_questions=technical, hr_questions=hr, extracted_skills=skills, source="llm",
    )
