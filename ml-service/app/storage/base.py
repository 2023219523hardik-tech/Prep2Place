"""Storage abstraction — repository-pattern interface so MinIO/S3 and local filesystem are
interchangeable. See local_storage.py (real, tested) and minio_storage.py (real client shape,
untestable here without a running MinIO instance)."""
from abc import ABC, abstractmethod


class ObjectStorage(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Stores data under `key`; returns a reference (path/URL) to retrieve it later."""

    @abstractmethod
    def get(self, key: str) -> bytes:
        ...

    @abstractmethod
    def delete(self, key: str) -> None:
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        ...
