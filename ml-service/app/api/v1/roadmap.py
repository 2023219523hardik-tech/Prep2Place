from fastapi import APIRouter

from app.pipelines.nlp.jd_parser import parse_job_description
from app.pipelines.recommendation.roadmap_builder import build_roadmap
from app.schemas.roadmap import RoadmapItemOut, RoadmapRequest, RoadmapResponse

router = APIRouter(tags=["roadmap"])


@router.post("/roadmap", response_model=RoadmapResponse)
async def generate_roadmap(request: RoadmapRequest):
    combined_text = request.job_description + "\n" + (request.syllabus_text or "")
    parsed = parse_job_description(combined_text)

    candidate_skills = {s.lower().strip() for s in request.profile.known_skills}
    roadmap = build_roadmap(candidate_skills, parsed.required_skills, hours_per_week=request.hours_per_week)

    return RoadmapResponse(
        student_id=request.profile.student_id,
        target_role=request.target_role,
        match_percentage=roadmap.match_percentage,
        matched_topics=roadmap.matched_topics,
        missing_topics=roadmap.missing_topics,
        estimated_total_weeks=roadmap.estimated_total_weeks,
        roadmap=[
            RoadmapItemOut(week=i.week, topic=i.topic, category=i.category,
                           priority_score=i.priority_score, estimated_hours=i.estimated_hours, reason=i.reason)
            for i in roadmap.items
        ],
    )
