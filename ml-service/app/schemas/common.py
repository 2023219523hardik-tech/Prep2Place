"""Shared Pydantic response envelopes and error schema."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict = {}


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    dependencies: dict[str, str]
