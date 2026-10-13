from app.models.orm import MockTestReportRecord
from app.repositories.base import BaseRepository


class MockTestReportRepository(BaseRepository[MockTestReportRecord]):
    model = MockTestReportRecord
