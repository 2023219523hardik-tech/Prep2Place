"""Liveness/readiness + Prometheus-format metrics. Metrics are hand-rolled in the exposition
text format (no `prometheus_client` dependency needed) so this works even on a minimal install."""
import time

from fastapi import APIRouter
from starlette.responses import PlainTextResponse

from app.config.settings import get_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])

_START_TIME = time.time()
_REQUEST_COUNTS: dict[str, int] = {}
_LATENCY_SUM_MS: dict[str, float] = {}


def record_request(endpoint: str, latency_ms: float) -> None:
    _REQUEST_COUNTS[endpoint] = _REQUEST_COUNTS.get(endpoint, 0) + 1
    _LATENCY_SUM_MS[endpoint] = _LATENCY_SUM_MS.get(endpoint, 0.0) + latency_ms


@router.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    return HealthResponse(
        status="ok", service=settings.service_name, version="1.0.0",
        dependencies={
            "database": settings.database_url.split("://")[0],
            "storage_backend": settings.storage_backend,
            "celery_mode": "eager (in-process)" if settings.celery_task_always_eager else "broker-backed",
        },
    )


@router.get("/health/live")
async def liveness():
    return {"status": "alive", "uptime_seconds": round(time.time() - _START_TIME, 1)}


@router.get("/health/ready")
async def readiness():
    # In production, check DB/Redis/storage connectivity here before reporting ready.
    return {"status": "ready"}


@router.get("/metrics")
async def metrics():
    lines = [
        "# HELP ml_service_requests_total Total requests handled per endpoint",
        "# TYPE ml_service_requests_total counter",
    ]
    for endpoint, count in _REQUEST_COUNTS.items():
        lines.append(f'ml_service_requests_total{{endpoint="{endpoint}"}} {count}')

    lines += ["# HELP ml_service_latency_ms_sum Cumulative latency per endpoint in ms", "# TYPE ml_service_latency_ms_sum counter"]
    for endpoint, total_ms in _LATENCY_SUM_MS.items():
        lines.append(f'ml_service_latency_ms_sum{{endpoint="{endpoint}"}} {total_ms}')

    lines.append(f"ml_service_uptime_seconds {round(time.time() - _START_TIME, 1)}")
    return PlainTextResponse("\n".join(lines) + "\n")
