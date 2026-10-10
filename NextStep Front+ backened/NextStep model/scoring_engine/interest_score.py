"""
Interest Score Calculator for NextStep Scoring Engine.
Evaluates how well a student's stated interests align with a career domain.
"""

from typing import Any, Dict, List, Optional

from skill_graph.graph import BaseSkillGraph, default_skill_graph
from skill_graph.schemas import NodeType
from skill_graph.skill_normalizer import skill_normalizer


# Career domain interest keywords for matching
CAREER_INTEREST_KEYWORDS: Dict[str, List[str]] = {
    "Cybersecurity Analyst": [
        "cybersecurity", "security", "hacking", "ethical hacking", "penetration testing",
        "networking", "incident response", "threat hunting", "soc", "infosec",
        "digital forensics", "malware", "vulnerability",
    ],
    "Backend Developer": [
        "backend", "server", "api", "database", "web development",
        "software engineering", "programming", "coding", "systems",
    ],
    "DevOps Engineer": [
        "devops", "cloud", "automation", "infrastructure", "containers",
        "deployment", "ci/cd", "kubernetes", "docker", "linux",
    ],
    "Data Analyst": [
        "data", "analytics", "statistics", "visualization", "dashboards",
        "business intelligence", "sql", "reporting", "insights",
    ],
    "Frontend Developer": [
        "frontend", "ui", "ux", "web design", "react", "user interface",
        "javascript", "css", "web development",
    ],
    "AI/ML Engineer": [
        "ai", "artificial intelligence", "machine learning", "deep learning",
        "neural networks", "data science", "ml", "nlp", "computer vision",
    ],
    "Cloud Engineer": [
        "cloud", "aws", "azure", "gcp", "infrastructure", "networking",
        "cloud computing", "serverless",
    ],
}


def calculate_interest_score(
    interests: List[str],
    career_name: str,
    graph: Optional[BaseSkillGraph] = None,
) -> Dict[str, Any]:
    """
    Calculate interest alignment score between student interests and career domain.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - matched_interests: list of interests that align
        - career_domain: the career's domain
        - details: scoring breakdown
    """
    if not interests:
        return {
            "score": 50.0,  # Neutral score when no interests specified
            "matched_interests": [],
            "career_domain": "",
            "details": {"reason": "No interests specified; neutral score applied"},
        }

    g = graph or default_skill_graph
    career_node = g.find_node_by_name(career_name, NodeType.CAREER)
    career_domain = career_node.properties.get("domain", "") if career_node else ""

    # Get career-specific keywords
    keywords = CAREER_INTEREST_KEYWORDS.get(career_name, [])

    # Also add the career domain name itself as a keyword
    if career_domain:
        keywords = keywords + [career_domain.lower()]

    # Normalize interests
    normalized_interests = [i.strip().lower() for i in interests]

    matched = []
    for interest in normalized_interests:
        # Direct keyword match
        for kw in keywords:
            if kw in interest or interest in kw:
                matched.append(interest)
                break
        else:
            # Check if interest matches any skill required for the career
            canonical = skill_normalizer.normalize(interest)
            if canonical:
                from skill_graph.graph_queries import graph_queries
                careers_for_skill = graph_queries.get_careers_for_skill(canonical)
                if career_name in careers_for_skill:
                    matched.append(interest)

    if not keywords:
        # No keywords defined for this career: use domain-based heuristic
        domain_lower = career_domain.lower()
        for interest in normalized_interests:
            if domain_lower and (domain_lower in interest or interest in domain_lower):
                matched.append(interest)

    unique_matched = list(set(matched))
    total_interests = len(normalized_interests)

    # Score: percentage of student interests that align with the career
    if total_interests > 0:
        raw_score = (len(unique_matched) / total_interests) * 100.0
    else:
        raw_score = 50.0

    # Bonus for strong alignment (majority of interests match)
    if len(unique_matched) >= 2:
        raw_score = min(100.0, raw_score + 10.0)

    return {
        "score": round(min(100.0, raw_score), 2),
        "matched_interests": unique_matched,
        "career_domain": career_domain,
        "details": {
            "total_interests": total_interests,
            "matched_count": len(unique_matched),
            "keyword_pool_size": len(keywords),
        },
    }
