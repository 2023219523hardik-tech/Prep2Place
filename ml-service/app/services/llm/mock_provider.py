"""
Deterministic, template-based fallback — used when no real LLM (Ollama/Gemini) is configured
or reachable, so /generate/interview-questions works out of the box with zero setup, same
"graceful degradation" pattern as SpeechToTextService/VideoAnalysisService elsewhere in this
project. Not a real LLM call — parses the structured EXTRACTED_SKILLS line the prompt builder
always includes (see question_generator.py) and generates one question per skill from a small
template bank, so the *feature* works end-to-end without a live model, even though the
questions are templated rather than genuinely generated.
"""
import re

from app.services.llm.base import LLMProvider

_TECHNICAL_TEMPLATES = [
    "Explain how you have used {skill} in a real project you've worked on.",
    "What are the key trade-offs to consider when using {skill}?",
    "Describe a challenging bug or issue you've encountered while working with {skill} and how you resolved it.",
    "How would you explain {skill} to someone with no technical background?",
]

_HR_TEMPLATES = [
    "Tell me about a time you had to learn {skill} quickly for a project. How did you approach it?",
    "How do you stay up to date with developments related to {skill}?",
    "Describe a situation where you disagreed with a teammate about how to use {skill} — how was it resolved?",
]


class MockLLMProvider(LLMProvider):
    async def complete(self, prompt: str, system: str | None = None) -> str:
        skills = self._extract_skills_from_prompt(prompt)
        if not skills:
            skills = ["your primary technical skill", "a recent project"]

        num_technical = self._extract_int(prompt, r"exactly (\d+) TECHNICAL questions", default=5)
        num_hr = self._extract_int(prompt, r"exactly (\d+) HR", default=3)

        technical = [
            {"question": _TECHNICAL_TEMPLATES[i % len(_TECHNICAL_TEMPLATES)].format(skill=skills[i % len(skills)]),
             "category": "TECHNICAL", "topic": skills[i % len(skills)], "difficulty": "MEDIUM"}
            for i in range(num_technical)
        ]
        hr = [
            {"question": _HR_TEMPLATES[i % len(_HR_TEMPLATES)].format(skill=skills[i % len(skills)]),
             "category": "HR", "topic": skills[i % len(skills)], "difficulty": "EASY"}
            for i in range(num_hr)
        ]

        import json
        return json.dumps({"technical_questions": technical, "hr_questions": hr})

    @staticmethod
    def _extract_int(prompt: str, pattern: str, default: int) -> int:
        match = re.search(pattern, prompt)
        return int(match.group(1)) if match else default

    @staticmethod
    def _extract_skills_from_prompt(prompt: str) -> list[str]:
        match = re.search(r"EXTRACTED_SKILLS:\s*(.+)", prompt)
        if not match:
            return []
        return [s.strip() for s in match.group(1).split(",") if s.strip()]
