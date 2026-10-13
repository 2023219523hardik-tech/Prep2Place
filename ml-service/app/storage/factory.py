"""Factory pattern: builds the configured ObjectStorage implementation from settings."""
from app.config.settings import get_settings
from app.storage.base import ObjectStorage
from app.storage.local_storage import LocalObjectStorage


def get_storage() -> ObjectStorage:
    settings = get_settings()
    if settings.storage_backend == "minio":
        from app.storage.minio_storage import MinioObjectStorage
        return MinioObjectStorage(
            endpoint=settings.minio_endpoint, access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key, bucket=settings.minio_bucket, secure=settings.minio_secure,
        )
    return LocalObjectStorage(settings.local_storage_dir)
