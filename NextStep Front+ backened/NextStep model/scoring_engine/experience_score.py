"""
Experience Score Calculator for NextStep Scoring Engine.
Maps student experience level to a normalized score.
"""

from typing import Any, Dict, Optional


# Experience level scoring
EXPERIENCE_SCORES = {
    "none": 15.0,
    "beginner": 30.0,
    "elementary": 35.0,
    "junior": 40.0,
    "entry": 40.0,
    "entry-level": 40.0,
    "intermediate": 60.0,
    "mid": 60.0,
    "advanced": 80.0,
    "senior": 85.0,
    "expert": 95.0,
    "professional": 75.0,
    "student": 25.0,
    "fresher": 20.0,
    "intern": 25.0,
    "internship": 25.0,
}


def calculate_experience_score(
    experience_level: Optional[str],
    career_name: str,
) -> Dict[str, Any]:
    """
    Calculate experience score.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - parsed_level: detected experience level
        - details: scoring breakdown
    """
    if not experience_level:
        return {
            "score": 25.0,
            "parsed_level": "unknown",
            "details": {"reason": "No experience level specified; conservative baseline applied"},
        }

    level_lower = experience_level.strip().lower()

    # Direct match
    score = EXPERIENCE_SCORES.get(level_lower)
    if score is not None:
        return {
            "score": round(score, 2),
            "parsed_level": level_lower,
            "details": {"matched_level": level_lower},
        }

    # Substring match
    for keyword, s in sorted(EXPERIENCE_SCORES.items(), key=lambda x: -len(x[0])):
        if keyword in level_lower:
            return {
                "score": round(s, 2),
                "parsed_level": keyword,
                "details": {"matched_level": keyword, "original": experience_level},
            }

    # Years of experience parsing
    import re
    years_match = re.search(r"(\d+)\s*(?:year|yr)", level_lower)
    if years_match:
        years = int(years_match.group(1))
        if years == 0:
            s = 20.0
        elif years <= 1:
            s = 35.0
        elif years <= 3:
            s = 55.0
        elif years <= 5:
            s = 70.0
        else:
            s = 85.0
        return {
            "score": round(s, 2),
            "parsed_level": f"{years}_years",
            "details": {"years_detected": years},
        }

    return {
        "score": 25.0,
        "parsed_level": "unknown",
        "details": {"reason": f"Could not parse experience level: '{experience_level}'"},
    }
