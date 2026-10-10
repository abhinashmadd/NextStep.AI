"""
Project Score Calculator for NextStep Scoring Engine.
Evaluates how relevant a student's projects are to a target career.
"""

from typing import Any, Dict, List, Optional

from skill_graph.skill_normalizer import skill_normalizer
from skill_graph.graph_queries import graph_queries
from skill_graph.schemas import NodeType


def calculate_project_score(
    projects: List[str],
    career_name: str,
    student_skills_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Calculate project relevance score.

    Projects are evaluated by:
    1. Whether the project name/description mentions skills required for the career
    2. Whether the project develops skills in the career's domain

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - relevant_projects: list of relevant project names
        - details: scoring breakdown
    """
    if not projects:
        return {
            "score": 20.0,
            "relevant_projects": [],
            "details": {"reason": "No projects specified; low baseline score applied"},
        }

    # Get required skills for the career
    required_skills = graph_queries.get_required_skills(career_name)
    required_skill_names = {r["skill"].lower() for r in required_skills}

    # Also get career domain keywords
    from skill_graph.graph import default_skill_graph
    career_node = default_skill_graph.find_node_by_name(career_name, NodeType.CAREER)
    domain = career_node.properties.get("domain", "").lower() if career_node else ""

    relevant_projects = []
    total_relevance = 0.0

    for project in projects:
        if not project or not project.strip():
            continue

        proj_lower = project.strip().lower()
        relevance = 0.0

        # Check if project mentions required skills
        for req_skill in required_skill_names:
            if req_skill in proj_lower:
                relevance += 0.4
                break

        # Check if project mentions career domain
        if domain and domain in proj_lower:
            relevance += 0.3

        # Check if project mentions career-related keywords
        career_lower = career_name.lower()
        career_words = career_lower.split()
        for word in career_words:
            if len(word) > 3 and word in proj_lower:
                relevance += 0.2
                break

        # Check via skill normalizer if project text contains recognized skills
        for canonical in skill_normalizer.get_all_canonical():
            aliases = skill_normalizer.get_aliases(canonical)
            for alias in aliases:
                if alias in proj_lower:
                    if canonical.lower() in required_skill_names:
                        relevance += 0.3
                    else:
                        relevance += 0.1
                    break

        if relevance > 0:
            relevant_projects.append(project.strip())
            total_relevance += min(1.0, relevance)

    # Score calculation
    project_count = len(projects)
    relevant_count = len(relevant_projects)

    if project_count > 0 and relevant_count > 0:
        relevance_ratio = relevant_count / project_count
        avg_relevance = total_relevance / relevant_count if relevant_count > 0 else 0
        raw_score = (relevance_ratio * 50.0) + (avg_relevance * 30.0)
    else:
        raw_score = 15.0

    # Bonus for having multiple relevant projects
    if relevant_count >= 2:
        raw_score = min(100.0, raw_score + 15.0)
    elif relevant_count == 1:
        raw_score = min(100.0, raw_score + 5.0)

    # Baseline: having any project at all is worth something
    raw_score = max(25.0, raw_score)

    return {
        "score": round(min(100.0, raw_score), 2),
        "relevant_projects": relevant_projects,
        "details": {
            "total_projects": project_count,
            "relevant_count": relevant_count,
            "total_relevance": round(total_relevance, 2),
        },
    }
