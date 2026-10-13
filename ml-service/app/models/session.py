"""Async SQLAlchemy engine/session factory."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings
from app.models.orm import Base

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.database_url, echo=settings.debug, future=True)
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_factory


async def init_models() -> None:
    """Creates tables if they don't exist — fine for SQLite/dev; use Alembic migrations in
    production against Postgres instead (see docs/DEPLOYMENT.md)."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db_session():
    """FastAPI dependency — yields a session per request."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
