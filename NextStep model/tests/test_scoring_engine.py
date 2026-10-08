"""
Comprehensive Test Suite for NextStep Scoring Engine.
Tests:
1. Weight configuration and normalization
2. Individual dimension scoring:
   - Skill score (matched, weak, missing, critical gaps)
   - Interest score (keywords, skill alignment, neutral default)
   - Education score (levels, field bonus, missing fallback)
   - Project score (relevant keywords, skill matching, baseline)
   - Certification score (relevant certs, initiative baseline)
   - Experience score (named levels, regex years, unknown fallback)
   - Preference score (target career bonus, interest alignment)
3. Career Ranker (sorting, ranking, confidence tiers, diagnostic payload)
4. Core Scoring Engine (single career scoring, multi-career ranking, Skill Graph integration)
"""

import os
import sys
import pytest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scoring_engine.weights import ScoringWeights, DEFAULT_WEIGHTS
from scoring_engine.skill_score import calculate_skill_score
from scoring_engine.interest_score import calculate_interest_score
from scoring_engine.education_score import calculate_education_score
from scoring_engine.project_score import calculate_project_score
from scoring_engine.certification_score import calculate_certification_score
from scoring_engine.experience_score import calculate_experience_score
from scoring_engine.preference_score import calculate_preference_score
from scoring_engine.career_ranker import CareerRanker, _compute_confidence
from scoring_engine.engine import ScoringEngine, get_scoring_engine

from skill_graph.schemas import StudentSkill, SkillGapAnalysisResult


# 1. Weight Configuration Tests
def test_default_weights():
    w = DEFAULT_WEIGHTS
    total = (
        w.skill_weight + w.interest_weight + w.education_weight
        + w.project_weight + w.certification_weight
        + w.experience_weight + w.preference_weight
    )
    assert round(total, 2) == 1.00
    d = w.to_dict()
    assert "skill" in d
    assert d["skill"] == 0.35


def test_custom_weights_normalization():
    custom = ScoringWeights(
        skill_weight=50.0,
        interest_weight=20.0,
        education_weight=10.0,
        project_weight=10.0,
        certification_weight=5.0,
        experience_weight=5.0,
        preference_weight=0.0,
    )
    norm = custom.normalize()
    total = (
        norm.skill_weight + norm.interest_weight + norm.education_weight
        + norm.project_weight + norm.certification_weight
        + norm.experience_weight + norm.preference_weight
    )
    assert round(total, 2) == 1.00
    assert norm.skill_weight == 0.50
    assert norm.preference_weight == 0.0


def test_zero_weights_normalization():
    zero = ScoringWeights(
        skill_weight=0, interest_weight=0, education_weight=0,
        project_weight=0, certification_weight=0, experience_weight=0, preference_weight=0
    )
    norm = zero.normalize()
    # Falls back to defaults
    assert norm.skill_weight == DEFAULT_WEIGHTS.skill_weight


# 2. Skill Score Tests
def test_skill_score_calculation():
    # Synthetic gap result
    gap_result = SkillGapAnalysisResult(
        target_career="Cybersecurity Analyst",
        matched_skills=[
            {"skill": "Networking", "current_level": 3, "required_level": 3, "importance": 0.95},
            {"skill": "Linux", "current_level": 3, "required_level": 3, "importance": 0.90},
        ],
        weak_skills=[
            {"skill": "Python", "current_level": 1, "required_level": 2, "importance": 0.70},
        ],
        missing_skills=[
            {"skill": "SIEM", "current_level": 0, "required_level": 2, "importance": 0.90},
        ],
        prerequisite_gaps=[],
        next_best_skills=[],
        metrics={
            "skill_match_score": 65.0,
            "required_skill_coverage": 75.0,
            "prerequisite_completion": 100.0,
            "critical_skill_gap_count": 1,
            "total_requirements": 4,
        },
    )

    res = calculate_skill_score(gap_result)
    assert "score" in res
    assert 0.0 <= res["score"] <= 100.0
    assert "Networking" in res["matched_skills"]
    assert "Python" in res["weak_skills"]
    assert "SIEM" in res["missing_skills"]
    assert "SIEM" in res["critical_gaps"]  # importance 0.90 >= 0.85
    assert res["details"]["matched_count"] == 2


# 3. Interest Score Tests
def test_interest_score_matching():
    # Matching cybersecurity interests
    res = calculate_interest_score(
        interests=["Ethical Hacking", "Networking", "Network Security"],
        career_name="Cybersecurity Analyst",
    )
    assert res["score"] >= 70.0
    assert len(res["matched_interests"]) >= 2
    assert res["career_domain"] == "Cybersecurity"


def test_interest_score_empty():
    res = calculate_interest_score(interests=[], career_name="Backend Developer")
    assert res["score"] == 50.0  # Neutral baseline
    assert res["matched_interests"] == []


# 4. Education Score Tests
def test_education_score_bachelor():
    res = calculate_education_score("B.Tech in Computer Science", "Backend Developer")
    assert res["score"] >= 80.0
    assert res["education_level"] == 3
    assert res["details"]["matched_field"] is not None


def test_education_score_underqualified():
    res = calculate_education_score("High School Diploma", "AI/ML Engineer")
    # AI/ML requires level 4 (Master)
    assert res["score"] < 50.0


def test_education_score_none():
    res = calculate_education_score(None, "Cybersecurity Analyst")
    assert res["score"] == 40.0


# 5. Project Score Tests
def test_project_score_relevant():
    projects = [
        "Built a Network Packet Sniffer using Wireshark and Python",
        "Configured a Home Virtual SOC Lab with Splunk",
    ]
    res = calculate_project_score(projects, "Cybersecurity Analyst")
    assert res["score"] >= 60.0
    assert len(res["relevant_projects"]) >= 1


def test_project_score_empty():
    res = calculate_project_score([], "Backend Developer")
    assert res["score"] == 20.0
    assert res["relevant_projects"] == []


# 6. Certification Score Tests
def test_certification_score_relevant():
    certs = ["CompTIA Security+", "AWS Solutions Architect"]
    res = calculate_certification_score(certs, "Cybersecurity Analyst")
    assert res["score"] >= 70.0
    assert "CompTIA Security+" in res["relevant_certs"]


def test_certification_score_empty():
    res = calculate_certification_score([], "DevOps Engineer")
    assert res["score"] == 30.0


# 7. Experience Score Tests
def test_experience_score_levels():
    assert calculate_experience_score("beginner", "Backend Developer")["score"] == 30.0
    assert calculate_experience_score("intermediate", "Backend Developer")["score"] == 60.0
    assert calculate_experience_score("expert", "Backend Developer")["score"] == 95.0
    assert calculate_experience_score("3 years", "Backend Developer")["score"] == 55.0
    assert calculate_experience_score(None, "Backend Developer")["score"] == 25.0


# 8. Preference Score Tests
def test_preference_score():
    res_exact = calculate_preference_score("Cybersecurity Analyst", "Cybersecurity Analyst")
    assert res_exact["score"] == 100.0
    assert res_exact["is_target"] is True

    res_partial = calculate_preference_score("Security", "Cybersecurity Analyst")
    assert res_partial["score"] == 100.0

    res_diff = calculate_preference_score("Frontend Developer", "Cybersecurity Analyst")
    assert res_diff["score"] == 40.0


# 9. Career Ranker Tests
def test_career_ranker():
    ranker = CareerRanker()
    career_scores = [
        {
            "career": "Data Analyst",
            "final_score": 58.5,
            "score_breakdown": {"skill_score": 50.0},
            "skill_data": {"critical_gaps": ["SQL"]},
            "interest_data": {"matched_interests": []},
            "project_data": {"relevant_projects": []},
            "certification_data": {"relevant_certs": []},
            "gap_analysis": {"next_best_skills": []},
            "learning_path": {"stages": []},
        },
        {
            "career": "Cybersecurity Analyst",
            "final_score": 85.0,
            "score_breakdown": {"skill_score": 88.0},
            "skill_data": {"critical_gaps": []},
            "interest_data": {"matched_interests": ["Security"]},
            "project_data": {"relevant_projects": ["SOC Lab"]},
            "certification_data": {"relevant_certs": ["Security+"]},
            "gap_analysis": {"next_best_skills": [{"name": "SIEM", "priority": 1}]},
            "learning_path": {"stages": [{"stage": 1, "skills": ["SIEM"]}]},
        },
        {
            "career": "Backend Developer",
            "final_score": 72.0,
            "score_breakdown": {"skill_score": 70.0},
            "skill_data": {"critical_gaps": ["Backend Development"]},
            "interest_data": {"matched_interests": []},
            "project_data": {"relevant_projects": []},
            "certification_data": {"relevant_certs": []},
            "gap_analysis": {"next_best_skills": []},
            "learning_path": {"stages": []},
        },
    ]

    ranked = ranker.rank_careers(career_scores)
    assert len(ranked) == 3
    assert ranked[0].career == "Cybersecurity Analyst"
    assert ranked[0].rank == 1
    assert ranked[0].confidence == "high"

    assert ranked[1].career == "Backend Developer"
    assert ranked[1].rank == 2

    assert ranked[2].career == "Data Analyst"
    assert ranked[2].rank == 3


def test_confidence_computation():
    assert _compute_confidence(85.0, 0) == "high"
    assert _compute_confidence(65.0, 1) == "medium"
    assert _compute_confidence(45.0, 3) == "low"


# 10. Core Scoring Engine Integration Test
def test_scoring_engine_single_career():
    engine = get_scoring_engine()
    profile = {
        "skills": [
            {"skill": "Python", "level": 3},
            {"skill": "Linux", "level": 2},
            {"skill": "Networking", "level": 2},
        ],
        "interests": ["Cybersecurity", "Network Security"],
        "education": "B.Tech in Computer Science",
        "projects": ["Network Port Scanner in Python"],
        "certifications": ["CompTIA Security+"],
        "experience_level": "beginner",
        "target_career": "Cybersecurity Analyst",
    }

    result = engine.score_career(profile, "Cybersecurity Analyst")
    assert result["career"] == "Cybersecurity Analyst"
    assert "final_score" in result
    assert 0.0 <= result["final_score"] <= 100.0
    assert "score_breakdown" in result
    assert result["score_breakdown"]["preference_score"] == 100.0
    assert "gap_analysis" in result
    assert "learning_path" in result


def test_scoring_engine_multiple_careers():
    engine = ScoringEngine()
    profile = {
        "skills": [
            {"skill": "Python", "level": 4},
            {"skill": "SQL", "level": 3},
            {"skill": "Git", "level": 3},
            {"skill": "Docker", "level": 2},
        ],
        "interests": ["Backend Development", "Databases"],
        "education": "B.Tech Computer Science",
        "projects": ["REST API with FastAPI and PostgreSQL"],
        "certifications": ["AWS Certified Developer"],
        "experience_level": "junior",
        "target_career": "Backend Developer",
    }

    ranked = engine.score_multiple_careers(
        profile,
        ["Backend Developer", "Cybersecurity Analyst", "Data Analyst"],
    )

    assert len(ranked) == 3
    # Backend Developer should be rank 1 due to strong skill alignment + target preference
    assert ranked[0].career == "Backend Developer"
    assert ranked[0].final_score > ranked[1].final_score
