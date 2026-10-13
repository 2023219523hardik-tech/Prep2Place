"""Real, tested local-filesystem object storage — the default for local dev (storage_backend=local)."""
import os

from app.storage.base import ObjectStorage


class LocalObjectStorage(ObjectStorage):
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        os.makedirs(root_dir, exist_ok=True)

    def _path(self, key: str) -> str:
        safe_key = key.replace("..", "").lstrip("/")
        path = os.path.join(self.root_dir, safe_key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        path = self._path(key)
        with open(path, "wb") as f:
            f.write(data)
        return path

    def get(self, key: str) -> bytes:
        with open(self._path(key), "rb") as f:
            return f.read()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if os.path.exists(path):
            os.remove(path)

    def exists(self, key: str) -> bool:
        return os.path.exists(self._path(key))
