"""
High-Level Graph Query and Traversal API for NextStep Skill Graph.
Provides standardized retrieval for prerequisites, dependencies, related skills,
career roles, skill gaps, next best skills, and topological learning paths.
"""

from collections import defaultdict
from typing import Any, Dict, List, Optional, Set
import networkx as nx

from app.core.logger import logger
from skill_graph.graph import BaseSkillGraph, default_skill_graph
from skill_graph.schemas import (
    NodeType,
    RelationType,
    StudentSkill,
    SkillGapAnalysisResult,
    NextBestSkillRecommendation,
    LearningPath,
    LearningStage,
)
from skill_graph.skill_normalizer import SkillNormalizer, skill_normalizer
from skill_graph.skill_gap import SkillGapAnalyzer, skill_gap_analyzer


class SkillGraphQueries:
    """
    Unified query service executing graph traversals and pedagogical path generation.
    """

    def __init__(
        self,
        graph: Optional[BaseSkillGraph] = None,
        normalizer: Optional[SkillNormalizer] = None,
        gap_analyzer: Optional[SkillGapAnalyzer] = None,
    ):
        self.graph = graph or default_skill_graph
        self.normalizer = normalizer or skill_normalizer
        self.gap_analyzer = gap_analyzer or skill_gap_analyzer

    def get_required_skills(self, career_name: str) -> List[Dict[str, Any]]:
        """Get all required skills for a career including importance and min_level."""
        canonical_career = career_name.strip()
        career_node = self.graph.find_node_by_name(canonical_career, NodeType.CAREER)
        if not career_node:
            return []
        return career_node.properties.get("required_skills", [])

    def get_related_skills(self, skill_name: str) -> List[str]:
        """Find skills linked via RELATED_TO in either direction."""
        canonical = self.normalizer.normalize(skill_name) or skill_name
        skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
        if not skill_node:
            return []

        neighbors = self.graph.get_neighbors(skill_node.id, relation_type=RelationType.RELATED_TO, direction="both")
        return sorted(list(set(n.name for n in neighbors if n.node_type == NodeType.SKILL and n.name != canonical)))

    def get_prerequisites(self, skill_name: str) -> List[str]:
        """Find immediate prerequisites for a skill (skills that must be learned before this skill)."""
        return self.gap_analyzer.get_prerequisites(skill_name)

    def get_dependent_skills(self, skill_name: str) -> List[str]:
        """Find downstream skills that depend on this skill as a prerequisite."""
        canonical = self.normalizer.normalize(skill_name) or skill_name
        skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
        if not skill_node:
            return []

        # Out-edges with PREREQUISITE_OF: skill_node -[PREREQUISITE_OF]-> target
        dependents: List[str] = []
        for edge in self.graph.get_edges(source_id=skill_node.id, relation_type=RelationType.PREREQUISITE_OF):
            tgt_node = self.graph.get_node(edge.target_id)
            if tgt_node and tgt_node.node_type == NodeType.SKILL:
                dependents.append(tgt_node.name)
        return sorted(list(set(dependents)))

    def get_career_roles(self, career_name: str) -> List[str]:
        """Find job roles contained within a career."""
        career_node = self.graph.find_node_by_name(career_name, NodeType.CAREER)
        if not career_node:
            return []

        roles = self.graph.get_neighbors(career_node.id, relation_type=RelationType.CONTAINS, direction="out")
        return [r.name for r in roles if r.node_type == NodeType.JOB_ROLE]

    def get_careers_for_skill(self, skill_name: str) -> List[str]:
        """Find all careers that require a given skill."""
        canonical = self.normalizer.normalize(skill_name) or skill_name
        skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
        if not skill_node:
            return []

        careers: List[str] = []
        for edge in self.graph.get_edges(source_id=skill_node.id, relation_type=RelationType.REQUIRED_FOR):
            c_node = self.graph.get_node(edge.target_id)
            if c_node and c_node.node_type == NodeType.CAREER:
                careers.append(c_node.name)
        return sorted(list(set(careers)))

    def get_skill_gap(self, student_skills: List[StudentSkill], career: str) -> SkillGapAnalysisResult:
        """Run complete skill gap analysis."""
        return self.gap_analyzer.analyze_gap(student_skills, career)

    def get_next_best_skills(
        self,
        student_skills: List[StudentSkill],
        career: str,
        limit: int = 5,
    ) -> List[NextBestSkillRecommendation]:
        """Ranked next skills to learn."""
        gap_res = self.gap_analyzer.analyze_gap(student_skills, career)
        return gap_res.next_best_skills[:limit]

    def get_learning_path(
        self,
        student_skills: List[StudentSkill],
        career: str,
    ) -> LearningPath:
        """
        Generates a step-by-step roadmap ordering missing and weak skills topologically
        respecting the prerequisite DAG. Also attaches relevant projects and certifications.
        """
        gap_res = self.gap_analyzer.analyze_gap(student_skills, career)
        unmet_skills_set: Set[str] = set()

        # Collect all weak, missing, and prerequisite gap skills
        for w in gap_res.weak_skills:
            unmet_skills_set.add(w["skill"])
        for m in gap_res.missing_skills:
            unmet_skills_set.add(m["skill"])
        for p in gap_res.prerequisite_gaps:
            unmet_skills_set.add(p["prerequisite_skill"])

        if not unmet_skills_set:
            return LearningPath(
                target_career=career,
                total_stages=1,
                stages=[
                    LearningStage(
                        stage=1,
                        title="Career Readiness Achieved",
                        skills=[],
                        description="You meet or exceed all stated skill requirements for this career! Focus on portfolio projects and interviewing.",
                    )
                ],
            )

        # Build local prerequisite dependency DAG for unmet skills
        dag = nx.DiGraph()
        for s in unmet_skills_set:
            dag.add_node(s)

        for s in unmet_skills_set:
            prereqs = self.gap_analyzer.get_prerequisites(s)
            for p in prereqs:
                if p in unmet_skills_set:
                    # p must come before s: p -> s
                    dag.add_edge(p, s)

        # Topological sorting or fallback layered ranking if cycles exist
        try:
            topo_order = list(nx.topological_sort(dag))
        except nx.NetworkXUnfeasible:
            # Fallback if circular dependency
            topo_order = sorted(list(unmet_skills_set))

        # Group topologically sorted skills into stages (1-2 skills per stage)
        stages: List[LearningStage] = []
        stage_num = 1

        for i in range(0, len(topo_order), 2):
            batch = topo_order[i : i + 2]
            title = f"Stage {stage_num}: " + " & ".join(batch)

            # Discover related projects and certs for this stage's skills
            stage_projects: Set[str] = set()
            stage_certs: Set[str] = set()

            for sk in batch:
                sk_node = self.graph.find_node_by_name(sk, NodeType.SKILL)
                if sk_node:
                    # Projects that develop this skill: project -[DEVELOPS]-> skill
                    for e in self.graph.get_edges(target_id=sk_node.id, relation_type=RelationType.DEVELOPS):
                        p_node = self.graph.get_node(e.source_id)
                        if p_node:
                            stage_projects.add(p_node.name)

                    # Certifications that validate this skill: cert -[VALIDATES]-> skill
                    for e in self.graph.get_edges(target_id=sk_node.id, relation_type=RelationType.VALIDATES):
                        c_node = self.graph.get_node(e.source_id)
                        if c_node:
                            stage_certs.add(c_node.name)

            desc = f"Master foundational and applied concepts in {', '.join(batch)}."
            stages.append(
                LearningStage(
                    stage=stage_num,
                    title=title,
                    skills=batch,
                    description=desc,
                    projects=sorted(list(stage_projects)),
                    certifications=sorted(list(stage_certs)),
                )
            )
            stage_num += 1

        return LearningPath(
            target_career=career,
            total_stages=len(stages),
            stages=stages,
        )


# Global singleton
graph_queries = SkillGraphQueries()


# Direct function exports matching user requirements
def get_required_skills(career: str) -> List[Dict[str, Any]]:
    return graph_queries.get_required_skills(career)


def get_related_skills(skill: str) -> List[str]:
    return graph_queries.get_related_skills(skill)


def get_prerequisites(skill: str) -> List[str]:
    return graph_queries.get_prerequisites(skill)


def get_dependent_skills(skill: str) -> List[str]:
    return graph_queries.get_dependent_skills(skill)


def get_career_roles(career: str) -> List[str]:
    return graph_queries.get_career_roles(career)


def get_careers_for_skill(skill: str) -> List[str]:
    return graph_queries.get_careers_for_skill(skill)


def get_skill_gap(student: List[StudentSkill], career: str) -> SkillGapAnalysisResult:
    return graph_queries.get_skill_gap(student, career)


def get_next_best_skills(student: List[StudentSkill], career: str, limit: int = 5) -> List[NextBestSkillRecommendation]:
    return graph_queries.get_next_best_skills(student, career, limit=limit)


def get_learning_path(student: List[StudentSkill], career: str) -> LearningPath:
    return graph_queries.get_learning_path(student, career)
