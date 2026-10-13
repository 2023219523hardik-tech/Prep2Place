"""
JSON structured logging — genuinely functional with only the Python standard library
(no external dependency needed), so it works regardless of what else is installed.
Includes request ID, latency, and arbitrary structured fields via `extra`.
"""
import json
import logging
import sys
import time
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        # Merge any structured extras (e.g. logger.info("...", extra={"latency_ms": 12.3}))
        for key, value in record.__dict__.items():
            if key in (
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message",
            ):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", json_output: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if json_output else logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s [%(message)s]"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


class Timer:
    """Context manager for measuring and logging operation latency, e.g. model inference time."""
    def __init__(self, logger: logging.Logger, operation: str):
        self.logger = logger
        self.operation = operation
        self.start = 0.0
        self.elapsed_ms = 0.0

    def __enter__(self) -> "Timer":
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.elapsed_ms = (time.perf_counter() - self.start) * 1000
        self.logger.info(f"{self.operation} completed", extra={"latency_ms": round(self.elapsed_ms, 2)})
