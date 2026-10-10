"""
Comprehensive Integration Tests for NextStep End-to-End Recommendation Pipeline.
Tests:
1. Pipeline initialization & singletons
2. Recommendation pipeline execution with realistic student profiles:
   - Cybersecurity enthusiast
   - Backend developer aspirant
   - General student profile
3. RAG inclusion vs bypass flag (include_rag=True / include_rag=False)
4. Fast career ranking without RAG
5. FastAPI /api/recommend endpoint via TestClient:
   - Happy path with full profile
   - Minimal profile with only skills
   - Custom careers list
   - Error handling & validation
"""

import os
import sys
import pytest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Use mock LLM provider for tests
os.environ["LLM_PROVIDER"] = "mock"

from fastapi.testclient import TestClient
from main import app
from api.recommendation_pipeline import (
    RecommendationPipeline,
    get_recommendation_pipeline,
)

client = TestClient(app)


def test_recommendation_pipeline_singleton():
    p1 = get_recommendation_pipeline()
    p2 = get_recommendation_pipeline()
    assert p1 is p2


def test_recommendation_pipeline_cybersecurity():
    pipeline = get_recommendation_pipeline()

    profile = {
        "skills": [
            {"skill": "Networking", "level": 3},
            {"skill": "Linux", "level": 3},
            {"skill": "Python", "level": 2},
            {"skill": "Security Fundamentals", "level": 3},
        ],
        "interests": ["Cybersecurity", "Network Security", "Penetration Testing"],
        "education": "B.Tech Computer Science",
        "projects": ["Wireshark Packet Sniffer", "Home Virtual SOC Lab"],
        "certifications": ["CompTIA Security+"],
        "experience_level": "beginner",
        "target_career": "Cybersecurity Analyst",
    }

    result = pipeline.recommend(
        profile=profile,
        careers_to_evaluate=["Cybersecurity Analyst", "Backend Developer", "Data Analyst"],
        top_n=3,
        include_rag=True,
    )

    assert len(result.ranked_careers) == 3
    # Cybersecurity Analyst should be ranked #1
    top = result.ranked_careers[0]
    assert top["career"] == "Cybersecurity Analyst"
    assert top["rank"] == 1
    assert top["final_score"] > 60.0
    assert "score_breakdown" in top
    assert top["score_breakdown"]["preference_score"] == 100.0
    assert top["confidence"] in ["high", "medium"]

    # Check RAG guidance output
    assert result.rag_guidance != ""
    assert isinstance(result.rag_sources, list)
    assert len(result.student_skills_extracted) >= 4
    assert result.pipeline_metadata["status"] == "success"


def test_recommendation_pipeline_backend():
    pipeline = get_recommendation_pipeline()

    profile = {
        "skills": [
            {"skill": "Python", "level": 4},
            {"skill": "SQL", "level": 3},
            {"skill": "Git", "level": 3},
            {"skill": "Docker", "level": 2},
            {"skill": "Backend Development", "level": 3},
        ],
        "interests": ["Software Engineering", "Backend Development", "APIs"],
        "education": "B.Tech Information Technology",
        "projects": ["FastAPI REST Microservice with PostgreSQL"],
        "certifications": ["AWS Certified Developer"],
        "experience_level": "junior",
        "target_career": "Backend Developer",
    }

    result = pipeline.recommend(
        profile=profile,
        top_n=2,
        include_rag=False,
    )

    assert len(result.ranked_careers) == 2
    assert result.ranked_careers[0]["career"] == "Backend Developer"
    assert result.rag_guidance == ""  # RAG was skipped
    assert result.pipeline_metadata["rag_enabled"] is False


def test_api_recommend_endpoint_full():
    payload = {
        "skills": [
            {"skill": "Networking", "level": 3},
            {"skill": "Linux", "level": 3},
            {"skill": "Python", "level": 2},
        ],
        "interests": ["Cybersecurity", "Incident Response"],
        "education": "B.Tech Computer Science",
        "projects": ["Configured Splunk SIEM on Ubuntu"],
        "certifications": ["CompTIA Security+"],
        "experience_level": "entry-level",
        "target_career": "Cybersecurity Analyst",
        "careers_to_evaluate": ["Cybersecurity Analyst", "DevOps Engineer"],
        "include_rag": True,
    }

    response = client.post("/api/recommend", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "ranked_careers" in data
    assert len(data["ranked_careers"]) == 2

    top = data["ranked_careers"][0]
    assert top["career"] == "Cybersecurity Analyst"
    assert top["rank"] == 1
    assert "score_breakdown" in top
    assert "matched_skills" in top
    assert "recommended_next_skills" in top
    assert "learning_path_stages" in top

    assert "rag_guidance" in data
    assert "pipeline_metadata" in data
    assert data["pipeline_metadata"]["total_careers_evaluated"] == 2


def test_api_recommend_endpoint_minimal():
    payload = {
        "skills": [
            {"skill": "Python", "level": 2},
        ],
        "interests": [],
        "projects": [],
        "certifications": [],
        "include_rag": False,
    }

    response = client.post("/api/recommend", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert len(data["ranked_careers"]) > 0
    assert data["rag_guidance"] == ""


def test_api_scoring_rank_endpoint():
    payload = {
        "skills": [
            {"skill": "Python", "level": 3},
            {"skill": "SQL", "level": 2},
        ],
        "interests": ["Data Analytics"],
        "careers_to_evaluate": ["Data Analyst", "Cybersecurity Analyst"],
    }
    response = client.post("/api/scoring/rank", json=payload)
    assert response.status_code == 200
    ranked = response.json()
    assert len(ranked) == 2
    assert ranked[0]["career"] == "Data Analyst"
    assert ranked[0]["rank"] == 1


def test_api_scoring_single_career_endpoint():
    payload = {
        "career": "Cybersecurity Analyst",
        "skills": [
            {"skill": "Networking", "level": 3},
            {"skill": "Linux", "level": 3},
        ],
        "interests": ["Cybersecurity"],
        "education": "B.Tech Computer Science",
        "target_career": "Cybersecurity Analyst",
    }
    response = client.post("/api/scoring/career", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["career"] == "Cybersecurity Analyst"
    assert "final_score" in data
    assert "score_breakdown" in data
    assert "gap_analysis" in data
    assert "learning_path" in data

