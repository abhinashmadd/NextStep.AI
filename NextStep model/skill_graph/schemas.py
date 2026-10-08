"""
Pydantic Schemas and Type Definitions for NextStep Skill Graph.
Defines nodes, relationships, skill levels, gaps, career matches, and learning paths.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    SKILL = "Skill"
    CAREER = "Career"
    JOB_ROLE = "JobRole"
    TECHNOLOGY = "Technology"
    CERTIFICATION = "Certification"
    PROJECT = "Project"
    COURSE = "Course"
    DOMAIN = "Domain"
    EDUCATION = "Education"
    STUDENT = "Student"


class RelationType(str, Enum):
    PREREQUISITE_OF = "PREREQUISITE_OF"
    RELATED_TO = "RELATED_TO"
    PART_OF = "PART_OF"
    REQUIRED_FOR = "REQUIRED_FOR"
    USES = "USES"
    VALIDATES = "VALIDATES"
    DEVELOPS = "DEVELOPS"
    TEACHES = "TEACHES"
    CONTAINS = "CONTAINS"
    REQUIRES = "REQUIRES"
    NEXT_SKILL = "NEXT_SKILL"
    HAS_SKILL = "HAS_SKILL"
    INTERESTED_IN = "INTERESTED_IN"
    COMPLETED = "COMPLETED"


class SkillLevel(int, Enum):
    NO_KNOWLEDGE = 0
    BEGINNER = 1
    ELEMENTARY = 2
    INTERMEDIATE = 3
    ADVANCED = 4
    EXPERT = 5


class StudentSkill(BaseModel):
    """Represents a skill possessed by a student with proficiency and provenance."""
    skill: str = Field(..., description="Canonical skill name")
    level: int = Field(default=1, ge=0, le=5, description="Proficiency level (0-5)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Extraction or inference confidence")
    source: str = Field(default="student_profile", description="Source: 'student_profile', 'extracted', 'inferred'")


class SkillRequirement(BaseModel):
    """Requirement for a specific career or job role."""
    skill: str
    importance: float = Field(default=1.0, ge=0.0, le=1.0)
    min_level: int = Field(default=2, ge=1, le=5)


class NextBestSkillRecommendation(BaseModel):
    """Ranked next best skill to study."""
    skill: str
    priority: float = Field(..., description="Calculated priority score (0.0 to 1.0)")
    reason: str
    current_level: int = 0
    target_level: int = 2


class SkillGapAnalysisResult(BaseModel):
    """Complete gap analysis between student skills and career requirements."""
    target_career: str
    matched_skills: List[Dict[str, Any]] = Field(default_factory=list)
    weak_skills: List[Dict[str, Any]] = Field(default_factory=list)
    missing_skills: List[Dict[str, Any]] = Field(default_factory=list)
    prerequisite_gaps: List[Dict[str, Any]] = Field(default_factory=list)
    next_best_skills: List[NextBestSkillRecommendation] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)


class CareerMatch(BaseModel):
    """Compatibility rating for a single career."""
    career: str
    compatibility_score: float = Field(..., ge=0.0, le=100.0)
    matched_count: int
    weak_count: int
    missing_count: int
    total_required: int
    top_missing_skills: List[str] = Field(default_factory=list)


class LearningStage(BaseModel):
    """Single stage in a learning progression roadmap."""
    stage: int
    title: str
    skills: List[str]
    description: str
    projects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class LearningPath(BaseModel):
    """Full pedagogical learning path from current skills to target career."""
    target_career: str
    total_stages: int
    stages: List[LearningStage] = Field(default_factory=list)


# API Request & Response Schemas
class SkillExtractRequest(BaseModel):
    text: str = Field(..., description="Text from profile, resume, projects, or query")


class SkillExtractResponse(BaseModel):
    extracted_skills: List[StudentSkill]


class SkillNormalizeRequest(BaseModel):
    skills: List[str] = Field(..., description="List of raw skill strings to normalize")


class SkillNormalizeResponse(BaseModel):
    normalized: Dict[str, Optional[str]]


class GapAnalysisRequest(BaseModel):
    student_skills: List[StudentSkill]
    target_career: str


class NextBestSkillRequest(BaseModel):
    student_skills: List[StudentSkill]
    target_career: str
    limit: int = Field(default=5, ge=1, le=20)


class CareerMatchRequest(BaseModel):
    student_skills: List[StudentSkill]
    top_n: int = Field(default=5, ge=1, le=20)


class LearningPathRequest(BaseModel):
    student_skills: List[StudentSkill]
    target_career: str
