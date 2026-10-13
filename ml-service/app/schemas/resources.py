from pydantic import BaseModel


class ResourceRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    max_results: int = 5
    target_duration_minutes: int = 20


class RankedResourceOut(BaseModel):
    video_id: str
    title: str
    channel: str
    score: float
    reason: str
    topic: str
    difficulty: str


class ResourceResponse(BaseModel):
    topic: str
    resources: list[RankedResourceOut]
    source: str  # "youtube_api" | "no_api_key_configured"
