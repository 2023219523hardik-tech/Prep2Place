"""
Lightweight in-process sliding-window rate limiter — genuinely functional with no external
dependency (no Redis required), suitable for a single-instance deployment. For multi-instance
production deployments behind a load balancer, back this with Redis instead (swap the
in-memory dict below for Redis INCR/EXPIRE) without changing the middleware's interface.
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.responses import JSONResponse

from app.config.settings import get_settings

_hits: dict[str, deque] = defaultdict(deque)


async def rate_limit_middleware(request: Request, call_next):
    settings = get_settings()
    limit = settings.rate_limit_per_minute
    client_key = request.client.host if request.client else "unknown"

    now = time.time()
    window = _hits[client_key]
    while window and now - window[0] > 60:
        window.popleft()

    if len(window) >= limit:
        return JSONResponse(
            status_code=429,
            content={"error_code": "rate_limit_exceeded", "message": "Too many requests, slow down."},
        )

    window.append(now)
    return await call_next(request)
