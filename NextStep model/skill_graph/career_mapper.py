"""
Career Compatibility Mapper for NextStep Skill Graph.
Evaluates student competencies against multiple careers in parallel,
producing structured compatibility percentages and gap counts for the Scoring Engine.
"""

from typing import List, Optional
from skill_graph.graph import BaseSkillGraph, default_skill_graph
from skill_graph.nodes import CareerNode
from skill_graph.schemas import NodeType, StudentSkill, CareerMatch
from skill_graph.skill_gap import SkillGapAnalyzer, skill_gap_analyzer


class CareerMapper:
    """
    Computes comparative career compatibility across all career roles in the knowledge graph.
    """

    def __init__(self, graph: Optional[BaseSkillGraph] = None, gap_analyzer: Optional[SkillGapAnalyzer] = None):
        self.graph = graph or default_skill_graph
        self.gap_analyzer = gap_analyzer or skill_gap_analyzer

    def match_careers(
        self,
        student_skills: List[StudentSkill],
        top_n: int = 5,
    ) -> List[CareerMatch]:
        """
        Evaluate student skills against all available careers and return ranked compatibility scores.
        """
        career_nodes = self.graph.get_nodes_by_type(NodeType.CAREER)
        results: List[CareerMatch] = []

        for c_node in career_nodes:
            gap_result = self.gap_analyzer.analyze_gap(student_skills, c_node.name)
            metrics = gap_result.metrics

            compat_score = metrics.get("skill_match_score", 0.0)
            total_reqs = metrics.get("total_requirements", 0)
            matched_count = len(gap_result.matched_skills)
            weak_count = len(gap_result.weak_skills)
            missing_count = len(gap_result.missing_skills)

            top_missing = [m["skill"] for m in gap_result.missing_skills[:3]]

            results.append(
                CareerMatch(
                    career=c_node.name,
                    compatibility_score=compat_score,
                    matched_count=matched_count,
                    weak_count=weak_count,
                    missing_count=missing_count,
                    total_required=total_reqs,
                    top_missing_skills=top_missing,
                )
            )

        results.sort(key=lambda x: x.compatibility_score, reverse=True)
        return results[:top_n]


# Global singleton
career_mapper = CareerMapper()
