"""
FastAPI application entrypoint. Assembles routers, middleware (CORS, rate limiting, request
ID + latency logging), and exception handlers. Run with:
    uvicorn app.main:app --reload --port 8000
"""
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import (
    health, improvements, interview, interview_questions, legacy_compat, mock_test, resources, roadmap,
)
from app.api.v1.health import record_request
from app.config.settings import get_settings
from app.core.exceptions import MlServiceError
from app.core.logging import configure_logging, request_id_var
from app.core.rate_limit import rate_limit_middleware
from app.models.session import init_models

settings = get_settings()
configure_logging(level=settings.log_level, json_output=settings.log_json)

app = FastAPI(
    title="Placement Platform ML Service",
    description="Real ML/CV/NLP microservice for the AI-based placement preparation platform. "
                "See /docs for interactive OpenAPI documentation and the README for an honest "
                "breakdown of what's genuinely implemented vs. documented interfaces pending real models.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    token = request_id_var.set(request_id)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        latency_ms = (time.perf_counter() - start) * 1000
        record_request(request.url.path, latency_ms)
        request_id_var.reset(token)
    response.headers["X-Request-ID"] = request_id
    return response


app.middleware("http")(rate_limit_middleware)


@app.exception_handler(MlServiceError)
async def handle_ml_service_error(request: Request, exc: MlServiceError):
    return JSONResponse(status_code=exc.status_code,
                         content={"error_code": exc.error_code, "message": exc.message, "details": exc.details})


@app.on_event("startup")
async def on_startup():
    await init_models()


app.include_router(health.router, prefix="")
app.include_router(legacy_compat.router, prefix="")
app.include_router(roadmap.router, prefix=settings.api_v1_prefix)
app.include_router(resources.router, prefix=settings.api_v1_prefix)
app.include_router(mock_test.router, prefix=settings.api_v1_prefix)
app.include_router(interview.router, prefix=settings.api_v1_prefix)
app.include_router(improvements.router, prefix=settings.api_v1_prefix)
app.include_router(interview_questions.router, prefix=settings.api_v1_prefix)
