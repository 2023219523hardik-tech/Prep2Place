"""Domain exceptions mapped to HTTP responses by the FastAPI exception handlers in app/main.py."""


class MlServiceError(Exception):
    """Base class for all handled application errors."""
    status_code: int = 500
    error_code: str = "internal_error"

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationFailedError(MlServiceError):
    status_code = 422
    error_code = "validation_failed"


class ResourceNotFoundError(MlServiceError):
    status_code = 404
    error_code = "not_found"


class UnauthorizedError(MlServiceError):
    status_code = 401
    error_code = "unauthorized"


class RateLimitExceededError(MlServiceError):
    status_code = 429
    error_code = "rate_limit_exceeded"


class UpstreamServiceError(MlServiceError):
    """Raised when an external dependency (YouTube API, Whisper, object storage) fails."""
    status_code = 502
    error_code = "upstream_service_error"


class ModelNotAvailableError(MlServiceError):
    """Raised when a requested capability needs a model/weights this deployment doesn't have
    loaded (e.g. a deep object detector or a real ASR engine) — see docs/MODELS.md."""
    status_code = 501
    error_code = "model_not_available"
