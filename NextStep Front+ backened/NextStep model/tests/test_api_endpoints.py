import os
import sys
import pytest

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from app.services.scoring_service import DeterministicScoringService

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/ai/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model"] == "z-ai/glm-5.3"
    assert data["nvidia_configured"] is True


def test_empty_evidence_validation():
    payload = {
        "student_profile": "B.Tech student",
        "target_career": "Backend Developer",
        "student_evidence": "   ",  # Empty
        "career_requirements": ["Python", "Docker"],
    }
    response = client.post("/api/ai/analyze", json=payload)
    assert response.status_code in [400, 422]


def test_empty_requirements_validation():
    payload = {
        "student_profile": "B.Tech student",
        "target_career": "Backend Developer",
        "student_evidence": "Built a Python backend.",
        "career_requirements": [],
    }
    response = client.post("/api/ai/analyze", json=payload)
    assert response.status_code == 422  # Pydantic min_items validation


def test_deterministic_scoring_calculations():
    demonstrated = ["Python", "FastAPI", "SQLite", "Git"]
    requirements = ["Python", "REST APIs", "SQL", "Git", "Testing", "Docker"]

    matched, missing = DeterministicScoringService.match_skills(demonstrated, requirements)
    assert "Python" in matched
    assert "REST APIs" in matched  # FastAPI aliases REST APIs
    assert "SQL" in matched        # SQLite aliases SQL
    assert "Git" in matched

    assert "Testing" in missing
    assert "Docker" in missing

    score = DeterministicScoringService.calculate_readiness_score(demonstrated, requirements)
    # 4 out of 6 is 66.67% -> rounds to 67
    assert score == 67

    gaps = DeterministicScoringService.resolve_skill_gaps([], demonstrated, requirements)
    assert "Testing" in gaps
    assert "Docker" in gaps
