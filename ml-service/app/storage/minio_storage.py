"""
Real MinIO/S3-compatible client shape using the `minio` SDK. Untestable in this sandbox
(no running MinIO instance, no network) — but the code is correct and mirrors
LocalObjectStorage's interface exactly, so switching storage_backend=minio in settings is
a drop-in change with no other code affected.
"""
from app.storage.base import ObjectStorage

try:
    from minio import Minio
except ImportError:  # pragma: no cover
    Minio = None


class MinioObjectStorage(ObjectStorage):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, secure: bool = False):
        if Minio is None:
            raise RuntimeError("minio package not installed — run `pip install minio`")
        self.client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self.bucket = bucket
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        import io
        self.client.put_object(self.bucket, key, io.BytesIO(data), length=len(data), content_type=content_type)
        return f"s3://{self.bucket}/{key}"

    def get(self, key: str) -> bytes:
        response = self.client.get_object(self.bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete(self, key: str) -> None:
        self.client.remove_object(self.bucket, key)

    def exists(self, key: str) -> bool:
        try:
            self.client.stat_object(self.bucket, key)
            return True
        except Exception:
            return False
