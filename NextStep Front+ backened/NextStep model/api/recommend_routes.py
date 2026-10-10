"""
FastAPI Routes for NextStep End-to-End Career Recommendation Pipeline.
Provides the main /api/recommend endpoint that integrates:
Scoring Engine + Skill Graph + RAG → Personalized Career Recommendations.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.logger import logger
from api.recommendation_pipeline import get_recommendation_pipeline


router = APIRouter(prefix="/api", tags=["Career Recommendation"])


class SkillInput(BaseModel):
    """Skill with optional proficiency level."""
    skill: str = Field(..., description="Skill name (e.g., 'Python')")
    level: int = Field(default=2, ge=0, le=5, description="Proficiency level (0-5)")


class RecommendRequest(BaseModel):
    """Input for the end-to-end recommendation pipeline."""
    skills: List[SkillInput] = Field(default_factory=list, description="Student skills with proficiency levels")
    interests: List[str] = Field(default_factory=list, description="Career interests (e.g., 'Cybersecurity', 'Networking')")
    education: Optional[str] = Field(default=None, description="Education background (e.g., 'B.Tech Computer Science')")
    projects: List[str] = Field(default_factory=list, description="Completed projects (e.g., 'Network Scanner')")
    certifications: List[str] = Field(default_factory=list, description="Earned certifications")
    experience_level: Optional[str] = Field(default="beginner", description="Experience level")
    target_career: Optional[str] = Field(default=None, description="Preferred target career (optional)")
    careers_to_evaluate: Optional[List[str]] = Field(default=None, description="Specific careers to evaluate (or all)")
    include_rag: bool = Field(default=True, description="Whether to include RAG-enhanced guidance")


class CareerScoreBreakdown(BaseModel):
    skill_score: float = 0.0
    interest_score: float = 0.0
    education_score: float = 0.0
    project_score: float = 0.0
    certification_score: float = 0.0
    experience_score: float = 0.0
    preference_score: float = 0.0


class RankedCareerResponse(BaseModel):
    career: str
    final_score: float
    confidence: str
    rank: int
    score_breakdown: Dict[str, float] = Field(default_factory=dict)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    weak_skills: List[str] = Field(default_factory=list)
    critical_gaps: List[str] = Field(default_factory=list)
    recommended_next_skills: List[Dict[str, Any]] = Field(default_factory=list)
    learning_path_stages: List[Dict[str, Any]] = Field(default_factory=list)
    relevant_projects: List[str] = Field(default_factory=list)
    relevant_certs: List[str] = Field(default_factory=list)
    matched_interests: List[str] = Field(default_factory=list)


class RecommendResponse(BaseModel):
    """Full recommendation pipeline output."""
    ranked_careers: List[RankedCareerResponse]
    rag_guidance: str = ""
    rag_sources: List[str] = Field(default_factory=list)
    student_skills_extracted: List[Dict[str, Any]] = Field(default_factory=list)
    pipeline_metadata: Dict[str, Any] = Field(default_factory=dict)


@router.post(
    "/recommend",
    response_model=RecommendResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Personalized Career Recommendations",
    description=(
        "End-to-end career recommendation pipeline. "
        "Evaluates student profile across multiple dimensions (skills, interests, education, "
        "projects, certifications, experience, preferences), ranks careers, and provides "
        "RAG-enhanced personalized guidance."
    ),
)
def recommend_careers(request: RecommendRequest):
    """
    Execute the full NextStep recommendation pipeline:
    Student Profile → Skill Extraction → Skill Graph → Scoring Engine
    → Career Ranking → RAG → Personalized Career Guidance
    """
    try:
        pipeline = get_recommendation_pipeline()

        # Build profile dict
        profile = {
            "skills": [{"skill": s.skill, "level": s.level} for s in request.skills],
            "interests": request.interests,
            "education": request.education,
            "projects": request.projects,
            "certifications": request.certifications,
            "experience_level": request.experience_level,
            "target_career": request.target_career,
        }

        result = pipeline.recommend(
            profile=profile,
            careers_to_evaluate=request.careers_to_evaluate,
            include_rag=request.include_rag,
        )

        return RecommendResponse(
            ranked_careers=[RankedCareerResponse(**rc) for rc in result.ranked_careers],
            rag_guidance=result.rag_guidance,
            rag_sources=result.rag_sources,
            student_skills_extracted=result.student_skills_extracted,
            pipeline_metadata=result.pipeline_metadata,
        )

    except Exception as exc:
        logger.error(f"Recommendation pipeline error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "RECOMMENDATION_ERROR", "message": str(exc)},
        )


@router.post(
    "/scoring/rank",
    response_model=List[RankedCareerResponse],
    status_code=status.HTTP_200_OK,
    summary="Fast Deterministic Career Ranking",
    description="Scores and ranks careers using deterministic multi-dimensional scoring without RAG/LLM latency.",
)
def rank_careers_only(request: RecommendRequest):
    """Fast career ranking without RAG retrieval or LLM inference."""
    try:
        from scoring_engine.engine import get_scoring_engine
        from skill_graph.graph import default_skill_graph
        from skill_graph.schemas import NodeType

        engine = get_scoring_engine()
        profile = {
            "skills": [{"skill": s.skill, "level": s.level} for s in request.skills],
            "interests": request.interests,
            "education": request.education,
            "projects": request.projects,
            "certifications": request.certifications,
            "experience_level": request.experience_level,
            "target_career": request.target_career,
        }

        careers = request.careers_to_evaluate
        if not careers:
            career_nodes = default_skill_graph.get_nodes_by_type(NodeType.CAREER)
            careers = [c.name for c in career_nodes]

        ranked = engine.score_multiple_careers(profile, careers)
        return [RankedCareerResponse(**rc.to_dict()) for rc in ranked]

    except Exception as exc:
        logger.error(f"Scoring rank error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "SCORING_RANK_ERROR", "message": str(exc)},
        )


class SingleCareerScoreRequest(BaseModel):
    career: str = Field(..., description="Career name to score (e.g. 'Cybersecurity Analyst')")
    skills: List[SkillInput] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    education: Optional[str] = None
    projects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    experience_level: Optional[str] = "beginner"
    target_career: Optional[str] = None


@router.post(
    "/scoring/career",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Detailed Single Career Scoring",
    description="Computes in-depth scoring breakdown across 7 dimensions for a single target career.",
)
def score_single_career(request: SingleCareerScoreRequest):
    """Detailed score breakdown for a specific career."""
    try:
        from scoring_engine.engine import get_scoring_engine

        engine = get_scoring_engine()
        profile = {
            "skills": [{"skill": s.skill, "level": s.level} for s in request.skills],
            "interests": request.interests,
            "education": request.education,
            "projects": request.projects,
            "certifications": request.certifications,
            "experience_level": request.experience_level,
            "target_career": request.target_career,
        }

        return engine.score_career(profile, request.career)

    except Exception as exc:
        logger.error(f"Single career scoring error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "SCORING_CAREER_ERROR", "message": str(exc)},
        )

