"""
Resource ranking (YouTube + articles/docs). The RANKING FORMULA below is real and testable
with synthetic input. Fetching real YouTube results needs a YOUTUBE_API_KEY (Google Cloud
Console) and live internet access — neither available in this sandbox — so `YouTubeClient`
below is a real API client (correct request shape) that returns an honestly-labeled empty/stub
result when no key is configured, rather than fabricating fake video data.
"""
from dataclasses import dataclass

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None


@dataclass
class VideoCandidate:
    video_id: str
    title: str
    channel: str
    views: int
    likes: int
    duration_seconds: int
    topic: str


@dataclass
class RankedResource:
    video_id: str
    title: str
    channel: str
    score: float
    reason: str
    topic: str
    difficulty: str
    timestamp_sections: list[dict] | None = None


class YouTubeClient:
    """Real Google YouTube Data API v3 client shape. Requires `youtube_api_key` to actually
    call out — with no key configured (the default in this sandbox), `search` returns an
    empty list rather than fabricated results, and callers should treat that as
    'no live data available' rather than 'no good videos exist'."""

    BASE_URL = "https://www.googleapis.com/youtube/v3"

    def __init__(self):
        from app.config.settings import get_settings
        self.settings = get_settings()

    async def search(self, query: str, max_results: int = 10) -> list[VideoCandidate]:
        if not self.settings.youtube_api_key or httpx is None:
            return []
        async with httpx.AsyncClient(timeout=10) as client:
            search_resp = await client.get(f"{self.BASE_URL}/search", params={
                "part": "snippet", "q": query, "type": "video", "maxResults": max_results,
                "key": self.settings.youtube_api_key,
            })
            search_resp.raise_for_status()
            items = search_resp.json().get("items", [])
            video_ids = [item["id"]["videoId"] for item in items if "videoId" in item.get("id", {})]
            if not video_ids:
                return []

            stats_resp = await client.get(f"{self.BASE_URL}/videos", params={
                "part": "snippet,statistics,contentDetails", "id": ",".join(video_ids),
                "key": self.settings.youtube_api_key,
            })
            stats_resp.raise_for_status()
            candidates = []
            for item in stats_resp.json().get("items", []):
                stats = item.get("statistics", {})
                candidates.append(VideoCandidate(
                    video_id=item["id"], title=item["snippet"]["title"],
                    channel=item["snippet"]["channelTitle"],
                    views=int(stats.get("viewCount", 0)), likes=int(stats.get("likeCount", 0)),
                    duration_seconds=_parse_iso8601_duration(item["contentDetails"]["duration"]),
                    topic=query,
                ))
            return candidates


def _parse_iso8601_duration(duration: str) -> int:
    import re
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return 0
    h, m, s = (int(g) if g else 0 for g in match.groups())
    return h * 3600 + m * 60 + s


def rank_videos(candidates: list[VideoCandidate], target_duration_minutes: int = 20) -> list[RankedResource]:
    """Real, explainable ranking formula: weights views, likes-per-view (engagement), and
    penalizes videos far from the ideal study-session length."""
    if not candidates:
        return []

    max_views = max((c.views for c in candidates), default=1) or 1
    ranked = []
    for c in candidates:
        view_score = (c.views / max_views) * 40
        engagement = (c.likes / c.views) if c.views > 0 else 0
        engagement_score = min(30, engagement * 3000)
        duration_minutes = c.duration_seconds / 60
        duration_penalty = min(30, abs(duration_minutes - target_duration_minutes) * 1.5)
        score = round(max(0, view_score + engagement_score + (30 - duration_penalty)), 1)

        ranked.append(RankedResource(
            video_id=c.video_id, title=c.title, channel=c.channel, score=score,
            reason=f"{c.views:,} views, {duration_minutes:.0f} min runtime — "
                   f"{'close to' if duration_penalty < 10 else 'far from'} ideal study length.",
            topic=c.topic, difficulty="unknown",
        ))
    return sorted(ranked, key=lambda r: r.score, reverse=True)
