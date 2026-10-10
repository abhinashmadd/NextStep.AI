"""
End-to-End Career Recommendation Pipeline for NextStep.
Orchestrates the full flow:

Student Profile
→ Skill Extraction
→ Skill Normalization
→ Skill Graph Gap Analysis
→ Scoring Engine (multi-dimensional)
→ Career Ranking
→ RAG Retrieval (per top career)
→ LLM Generation
→ Personalized Career Recommendation
"""

import time
from typing import Any, Dict, List, Optional

from app.core.logger import logger
from scoring_engine.engine import ScoringEngine, get_scoring_engine
from scoring_engine.career_ranker import RankedCareer
from rag.pipeline import RAGPipeline, get_rag_pipeline
from skill_graph.context import build_skill_context


class RecommendationResult:
    """Full output of the recommendation pipeline."""

    def __init__(
        self,
        ranked_careers: List[Dict[str, Any]],
        rag_guidance: str,
        rag_sources: List[str],
        student_skills_extracted: List[Dict[str, Any]],
        pipeline_metadata: Dict[str, Any],
    ):
        self.ranked_careers = ranked_careers
        self.rag_guidance = rag_guidance
        self.rag_sources = rag_sources
        self.student_skills_extracted = student_skills_extracted
        self.pipeline_metadata = pipeline_metadata

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ranked_careers": self.ranked_careers,
            "rag_guidance": self.rag_guidance,
            "rag_sources": self.rag_sources,
            "student_skills_extracted": self.student_skills_extracted,
            "pipeline_metadata": self.pipeline_metadata,
        }


class RecommendationPipeline:
    """
    Production-ready end-to-end recommendation pipeline.
    """

    def __init__(
        self,
        scoring_engine: Optional[ScoringEngine] = None,
        rag_pipeline: Optional[RAGPipeline] = None,
    ):
        self.scoring_engine = scoring_engine or get_scoring_engine()
        self.rag_pipeline = rag_pipeline or get_rag_pipeline()

    def recommend(
        self,
        profile: Dict[str, Any],
        careers_to_evaluate: Optional[List[str]] = None,
        top_n: int = 5,
        include_rag: bool = True,
    ) -> RecommendationResult:
        """
        Execute the full recommendation pipeline.

        Args:
            profile: Student profile dict with keys:
                - skills: list of skill dicts or strings
                - interests: list of interest strings
                - education: education string
                - projects: list of project strings
                - certifications: list of cert strings
                - experience_level: string
                - target_career: optional target career string
            careers_to_evaluate: specific careers to evaluate (or all graph careers)
            top_n: number of top careers to return
            include_rag: whether to run RAG for the top career

        Returns:
            RecommendationResult with ranked careers, RAG guidance, and metadata
        """
        start = time.time()
        logger.info("Starting end-to-end recommendation pipeline")

        # 1. Determine careers to evaluate
        if not careers_to_evaluate:
            from skill_graph.graph import default_skill_graph
            from skill_graph.schemas import NodeType
            career_nodes = default_skill_graph.get_nodes_by_type(NodeType.CAREER)
            careers_to_evaluate = [c.name for c in career_nodes]

        if not careers_to_evaluate:
            logger.warning("No careers found in Skill Graph to evaluate")
            return RecommendationResult(
                ranked_careers=[],
                rag_guidance="No careers available for evaluation.",
                rag_sources=[],
                student_skills_extracted=[],
                pipeline_metadata={"status": "no_careers"},
            )

        # 2. Extract student skills
        student_skills = self.scoring_engine.extract_student_skills(profile)
        skills_list = [
            {"skill": s.skill, "level": s.level, "confidence": s.confidence, "source": s.source}
            for s in student_skills
        ]
        logger.info(f"Extracted {len(student_skills)} skills from profile")

        # 3. Score all careers
        ranked_careers = self.scoring_engine.score_multiple_careers(
            profile, careers_to_evaluate
        )

        # Trim to top_n
        top_careers = ranked_careers[:top_n]

        # 4. Build Skill Graph context for top career
        top_career_name = top_careers[0].career if top_careers else None
        skill_context = None
        if top_career_name:
            try:
                skill_context = build_skill_context(profile, top_career_name)
            except Exception as e:
                logger.warning(f"Could not build skill context for '{top_career_name}': {e}")

        # 5. RAG-enhanced guidance for top career
        rag_guidance = ""
        rag_sources = []

        if include_rag and top_career_name:
            try:
                # Build a comprehensive query combining student profile and top career
                query_parts = [
                    f"I want to become a {top_career_name}.",
                ]
                if profile.get("skills"):
                    skill_names = []
                    for s in profile["skills"]:
                        if isinstance(s, dict):
                            skill_names.append(s.get("skill", s.get("name", "")))
                        else:
                            skill_names.append(str(s))
                    query_parts.append(f"My current skills: {', '.join(skill_names)}.")
                if profile.get("interests"):
                    query_parts.append(f"My interests: {', '.join(profile['interests'])}.")
                if profile.get("experience_level"):
                    query_parts.append(f"Experience level: {profile['experience_level']}.")

                # Add skill gap context
                if skill_context:
                    query_parts.append(f"Skill analysis: {skill_context.get('formatted_context', '')[:500]}")

                rag_query = " ".join(query_parts)

                rag_profile = {
                    "skills": [s.skill for s in student_skills],
                    "interests": profile.get("interests", []),
                    "target_career": top_career_name,
                    "experience_level": profile.get("experience_level", "beginner"),
                }

                rag_result = self.rag_pipeline.run(
                    query=rag_query,
                    student_profile=rag_profile,
                    top_k=10,
                    rerank_top_k=5,
                )
                rag_guidance = rag_result.answer
                rag_sources = rag_result.sources
                logger.info(f"RAG generated guidance with {len(rag_sources)} sources")

            except Exception as e:
                logger.error(f"RAG pipeline error: {e}")
                rag_guidance = f"RAG guidance temporarily unavailable: {e}"

        # 6. Assemble final output
        ranked_dicts = [rc.to_dict() for rc in top_careers]

        elapsed = time.time() - start

        pipeline_metadata = {
            "total_careers_evaluated": len(careers_to_evaluate),
            "top_n_returned": len(top_careers),
            "total_latency_seconds": round(elapsed, 3),
            "skills_extracted_count": len(student_skills),
            "rag_enabled": include_rag,
            "status": "success",
        }

        logger.info(
            f"Recommendation pipeline complete in {elapsed:.3f}s. "
            f"Top career: {top_career_name} ({top_careers[0].final_score:.1f})" if top_careers else "No results"
        )

        return RecommendationResult(
            ranked_careers=ranked_dicts,
            rag_guidance=rag_guidance,
            rag_sources=rag_sources,
            student_skills_extracted=skills_list,
            pipeline_metadata=pipeline_metadata,
        )


# Singleton
_recommendation_pipeline: Optional[RecommendationPipeline] = None


def get_recommendation_pipeline() -> RecommendationPipeline:
    """Get or create the global RecommendationPipeline instance."""
    global _recommendation_pipeline
    if _recommendation_pipeline is None:
        _recommendation_pipeline = RecommendationPipeline()
    return _recommendation_pipeline
