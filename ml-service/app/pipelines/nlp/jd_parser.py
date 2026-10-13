"""Job description parsing: skill extraction + lightweight structured field extraction via regex."""
import re
from dataclasses import dataclass, field

from app.pipelines.nlp.skill_extractor import ExtractedSkill, cluster_skills, extract_skills

_EXPERIENCE_PATTERN = re.compile(r"(\d+)\+?\s*(?:-\s*\d+\s*)?years?", re.IGNORECASE)


@dataclass
class JobDescriptionParseResult:
    required_skills: list[ExtractedSkill]
    skill_clusters: dict[str, list[str]]
    min_experience_years: int | None
    raw_length_words: int = field(default=0)


def parse_job_description(text: str) -> JobDescriptionParseResult:
    skills = extract_skills(text)
    clusters = cluster_skills(skills)

    experience_match = _EXPERIENCE_PATTERN.search(text or "")
    min_experience = int(experience_match.group(1)) if experience_match else None

    return JobDescriptionParseResult(
        required_skills=skills,
        skill_clusters=clusters,
        min_experience_years=min_experience,
        raw_length_words=len((text or "").split()),
    )
