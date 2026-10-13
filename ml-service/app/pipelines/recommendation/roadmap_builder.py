"""
Real, deterministic learning-roadmap logic: detects missing topics (JD/syllabus skills the
student profile doesn't have), ranks them by priority, and produces an ordered week-by-week
sequence with an estimated completion timeline. Rule-based and fully explainable — a natural
place to layer a learned ranking model later once outcome data exists (see docs/MODELS.md).
"""
from dataclasses import dataclass

from app.pipelines.nlp.skill_extractor import ExtractedSkill

# Rough effort weight (in study-hours) per taxonomy category — used to estimate completion time.
CATEGORY_EFFORT_HOURS: dict[str, int] = {
    "programming_languages": 20,
    "web_backend": 15,
    "web_frontend": 12,
    "databases": 10,
    "data_structures_algorithms": 25,
    "cloud_devops": 15,
    "data_ml": 20,
    "soft_skills": 5,
    "uncategorized": 8,
}


@dataclass
class RoadmapItem:
    week: int
    topic: str
    category: str
    priority_score: float
    estimated_hours: int
    reason: str


@dataclass
class RoadmapResult:
    missing_topics: list[str]
    matched_topics: list[str]
    match_percentage: float
    items: list[RoadmapItem]
    estimated_total_weeks: int


def detect_missing_topics(candidate_skills: set[str], required_skills: list[ExtractedSkill]) -> tuple[list[str], list[str]]:
    candidate_lower = {s.lower().strip() for s in candidate_skills}
    matched = [s.name for s in required_skills if s.name in candidate_lower]
    missing = [s.name for s in required_skills if s.name not in candidate_lower]
    return matched, missing


def rank_learning_priority(missing: list[ExtractedSkill]) -> list[ExtractedSkill]:
    """Priority = how often the skill is mentioned in the JD (proxy for importance)."""
    return sorted(missing, key=lambda s: s.mentions, reverse=True)


def build_roadmap(candidate_skills: set[str], required_skills: list[ExtractedSkill],
                   hours_per_week: int = 10) -> RoadmapResult:
    matched, missing_names = detect_missing_topics(candidate_skills, required_skills)
    missing_skills = [s for s in required_skills if s.name in missing_names]
    prioritized = rank_learning_priority(missing_skills)

    total_required = len(required_skills) or 1
    match_pct = round((len(matched) / total_required) * 100, 1)

    items: list[RoadmapItem] = []
    week = 1
    hours_this_week = 0
    for skill in prioritized:
        effort = CATEGORY_EFFORT_HOURS.get(skill.category or "uncategorized", 8)
        if hours_this_week + effort > hours_per_week and hours_this_week > 0:
            week += 1
            hours_this_week = 0
        items.append(RoadmapItem(
            week=week, topic=skill.name, category=skill.category or "uncategorized",
            priority_score=float(skill.mentions), estimated_hours=effort,
            reason=f"Mentioned {skill.mentions}x in the job description; not yet in your skill set.",
        ))
        hours_this_week += effort

    return RoadmapResult(
        missing_topics=missing_names, matched_topics=matched, match_percentage=match_pct,
        items=items, estimated_total_weeks=week,
    )
