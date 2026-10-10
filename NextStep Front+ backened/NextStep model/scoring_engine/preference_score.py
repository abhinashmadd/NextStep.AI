"""
Preference Score Calculator for NextStep Scoring Engine.
Evaluates alignment between student's stated career preferences and evaluated career.
"""

from typing import Any, Dict, List, Optional


def calculate_preference_score(
    target_career: Optional[str],
    evaluated_career: str,
    interests: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Calculate preference alignment score.
    Gives bonus when the student explicitly targets this career.

    Returns:
        Dict with:
        - score: float (0.0 to 100.0)
        - is_target: whether this career matches the student's target
        - details: scoring breakdown
    """
    is_target = False
    interest_alignment = False

    if target_career:
        target_lower = target_career.strip().lower()
        career_lower = evaluated_career.strip().lower()

        # Direct match or substring match
        if target_lower == career_lower:
            is_target = True
        elif target_lower in career_lower or career_lower in target_lower:
            is_target = True
        else:
            # Check word overlap
            target_words = set(target_lower.split())
            career_words = set(career_lower.split())
            overlap = target_words & career_words
            if len(overlap) >= 1 and any(len(w) > 3 for w in overlap):
                is_target = True

    # Check if interests mention this career
    if interests:
        career_lower = evaluated_career.strip().lower()
        career_words = [w for w in career_lower.split() if len(w) > 3]
        for interest in interests:
            interest_lower = interest.strip().lower()
            for word in career_words:
                if word in interest_lower:
                    interest_alignment = True
                    break
            if interest_alignment:
                break

    if is_target:
        score = 100.0
    elif interest_alignment:
        score = 70.0
    else:
        score = 40.0  # Neutral - still worth evaluating

    return {
        "score": round(score, 2),
        "is_target": is_target,
        "details": {
            "target_career": target_career,
            "evaluated_career": evaluated_career,
            "interest_alignment": interest_alignment,
        },
    }
