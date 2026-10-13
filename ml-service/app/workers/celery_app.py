"""
Celery application for async/background processing (interview video analysis can take a
while — the spec calls for this to be queue-backed rather than blocking the HTTP request).

`celery_task_always_eager=True` (the local-dev default) runs tasks synchronously in-process
with NO broker required — so the service is fully runnable without Redis/RabbitMQ locally.
Set it False and point celery_broker_url/celery_result_backend at real Redis/RabbitMQ in
production for true async processing (see docs/DEPLOYMENT.md).
"""
from celery import Celery

from app.config.settings import get_settings

settings = get_settings()

celery_app = Celery(
    settings.service_name,
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.task_always_eager = settings.celery_task_always_eager
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
