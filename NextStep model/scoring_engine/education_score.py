"""
Education Score Calculator for NextStep Scoring Engine.
Evaluates how well a student's education level matches career requirements.
"""

from typing import Any, Dict, Optional


# Education level hierarchy for scoring
EDUCATION_LEVELS = {
    "high school": 1,
    "diploma": 2,
    "associate": 2,
    "bachelor": 3,
    "b.tech": 3,
    "b.sc": 3,
    "b.e": 3,
    "bca": 3,
    "bba": 3,
    "master": 4,
    "m.tech": 4,
    "m.sc": 4,
    "mba": 4,
    "mca": 4,
    "phd": 5,
    "doctorate": 5,
}

# Career typical education requirements
CAREER_EDUCATION_REQUIREMENTS = {
    "Cybersecurity Analyst": {"min_level": 3, "preferred_fields": ["computer science", "cybersecurity", "it", "information technology", "networking"]},
    "Backend Developer": {"min_level": 3, "preferred_fields": ["computer science", "software engineering", "it", "information technology"]},
    "DevOps Engineer": {"min_level": 3, "preferred_fields": ["computer science", "it", "systems engineering", "cloud computing"]},
    "Data Analyst": {"min_level": 3, "preferred_fields": ["mathematics", "statistics", "computer science", "economics", "data science"]},
    "Frontend Developer": {"min_level": 3, "preferred_fields": ["computer science", "web development", "design", "it"]},
    "AI/ML Engineer": {"min_level": 4, "preferred_fields": ["computer science", "mathematics", "data science", "ai", "statistics"]},
    "Cloud Engineer": {"min_level": 3, "preferred_fields": ["computer science", "it", "networking", "systems engineering"]},
}


def _parse_education_level(education: str) -> int:
    """Parse education string to a numeric level."""
    if not education:
        return 0
    edu_lower = education.strip().lower()
    for keyword, level in sorted(EDUCATION_LEVELS.items(), key=lambda x: -x[1]):
        if keyword in edu_lower:
            return level
    # Default: if they mention "student" or "studying", assume bachelor level
    if "student" in edu_lower or "studying" in edu_lower or "pursuing" in edu_lower:
        return 3
    return 2  # Conservative default


def calculate_education_score(
    education: Optional[str],
    career_name: str,
) -> Dict[str, Any]:
    """
    Calculate education match score.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - education_level: parsed level (1-5)
        - details: scoring breakdown
    """
    if not education:
        return {
            "score": 40.0,
            "education_level": 0,
            "details": {"reason": "No education information provided; conservative score applied"},
        }

    student_level = _parse_education_level(education)
    career_req = CAREER_EDUCATION_REQUIREMENTS.get(career_name, {"min_level": 3, "preferred_fields": []})
    min_level = career_req["min_level"]
    preferred_fields = career_req["preferred_fields"]

    # Level matching
    if student_level >= min_level:
        level_score = 70.0
        if student_level > min_level:
            level_score = min(85.0, 70.0 + (student_level - min_level) * 7.5)
    else:
        gap = min_level - student_level
        level_score = max(20.0, 70.0 - gap * 20.0)

    # Field matching bonus
    edu_lower = education.strip().lower()
    field_bonus = 0.0
    matched_field = None
    for field in preferred_fields:
        if field in edu_lower:
            field_bonus = 15.0
            matched_field = field
            break

    final_score = min(100.0, level_score + field_bonus)

    return {
        "score": round(final_score, 2),
        "education_level": student_level,
        "details": {
            "student_level": student_level,
            "required_level": min_level,
            "level_score": round(level_score, 2),
            "field_bonus": round(field_bonus, 2),
            "matched_field": matched_field,
        },
    }
