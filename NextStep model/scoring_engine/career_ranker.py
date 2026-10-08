"""
Career Ranker for NextStep Scoring Engine.
Takes multi-dimensional scores for multiple careers and produces a ranked list
with confidence levels, score breakdowns, and actionable recommendations.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RankedCareer:
    """A single career with its full scoring breakdown."""
    career: str
    final_score: float
    confidence: str  # "high", "medium", "low"
    rank: int
    score_breakdown: Dict[str, float] = field(default_factory=dict)
    matched_skills: List[str] = field(default_factory=list)
    missing_skills: List[str] = field(default_factory=list)
    weak_skills: List[str] = field(default_factory=list)
    critical_gaps: List[str] = field(default_factory=list)
    recommended_next_skills: List[Dict[str, Any]] = field(default_factory=list)
    learning_path_stages: List[Dict[str, Any]] = field(default_factory=list)
    relevant_projects: List[str] = field(default_factory=list)
    relevant_certs: List[str] = field(default_factory=list)
    matched_interests: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "career": self.career,
            "final_score": self.final_score,
            "confidence": self.confidence,
            "rank": self.rank,
            "score_breakdown": self.score_breakdown,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "weak_skills": self.weak_skills,
            "critical_gaps": self.critical_gaps,
            "recommended_next_skills": self.recommended_next_skills,
            "learning_path_stages": self.learning_path_stages,
            "relevant_projects": self.relevant_projects,
            "relevant_certs": self.relevant_certs,
            "matched_interests": self.matched_interests,
        }


def _compute_confidence(score: float, critical_gaps: int) -> str:
    """Determine confidence level based on overall score and critical gaps."""
    if score >= 70.0 and critical_gaps == 0:
        return "high"
    elif score >= 50.0 and critical_gaps <= 2:
        return "medium"
    else:
        return "low"


class CareerRanker:
    """
    Ranks careers by weighted multi-dimensional scores.
    Produces RankedCareer objects with full diagnostic breakdown.
    """

    def rank_careers(
        self,
        career_scores: List[Dict[str, Any]],
    ) -> List[RankedCareer]:
        """
        Given a list of career scoring dicts (one per career),
        sort by final_score descending and assign ranks.

        Each dict in career_scores should contain:
        - career: str
        - final_score: float
        - score_breakdown: dict
        - skill_data: dict (from skill_score)
        - interest_data: dict (from interest_score)
        - project_data: dict (from project_score)
        - certification_data: dict (from certification_score)
        - gap_analysis: dict (from skill graph)
        - learning_path: dict
        """
        ranked: List[RankedCareer] = []

        for cs in career_scores:
            skill_data = cs.get("skill_data", {})
            interest_data = cs.get("interest_data", {})
            project_data = cs.get("project_data", {})
            cert_data = cs.get("certification_data", {})
            gap_analysis = cs.get("gap_analysis", {})
            learning_path = cs.get("learning_path", {})

            critical_gaps = skill_data.get("critical_gaps", [])
            confidence = _compute_confidence(cs["final_score"], len(critical_gaps))

            # Format next_best_skills from gap analysis
            next_best_raw = gap_analysis.get("next_best_skills", [])
            recommended_next = []
            for nb in next_best_raw[:5]:
                if isinstance(nb, dict):
                    recommended_next.append({
                        "skill": nb.get("skill", ""),
                        "priority": nb.get("priority", 0),
                        "reason": nb.get("reason", ""),
                        "current_level": nb.get("current_level", 0),
                        "target_level": nb.get("target_level", 2),
                    })

            # Format learning path stages
            lp_stages_raw = learning_path.get("stages", [])
            lp_stages = []
            for stage in lp_stages_raw[:5]:
                if isinstance(stage, dict):
                    lp_stages.append({
                        "stage": stage.get("stage", 0),
                        "title": stage.get("title", ""),
                        "skills": stage.get("skills", []),
                        "description": stage.get("description", ""),
                        "projects": stage.get("projects", []),
                        "certifications": stage.get("certifications", []),
                    })

            ranked.append(RankedCareer(
                career=cs["career"],
                final_score=round(cs["final_score"], 2),
                confidence=confidence,
                rank=0,  # Will be set after sorting
                score_breakdown=cs.get("score_breakdown", {}),
                matched_skills=skill_data.get("matched_skills", []),
                missing_skills=skill_data.get("missing_skills", []),
                weak_skills=skill_data.get("weak_skills", []),
                critical_gaps=critical_gaps,
                recommended_next_skills=recommended_next,
                learning_path_stages=lp_stages,
                relevant_projects=project_data.get("relevant_projects", []),
                relevant_certs=cert_data.get("relevant_certs", []),
                matched_interests=interest_data.get("matched_interests", []),
            ))

        # Sort by final_score descending
        ranked.sort(key=lambda x: x.final_score, reverse=True)

        # Assign ranks
        for idx, r in enumerate(ranked):
            r.rank = idx + 1

        return ranked
