"""Generic async repository base — CRUD against any ORM model, so concrete repositories
below are thin and consistent (Repository Pattern)."""
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, instance: ModelT) -> ModelT:
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def get(self, id_: int) -> ModelT | None:
        return await self.session.get(self.model, id_)

    async def list_by(self, **filters) -> list[ModelT]:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
