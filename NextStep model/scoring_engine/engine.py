"""
Core Scoring Engine for NextStep Career Guidance Platform.
Orchestrates multi-dimensional scoring across skills, interests, education,
projects, certifications, experience, and preferences.

Integrates with:
- Skill Graph (skill_graph/) for gap analysis and learning paths
- RAG Pipeline (rag/) for knowledge-grounded LLM responses
"""

import time
from typing import Any, Dict, List, Optional

from app.core.logger import logger
from skill_graph.schemas import StudentSkill
from skill_graph.skill_extractor import skill_extractor
from skill_graph.skill_gap import skill_gap_analyzer
from skill_graph.graph_queries import graph_queries

from scoring_engine.weights import ScoringWeights, DEFAULT_WEIGHTS
from scoring_engine.skill_score import calculate_skill_score
from scoring_engine.interest_score import calculate_interest_score
from scoring_engine.education_score import calculate_education_score
from scoring_engine.project_score import calculate_project_score
from scoring_engine.certification_score import calculate_certification_score
from scoring_engine.experience_score import calculate_experience_score
from scoring_engine.preference_score import calculate_preference_score
from scoring_engine.career_ranker import CareerRanker, RankedCareer


class ScoringEngine:
    """
    Multi-dimensional career compatibility scoring engine.

    Pipeline:
    Student Profile
    → Skill Extraction & Normalization
    → Skill Graph Gap Analysis
    → Multi-Dimensional Scoring (7 dimensions)
    → Weighted Aggregation
    → Career Ranking
    → Ranked Career List with full diagnostics
    """

    def __init__(self, weights: Optional[ScoringWeights] = None):
        self.weights = (weights or DEFAULT_WEIGHTS).normalize()
        self.ranker = CareerRanker()

    def extract_student_skills(self, profile: Dict[str, Any]) -> List[StudentSkill]:
        """Extract and normalize skills from student profile using Skill Graph extractor."""
        return skill_extractor.extract_from_profile(profile)

    def score_career(
        self,
        profile: Dict[str, Any],
        career_name: str,
        student_skills: Optional[List[StudentSkill]] = None,
    ) -> Dict[str, Any]:
        """
        Score a single career against a student profile.

        Returns dict with:
        - career: career name
        - final_score: weighted composite score (0-100)
        - score_breakdown: per-dimension scores
        - skill_data, interest_data, etc.: detailed dimension outputs
        - gap_analysis: full Skill Graph gap analysis
        - learning_path: structured learning roadmap
        """
        start = time.time()

        # 1. Extract skills if not provided
        if student_skills is None:
            student_skills = self.extract_student_skills(profile)

        # 2. Skill Graph gap analysis
        gap_result = skill_gap_analyzer.analyze_gap(student_skills, career_name)

        # 3. Generate learning path
        learning_path = graph_queries.get_learning_path(student_skills, career_name)

        # 4. Calculate each dimension score
        skill_data = calculate_skill_score(gap_result)
        interest_data = calculate_interest_score(
            profile.get("interests", []), career_name
        )
        education_data = calculate_education_score(
            profile.get("education"), career_name
        )
        project_data = calculate_project_score(
            profile.get("projects", []),
            career_name,
            student_skills_names=[s.skill for s in student_skills],
        )
        cert_data = calculate_certification_score(
            profile.get("certifications", []), career_name
        )
        experience_data = calculate_experience_score(
            profile.get("experience_level"), career_name
        )
        preference_data = calculate_preference_score(
            profile.get("target_career"),
            career_name,
            interests=profile.get("interests", []),
        )

        # 5. Weighted aggregation
        w = self.weights
        final_score = (
            w.skill_weight * skill_data["score"]
            + w.interest_weight * interest_data["score"]
            + w.education_weight * education_data["score"]
            + w.project_weight * project_data["score"]
            + w.certification_weight * cert_data["score"]
            + w.experience_weight * experience_data["score"]
            + w.preference_weight * preference_data["score"]
        )

        score_breakdown = {
            "skill_score": round(skill_data["score"], 2),
            "interest_score": round(interest_data["score"], 2),
            "education_score": round(education_data["score"], 2),
            "project_score": round(project_data["score"], 2),
            "certification_score": round(cert_data["score"], 2),
            "experience_score": round(experience_data["score"], 2),
            "preference_score": round(preference_data["score"], 2),
        }

        elapsed = time.time() - start

        logger.info(
            f"Scored '{career_name}': {final_score:.1f} "
            f"(skill={skill_data['score']:.0f}, interest={interest_data['score']:.0f}, "
            f"edu={education_data['score']:.0f}, proj={project_data['score']:.0f}, "
            f"cert={cert_data['score']:.0f}, exp={experience_data['score']:.0f}, "
            f"pref={preference_data['score']:.0f}) in {elapsed:.3f}s"
        )

        return {
            "career": career_name,
            "final_score": round(final_score, 2),
            "score_breakdown": score_breakdown,
            "skill_data": skill_data,
            "interest_data": interest_data,
            "education_data": education_data,
            "project_data": project_data,
            "certification_data": cert_data,
            "experience_data": experience_data,
            "preference_data": preference_data,
            "gap_analysis": gap_result.model_dump(),
            "learning_path": learning_path.model_dump(),
            "scoring_latency_seconds": round(elapsed, 4),
        }

    def score_multiple_careers(
        self,
        profile: Dict[str, Any],
        career_names: List[str],
    ) -> List[RankedCareer]:
        """
        Score multiple careers and return a ranked list.
        """
        start = time.time()
        logger.info(f"Scoring {len(career_names)} careers for student profile")

        # Extract skills once
        student_skills = self.extract_student_skills(profile)

        career_scores = []
        for career in career_names:
            try:
                result = self.score_career(profile, career, student_skills=student_skills)
                career_scores.append(result)
            except Exception as e:
                logger.error(f"Error scoring career '{career}': {e}")

        ranked = self.ranker.rank_careers(career_scores)

        elapsed = time.time() - start
        logger.info(
            f"Ranked {len(ranked)} careers in {elapsed:.3f}s. "
            f"Top: {ranked[0].career} ({ranked[0].final_score:.1f})" if ranked else "No careers ranked"
        )

        return ranked


# Singleton
_scoring_engine_instance: Optional[ScoringEngine] = None


def get_scoring_engine(weights: Optional[ScoringWeights] = None) -> ScoringEngine:
    """Get or create the global ScoringEngine instance."""
    global _scoring_engine_instance
    if _scoring_engine_instance is None:
        _scoring_engine_instance = ScoringEngine(weights=weights)
    return _scoring_engine_instance
