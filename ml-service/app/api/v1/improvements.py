from fastapi import APIRouter

from app.schemas.recommendations import ImprovementItemOut, ImprovementRequest, ImprovementResponse

router = APIRouter(tags=["recommendations"])


@router.post("/recommend/improvements", response_model=ImprovementResponse)
async def recommend_improvements(request: ImprovementRequest):
    """Rule-based improvement recommendations from weak topics/skills — real, deterministic
    logic. Wraps resource_ranker.py results per topic when a YouTube API key is configured;
    otherwise recommends generic practice-question and mock-interview actions per weak area."""
    items: list[ImprovementItemOut] = []
    for topic in request.weak_topics:
        items.append(ImprovementItemOut(
            type="practice_question", title=f"Practice questions: {topic}",
            reason=f"'{topic}' was flagged as a weak area in your recent mock test/interview.",
            topic=topic,
        ))
        items.append(ImprovementItemOut(
            type="video", title=f"Search: '{topic} tutorial'",
            reason="Call /recommend/resources with this topic for ranked video recommendations "
                   "(requires YOUTUBE_API_KEY to be configured).",
            topic=topic,
        ))
    for skill in request.weak_skills:
        items.append(ImprovementItemOut(
            type="article", title=f"Documentation/articles: {skill}",
            reason=f"'{skill}' appears in your target role's requirements but not in your profile.",
            topic=skill,
        ))
    if request.weak_topics:
        items.append(ImprovementItemOut(
            type="mock_interview", title="Take another mock interview",
            reason="Re-attempt a mock interview focused on your weak topics once you've reviewed them.",
            topic=", ".join(request.weak_topics),
        ))

    return ImprovementResponse(student_id=request.student_id, recommendations=items)
