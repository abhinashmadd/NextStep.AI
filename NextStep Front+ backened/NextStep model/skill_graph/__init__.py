"""
NextStep Skill Graph Package.
Provides entity models, prerequisite DAGs, skill normalization, extraction,
gap analysis, multi-career matching, and topological learning path generation.
"""

from skill_graph.schemas import (
    NodeType,
    RelationType,
    SkillLevel,
    StudentSkill,
    SkillRequirement,
    SkillGapAnalysisResult,
    NextBestSkillRecommendation,
    CareerMatch,
    LearningPath,
    LearningStage,
)
from skill_graph.graph import BaseSkillGraph, NetworkXSkillGraph, default_skill_graph
from skill_graph.graph_loader import SkillGraphLoader, load_default_skill_graph
from skill_graph.skill_normalizer import SkillNormalizer, skill_normalizer
from skill_graph.skill_extractor import SkillExtractor, skill_extractor
from skill_graph.skill_gap import SkillGapAnalyzer, skill_gap_analyzer
from skill_graph.career_mapper import CareerMapper, career_mapper
from skill_graph.graph_queries import (
    graph_queries,
    get_required_skills,
    get_related_skills,
    get_prerequisites,
    get_dependent_skills,
    get_career_roles,
    get_careers_for_skill,
    get_skill_gap,
    get_next_best_skills,
    get_learning_path,
)
from skill_graph.context import build_skill_context

# Initialize default graph with demo datasets on package import
load_default_skill_graph()

__all__ = [
    "NodeType",
    "RelationType",
    "SkillLevel",
    "StudentSkill",
    "SkillRequirement",
    "SkillGapAnalysisResult",
    "NextBestSkillRecommendation",
    "CareerMatch",
    "LearningPath",
    "LearningStage",
    "BaseSkillGraph",
    "NetworkXSkillGraph",
    "default_skill_graph",
    "SkillGraphLoader",
    "load_default_skill_graph",
    "SkillNormalizer",
    "skill_normalizer",
    "SkillExtractor",
    "skill_extractor",
    "SkillGapAnalyzer",
    "skill_gap_analyzer",
    "CareerMapper",
    "career_mapper",
    "graph_queries",
    "get_required_skills",
    "get_related_skills",
    "get_prerequisites",
    "get_dependent_skills",
    "get_career_roles",
    "get_careers_for_skill",
    "get_skill_gap",
    "get_next_best_skills",
    "get_learning_path",
    "build_skill_context",
]
