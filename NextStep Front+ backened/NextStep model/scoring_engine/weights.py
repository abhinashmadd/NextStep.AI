"""
Scoring Weights Configuration for NextStep Scoring Engine.
Defines the importance multiplier for each scoring dimension.
"""

from dataclasses import dataclass


@dataclass
class ScoringWeights:
    """Configurable weights for each scoring dimension (must sum to 1.0)."""
    skill_weight: float = 0.35
    interest_weight: float = 0.15
    education_weight: float = 0.10
    project_weight: float = 0.15
    certification_weight: float = 0.10
    experience_weight: float = 0.10
    preference_weight: float = 0.05

    def normalize(self) -> "ScoringWeights":
        """Normalize weights to sum to 1.0."""
        total = (
            self.skill_weight + self.interest_weight + self.education_weight
            + self.project_weight + self.certification_weight
            + self.experience_weight + self.preference_weight
        )
        if total <= 0:
            return ScoringWeights()
        factor = 1.0 / total
        return ScoringWeights(
            skill_weight=round(self.skill_weight * factor, 4),
            interest_weight=round(self.interest_weight * factor, 4),
            education_weight=round(self.education_weight * factor, 4),
            project_weight=round(self.project_weight * factor, 4),
            certification_weight=round(self.certification_weight * factor, 4),
            experience_weight=round(self.experience_weight * factor, 4),
            preference_weight=round(self.preference_weight * factor, 4),
        )

    def to_dict(self) -> dict:
        return {
            "skill": self.skill_weight,
            "interest": self.interest_weight,
            "education": self.education_weight,
            "project": self.project_weight,
            "certification": self.certification_weight,
            "experience": self.experience_weight,
            "preference": self.preference_weight,
        }


DEFAULT_WEIGHTS = ScoringWeights()
