"""
Rule-based skill extraction and clustering. See skill_taxonomy.py docstring for honest scope
(dictionary/regex matching, not a trained NER model).
"""
import re
from collections import defaultdict
from dataclasses import dataclass

from app.pipelines.nlp.skill_taxonomy import ALL_SKILLS, category_for


@dataclass
class ExtractedSkill:
    name: str
    category: str | None
    mentions: int


def extract_skills(text: str) -> list[ExtractedSkill]:
    """Whole-word/phrase, case-insensitive matching against the curated taxonomy, with a
    mention count (how many times each skill appears) as a rough importance signal."""
    if not text:
        return []
    lower = text.lower()
    results: list[ExtractedSkill] = []
    for skill in ALL_SKILLS:
        # Word-boundary match so "r" doesn't match inside "for", "go" doesn't match "going", etc.
        pattern = r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])"
        mentions = len(re.findall(pattern, lower))
        if mentions > 0:
            results.append(ExtractedSkill(name=skill, category=category_for(skill), mentions=mentions))
    return sorted(results, key=lambda s: s.mentions, reverse=True)


def cluster_skills(skills: list[ExtractedSkill]) -> dict[str, list[str]]:
    """Groups extracted skills by taxonomy category (a legitimate, deterministic clustering
    strategy for a curated taxonomy — an unsupervised clustering algorithm like KMeans would
    only make sense over embeddings, which needs a model we don't have offline; see docs/MODELS.md)."""
    clusters: dict[str, list[str]] = defaultdict(list)
    for skill in skills:
        clusters[skill.category or "uncategorized"].append(skill.name)
    return dict(clusters)
