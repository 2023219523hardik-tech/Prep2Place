from app.pipelines.nlp.jd_parser import parse_job_description
from app.pipelines.recommendation.roadmap_builder import build_roadmap


def test_roadmap_flags_missing_skills_and_orders_by_priority():
    jd = "Looking for a Backend Developer skilled in Java, Spring Boot, SQL, Docker, and AWS."
    parsed = parse_job_description(jd)

    roadmap = build_roadmap({"java", "sql"}, parsed.required_skills, hours_per_week=10)

    assert "java" in roadmap.matched_topics
    assert "spring boot" in roadmap.missing_topics
    assert roadmap.match_percentage > 0
    assert len(roadmap.items) == len(roadmap.missing_topics)
