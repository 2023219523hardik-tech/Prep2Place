from app.models.orm import InterviewFrameRecord, InterviewReportRecord
from app.repositories.base import BaseRepository


class InterviewFrameRepository(BaseRepository[InterviewFrameRecord]):
    model = InterviewFrameRecord


class InterviewReportRepository(BaseRepository[InterviewReportRecord]):
    model = InterviewReportRecord
