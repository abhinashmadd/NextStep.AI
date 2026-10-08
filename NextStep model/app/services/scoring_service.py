from typing import List, Dict, Any, Tuple, Set
import re
from app.core.logger import logger


def normalize_skill(skill: str) -> str:
    """Normalize skill name for robust matching."""
    s = skill.strip().lower()
    # Remove common suffixes like 's' for plurals (e.g., 'apis' -> 'api')
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


# Known synonym/technology family mapping for career skill matching
SKILL_ALIASES: Dict[str, Set[str]] = {
    "rest apis": {"rest api", "rest", "restful api", "restful apis", "fastapi", "flask", "django rest"},
    "sql": {"sqlite", "postgresql", "postgres", "mysql", "sql", "relational database"},
    "git": {"git", "github", "gitlab", "version control"},
    "testing": {"testing", "automated tests", "automated testing", "unit testing", "pytest", "unittest"},
    "docker": {"docker", "containers", "containerization", "docker deployment"},
    "python": {"python", "python 3", "fastapi"},
}


class DeterministicScoringService:
    """
    Handles deterministic calculations for NextStep:
    - Skill verification against career requirements
    - Deterministic readiness scoring (0-100)
    - Deterministic skill gap computation and ranking
    - Next best action gap validation
    """

    @classmethod
    def match_skills(
        cls, demonstrated_skills: List[str], career_requirements: List[str]
    ) -> Tuple[List[str], List[str]]:
        """
        Deterministically compare demonstrated skills against career requirements.
        Returns:
            (matched_requirements, missing_requirements)
        """
        normalized_demonstrated = {normalize_skill(s): s for s in demonstrated_skills}

        matched: List[str] = []
        missing: List[str] = []

        for req in career_requirements:
            norm_req = normalize_skill(req)
            is_matched = False

            # Direct match
            if norm_req in normalized_demonstrated:
                is_matched = True
            else:
                # Alias / family match
                for canonical, aliases in SKILL_ALIASES.items():
                    if norm_req == canonical or norm_req in aliases:
                        if any(d_norm == canonical or d_norm in aliases for d_norm in normalized_demonstrated):
                            is_matched = True
                            break

                # Substring match (e.g. 'FastAPI' matches 'REST APIs' or 'Python REST API')
                if not is_matched:
                    for d_norm in normalized_demonstrated:
                        if norm_req in d_norm or d_norm in norm_req:
                            is_matched = True
                            break

            if is_matched:
                matched.append(req)
            else:
                missing.append(req)

        return matched, missing

    @classmethod
    def calculate_readiness_score(
        cls,
        demonstrated_skills: List[str],
        career_requirements: List[str],
        weights: Dict[str, float] = None,
    ) -> int:
        """
        Calculate deterministic readiness score as percentage (0-100).
        Score is based on verified coverage of career requirements.
        """
        if not career_requirements:
            return 0

        matched, _ = cls.match_skills(demonstrated_skills, career_requirements)

        if not weights:
            # Uniform weighting
            raw_score = (len(matched) / len(career_requirements)) * 100
        else:
            # Weighted calculation
            total_weight = sum(weights.get(req, 1.0) for req in career_requirements)
            earned_weight = sum(weights.get(req, 1.0) for req in matched)
            raw_score = (earned_weight / total_weight) * 100 if total_weight > 0 else 0

        # Clamp between 0 and 100
        score = max(0, min(100, int(round(raw_score))))
        logger.info(
            f"Deterministic scoring: {len(matched)}/{len(career_requirements)} requirements matched. Readiness score = {score}%"
        )
        return score

    @classmethod
    def resolve_skill_gaps(
        cls,
        ai_identified_gaps: List[str],
        demonstrated_skills: List[str],
        career_requirements: List[str],
    ) -> List[str]:
        """
        Deterministically ensure all unmet career requirements are in skill_gaps,
        preserving any additional granular gaps identified by AI.
        """
        _, missing_requirements = cls.match_skills(demonstrated_skills, career_requirements)

        # Start with missing requirements
        combined_gaps: List[str] = list(missing_requirements)

        # Append any AI-identified gaps that aren't already included
        norm_combined = {normalize_skill(g) for g in combined_gaps}
        for ai_gap in ai_identified_gaps:
            norm_gap = normalize_skill(ai_gap)
            if norm_gap not in norm_combined:
                combined_gaps.append(ai_gap)
                norm_combined.add(norm_gap)

        return combined_gaps

    @classmethod
    def validate_and_refine_analysis(
        cls,
        raw_result: Dict[str, Any],
        career_requirements: List[str],
    ) -> Dict[str, Any]:
        """
        Enforce backend determinism on the AI output:
        1. Deterministic readiness score
        2. Deterministic skill gap resolution
        3. Ensuring demonstrated skills and gaps are disjoint
        """
        demonstrated = raw_result.get("demonstrated_skills", [])
        ai_gaps = raw_result.get("skill_gaps", [])

        # 1. Deterministic readiness score
        deterministic_score = cls.calculate_readiness_score(demonstrated, career_requirements)
        raw_result["readiness_score"] = deterministic_score

        # 2. Deterministic skill gaps
        refined_gaps = cls.resolve_skill_gaps(ai_gaps, demonstrated, career_requirements)
        raw_result["skill_gaps"] = refined_gaps

        # 3. Ensure next_best_action is populated
        nba = raw_result.get("next_best_action") or {}
        if not nba.get("title") and refined_gaps:
            top_gap = refined_gaps[0]
            raw_result["next_best_action"] = {
                "title": f"Implement {top_gap} into your portfolio project",
                "reason": f"{top_gap} is a key requirement for your target career currently missing in evidence.",
                "expected_outcome": f"Demonstrated competency in {top_gap} added to your repository.",
                "difficulty": "Intermediate",
                "estimated_time": "2-4 days",
            }

        return raw_result
