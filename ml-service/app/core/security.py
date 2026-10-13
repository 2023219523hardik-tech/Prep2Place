"""
JWT verification for requests coming from the Spring Boot backend. The backend signs tokens
with HS256 using `app.jwt.secret` (see backend/src/main/resources/application.yml); this
service must be configured with the SAME secret via ML_JWT_SECRET to validate them.

Verification is OFF by default (`require_jwt=False`) for frictionless local development —
the backend already sits behind its own auth, and this service is typically only reachable
on an internal network. Turn it on in production via ML_REQUIRE_JWT=true.
"""
from fastapi import Header, HTTPException, status

from app.config.settings import get_settings

try:
    import jwt as pyjwt  # PyJWT
except ImportError:  # pragma: no cover - only triggered if PyJWT isn't installed
    pyjwt = None


def verify_bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    """FastAPI dependency: validates the Authorization header when require_jwt is enabled.
    Returns the token subject (email) on success, or None when JWT verification is disabled."""
    settings = get_settings()
    if not settings.require_jwt:
        return None

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    if pyjwt is None:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="PyJWT not installed on this deployment")

    token = authorization.removeprefix("Bearer ")
    try:
        payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except pyjwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")
