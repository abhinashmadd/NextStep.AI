"""
Skill Score Calculator for NextStep Scoring Engine.
Computes the skill match score by comparing student proficiency against career requirements
using the Skill Graph's gap analysis metrics.
"""

from typing import Any, Dict, List

from skill_graph.schemas import StudentSkill, SkillGapAnalysisResult


def calculate_skill_score(
    gap_result: SkillGapAnalysisResult,
) -> Dict[str, Any]:
    """
    Calculate a normalized skill match score from Skill Graph gap analysis.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - matched_skills: list of matched skill names
        - weak_skills: list of weak skill names
        - missing_skills: list of missing skill names
        - critical_gaps: list of high-importance missing/weak skills
        - details: scoring breakdown dict
    """
    metrics = gap_result.metrics
    matched = gap_result.matched_skills
    weak = gap_result.weak_skills
    missing = gap_result.missing_skills

    # Primary: weighted skill match score from gap analyzer
    raw_score = metrics.get("skill_match_score", 0.0)

    # Coverage bonus: if student covers many of the required skills (even partially)
    coverage = metrics.get("required_skill_coverage", 0.0)
    coverage_bonus = min(10.0, coverage * 0.1)

    # Prerequisite penalty: missing prerequisites reduce score
    prereq_completion = metrics.get("prerequisite_completion", 100.0)
    prereq_penalty = max(0.0, (100.0 - prereq_completion) * 0.15)

    # Critical gap penalty: heavily penalize missing high-importance skills
    critical_count = metrics.get("critical_skill_gap_count", 0)
    critical_penalty = min(20.0, critical_count * 5.0)

    adjusted_score = max(0.0, min(100.0, raw_score + coverage_bonus - prereq_penalty - critical_penalty))

    matched_names = [m["skill"] for m in matched]
    weak_names = [w["skill"] for w in weak]
    missing_names = [m["skill"] for m in missing]

    # Critical gaps: high-importance skills that are missing or weak
    critical_gaps = []
    for m in missing:
        if m.get("importance", 0) >= 0.85:
            critical_gaps.append(m["skill"])
    for w in weak:
        if w.get("importance", 0) >= 0.85:
            critical_gaps.append(w["skill"])

    return {
        "score": round(adjusted_score, 2),
        "matched_skills": matched_names,
        "weak_skills": weak_names,
        "missing_skills": missing_names,
        "critical_gaps": critical_gaps,
        "details": {
            "raw_match_score": round(raw_score, 2),
            "coverage_bonus": round(coverage_bonus, 2),
            "prereq_penalty": round(prereq_penalty, 2),
            "critical_penalty": round(critical_penalty, 2),
            "matched_count": len(matched),
            "weak_count": len(weak),
            "missing_count": len(missing),
            "total_required": metrics.get("total_requirements", 0),
        },
    }
