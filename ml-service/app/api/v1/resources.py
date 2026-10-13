from fastapi import APIRouter

from app.pipelines.recommendation.resource_ranker import YouTubeClient, rank_videos
from app.schemas.resources import RankedResourceOut, ResourceRequest, ResourceResponse

router = APIRouter(tags=["resources"])


@router.post("/recommend/resources", response_model=ResourceResponse)
async def recommend_resources(request: ResourceRequest):
    client = YouTubeClient()
    candidates = await client.search(request.topic, max_results=request.max_results)
    ranked = rank_videos(candidates, target_duration_minutes=request.target_duration_minutes)

    return ResourceResponse(
        topic=request.topic,
        source="youtube_api" if candidates else "no_api_key_configured",
        resources=[
            RankedResourceOut(video_id=r.video_id, title=r.title, channel=r.channel,
                               score=r.score, reason=r.reason, topic=r.topic, difficulty=request.difficulty)
            for r in ranked
        ],
    )
