"""
FastAPI Routes for NextStep Skill Graph System.
Endpoints for skill extraction, normalization, career skill queries, gap analysis,
next-best skill recommendations, career matching, and learning path generation.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status

from app.core.logger import logger
from skill_graph.schemas import (
    SkillExtractRequest,
    SkillExtractResponse,
    SkillNormalizeRequest,
    SkillNormalizeResponse,
    GapAnalysisRequest,
    SkillGapAnalysisResult,
    NextBestSkillRequest,
    NextBestSkillRecommendation,
    CareerMatchRequest,
    CareerMatch,
    LearningPathRequest,
    LearningPath,
)
from skill_graph.skill_extractor import skill_extractor
from skill_graph.skill_normalizer import skill_normalizer
from skill_graph.skill_gap import skill_gap_analyzer
from skill_graph.career_mapper import career_mapper
from skill_graph.graph_queries import graph_queries

router = APIRouter(prefix="/api", tags=["Skill Graph"])


@router.post(
    "/skills/extract",
    response_model=SkillExtractResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract Skills and Infer Proficiency Levels",
)
def extract_skills_endpoint(request: SkillExtractRequest):
    """Extract canonical skills with inferred proficiency levels (1-5) from free-form text."""
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text cannot be empty.",
        )
    skills = skill_extractor.extract_from_text(request.text)
    return SkillExtractResponse(extracted_skills=skills)


@router.post(
    "/skills/normalize",
    response_model=SkillNormalizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Normalize Skill Names to Canonical Forms",
)
def normalize_skills_endpoint(request: SkillNormalizeRequest):
    """Maps arbitrary aliases and variations to canonical skill names."""
    result: Dict[str, Any] = {}
    for raw in request.skills:
        result[raw] = skill_normalizer.normalize(raw)
    return SkillNormalizeResponse(normalized=result)


@router.get(
    "/careers/{career}/skills",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Get Required Skills for a Career",
)
def get_career_skills_endpoint(career: str):
    """Retrieve verified skill requirements, importance weights, and minimum levels for a career."""
    skills = graph_queries.get_required_skills(career)
    if not skills:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Career '{career}' not found in the Skill Graph.",
        )
    return skills


@router.post(
    "/skills/gap-analysis",
    response_model=SkillGapAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Analyze Skill Gaps Against Target Career",
)
def gap_analysis_endpoint(request: GapAnalysisRequest):
    """Evaluates student skills against career requirements, finding matched, weak, and missing skills."""
    if not request.target_career or not request.target_career.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_career is required.",
        )
    result = skill_gap_analyzer.analyze_gap(request.student_skills, request.target_career)
    return result


@router.post(
    "/skills/next-best",
    response_model=List[NextBestSkillRecommendation],
    status_code=status.HTTP_200_OK,
    summary="Calculate Next Best Skills to Learn",
)
def next_best_skills_endpoint(request: NextBestSkillRequest):
    """Ranks highest-ROI skills to learn based on missing prerequisites, importance, and foundation."""
    recommendations = graph_queries.get_next_best_skills(
        student_skills=request.student_skills,
        career=request.target_career,
        limit=request.limit,
    )
    return recommendations


@router.post(
    "/careers/match",
    response_model=List[CareerMatch],
    status_code=status.HTTP_200_OK,
    summary="Calculate Comparative Career Compatibility",
)
def career_match_endpoint(request: CareerMatchRequest):
    """Calculates compatibility percentages across all graph careers for a student skill set."""
    matches = career_mapper.match_careers(
        student_skills=request.student_skills,
        top_n=request.top_n,
    )
    return matches


@router.post(
    "/learning-path",
    response_model=LearningPath,
    status_code=status.HTTP_200_OK,
    summary="Generate Topological Learning Path",
)
def learning_path_endpoint(request: LearningPathRequest):
    """Generates a sequential multi-stage roadmap respecting skill prerequisite dependencies."""
    path = graph_queries.get_learning_path(
        student_skills=request.student_skills,
        career=request.target_career,
    )
    return path
