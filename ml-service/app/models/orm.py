"""
SQLAlchemy ORM models (async engine). Works against SQLite for zero-config local dev
(DATABASE_URL default) or Postgres in production — same models, just point DATABASE_URL
at postgresql+asyncpg://... (see docs/DEPLOYMENT.md).
"""
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class InterviewFrameRecord(Base):
    """One persisted 'important' frame from an interview video (see frame_sampler.is_important)."""
    __tablename__ = "interview_frames"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), index=True, nullable=False)
    timestamp = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    behavior_label = Column(String(32), nullable=False)
    reason = Column(String(500))
    bounding_boxes = Column(JSON)
    storage_key = Column(String(500))  # where the JPEG bytes live (see app/storage)
    created_at = Column(DateTime, default=datetime.utcnow)


class MockTestReportRecord(Base):
    __tablename__ = "mock_test_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(64), index=True, nullable=False)
    accuracy = Column(Float, nullable=False)
    report_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewReportRecord(Base):
    __tablename__ = "interview_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    overall_score = Column(Float, nullable=False)
    report_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PredictionLogRecord(Base):
    """Every prediction this service returns gets logged here for auditability/model monitoring."""
    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    endpoint = Column(String(128), nullable=False)
    request_id = Column(String(64), index=True)
    latency_ms = Column(Float)
    input_summary = Column(JSON)
    output_summary = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
