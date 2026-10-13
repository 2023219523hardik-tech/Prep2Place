"""
Integration tests against the real FastAPI app via TestClient. Requires the full
requirements.txt to be installed (fastapi, sqlalchemy, etc.) — NOT runnable in the offline
sandbox this service was developed in (see README). Run with: pytest tests/integration -v
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_metrics_endpoint_returns_prometheus_format():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "ml_service_uptime_seconds" in response.text


def test_mock_test_analysis_endpoint():
    payload = {
        "student_id": "s1",
        "attempts": [
            {"question_id": "q1", "topic": "Arrays", "difficulty": "EASY", "correct": True, "time_taken_seconds": 30},
            {"question_id": "q2", "topic": "DP", "difficulty": "HARD", "correct": False, "time_taken_seconds": 100},
        ],
    }
    response = client.post("/api/v1/analyze/mock-test", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accuracy"] == 50.0
    assert "DP" in body["weak_topics"]


def test_roadmap_endpoint():
    payload = {
        "profile": {"student_id": "s1", "known_skills": ["java", "sql"]},
        "target_role": "Backend Developer",
        "job_description": "Need Java, Spring Boot, SQL, Docker, AWS skills.",
        "hours_per_week": 10,
    }
    response = client.post("/api/v1/roadmap", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "spring boot" in body["missing_topics"]


def test_generate_report_without_prior_analysis_returns_404():
    response = client.post("/api/v1/generate/report", params={"session_id": "nonexistent"})
    assert response.status_code == 404
