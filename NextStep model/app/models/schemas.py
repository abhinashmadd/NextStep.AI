from typing import List, Union, Dict, Any, Optional
from pydantic import BaseModel, Field


class NextBestAction(BaseModel):
    title: str = Field(..., description="Actionable title for the recommended next step")
    reason: str = Field(..., description="Why this action provides the highest ROI for the student")
    expected_outcome: str = Field(..., description="What the student will achieve or add to their portfolio")
    difficulty: str = Field(..., description="Difficulty level, e.g., Beginner, Intermediate, Advanced")
    estimated_time: str = Field(..., description="Estimated time commitment, e.g., 2-3 days")


class AIAnalysisResult(BaseModel):
    demonstrated_skills: List[str] = Field(default_factory=list, description="Skills verified in student evidence")
    skill_evidence: List[Union[Dict[str, Any], str]] = Field(
        default_factory=list, description="Evidence breakdown linking skills to student projects or work"
    )
    skill_gaps: List[str] = Field(default_factory=list, description="Required skills that are missing or weak")
    strengths: List[str] = Field(default_factory=list, description="Key technical or practical strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Identified areas for technical growth")
    readiness_score: int = Field(..., ge=0, le=100, description="Deterministic readiness score from 0 to 100")
    next_best_action: NextBestAction = Field(..., description="Single highest-value next step to take")


class AnalyzeRequest(BaseModel):
    student_profile: str = Field(..., min_length=1, description="Student academic/experience background, e.g., 'B.Tech student'")
    target_career: str = Field(..., min_length=1, description="Target career role, e.g., 'Backend Developer'")
    student_evidence: str = Field(..., min_length=1, description="Tangible student evidence (projects, GitHub, code, experience)")
    career_requirements: List[str] = Field(..., min_length=1, description="List of required skills or competencies for the target career")


class ReAnalyzeRequest(BaseModel):
    student_profile: str = Field(..., min_length=1, description="Student academic/experience background")
    target_career: str = Field(..., min_length=1, description="Target career role")
    prior_evidence: str = Field(..., min_length=1, description="Prior student evidence baseline")
    new_evidence: str = Field(..., min_length=1, description="New evidence completed from prior next best action")
    career_requirements: List[str] = Field(..., min_length=1, description="Target career requirements")


class ApiResponse(BaseModel):
    success: bool = True
    data: Optional[AIAnalysisResult] = None
    meta: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    model: str
    nvidia_configured: bool
    masked_key: str
