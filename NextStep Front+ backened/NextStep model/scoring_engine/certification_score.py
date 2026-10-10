"""
Certification Score Calculator for NextStep Scoring Engine.
Evaluates how valuable a student's certifications are for a target career.
"""

from typing import Any, Dict, List, Optional

from skill_graph.graph import BaseSkillGraph, default_skill_graph
from skill_graph.schemas import NodeType, RelationType


# Career-relevant certifications mapping
CAREER_CERTIFICATIONS = {
    "Cybersecurity Analyst": [
        "comptia security+", "comptia network+", "ceh", "certified ethical hacker",
        "oscp", "cissp", "comptia cysa+", "cisco ccna", "ccna",
        "security+", "network+", "pnpt",
    ],
    "Backend Developer": [
        "aws certified developer", "aws certified solutions architect",
        "azure developer associate", "google cloud associate",
        "mongodb certified developer", "oracle certified professional",
    ],
    "DevOps Engineer": [
        "aws certified devops", "docker certified associate", "cka",
        "certified kubernetes administrator", "hashicorp terraform associate",
        "aws solutions architect", "azure devops engineer",
        "google cloud professional cloud devops engineer",
    ],
    "Data Analyst": [
        "google data analytics", "microsoft power bi", "pl-300",
        "aws data analytics", "tableau desktop specialist",
        "sas certified", "ibm data analyst",
    ],
    "AI/ML Engineer": [
        "google professional machine learning", "aws machine learning specialty",
        "tensorflow developer certificate", "deeplearning.ai",
        "azure ai engineer associate",
    ],
    "Cloud Engineer": [
        "aws solutions architect", "azure administrator", "google cloud professional",
        "aws cloud practitioner", "comptia cloud+",
    ],
}


def calculate_certification_score(
    certifications: List[str],
    career_name: str,
) -> Dict[str, Any]:
    """
    Calculate certification value score.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - relevant_certs: list of matched certifications
        - details: scoring breakdown
    """
    if not certifications:
        return {
            "score": 30.0,  # Not having certs isn't a dealbreaker for juniors
            "relevant_certs": [],
            "details": {"reason": "No certifications provided; baseline score for entry-level"},
        }

    relevant_keywords = CAREER_CERTIFICATIONS.get(career_name, [])
    relevant_certs = []

    for cert in certifications:
        if not cert:
            continue
        cert_lower = cert.strip().lower()
        for kw in relevant_keywords:
            if kw in cert_lower or cert_lower in kw:
                relevant_certs.append(cert.strip())
                break

    total = len(certifications)
    relevant_count = len(relevant_certs)

    if relevant_count > 0:
        # Having relevant certs is very valuable
        raw_score = 60.0 + min(40.0, relevant_count * 20.0)
    elif total > 0:
        # Having any certs shows initiative
        raw_score = 40.0
    else:
        raw_score = 30.0

    return {
        "score": round(min(100.0, raw_score), 2),
        "relevant_certs": relevant_certs,
        "details": {
            "total_certs": total,
            "relevant_count": relevant_count,
        },
    }
