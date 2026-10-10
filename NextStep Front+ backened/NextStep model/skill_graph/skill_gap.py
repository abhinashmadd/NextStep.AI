"""
Skill Gap Analysis Engine for NextStep.
Evaluates student competencies against career requirements and prerequisite trees,
calculating weak skills, missing skills, prerequisite blockers, and structured scoring metrics.
"""

from typing import Any, Dict, List, Optional, Set
from skill_graph.graph import BaseSkillGraph, default_skill_graph
from skill_graph.schemas import (
    NodeType,
    RelationType,
    StudentSkill,
    SkillGapAnalysisResult,
    NextBestSkillRecommendation,
)
from skill_graph.skill_normalizer import SkillNormalizer, skill_normalizer


class SkillGapAnalyzer:
    """
    Performs comprehensive gap analysis between a student's demonstrated competencies
    and the target career's requirements.
    """

    def __init__(self, graph: Optional[BaseSkillGraph] = None, normalizer: Optional[SkillNormalizer] = None):
        self.graph = graph or default_skill_graph
        self.normalizer = normalizer or skill_normalizer

    def get_prerequisites(self, skill_name: str) -> List[str]:
        """Find immediate prerequisites: X where X -[PREREQUISITE_OF]-> skill_name."""
        canonical = self.normalizer.normalize(skill_name) or skill_name
        skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
        if not skill_node:
            return []

        # Find in-edges with PREREQUISITE_OF: source -[PREREQUISITE_OF]-> skill_node
        prereqs: List[str] = []
        for edge in self.graph.get_edges(target_id=skill_node.id, relation_type=RelationType.PREREQUISITE_OF):
            src_node = self.graph.get_node(edge.source_id)
            if src_node and src_node.node_type == NodeType.SKILL:
                prereqs.append(src_node.name)
        return prereqs

    def get_all_transitive_prerequisites(self, skill_name: str) -> List[str]:
        """Find all recursive prerequisites for a skill in topological order."""
        visited: Set[str] = set()
        ordered_prereqs: List[str] = []

        def dfs(curr_skill: str):
            for p in self.get_prerequisites(curr_skill):
                if p not in visited:
                    visited.add(p)
                    dfs(p)
                    ordered_prereqs.append(p)

        dfs(skill_name)
        return ordered_prereqs

    def analyze_gap(
        self,
        student_skills: List[StudentSkill],
        target_career: str,
    ) -> SkillGapAnalysisResult:
        """
        Calculates matched, weak, and missing skills, plus prerequisite blockers.
        """
        # 1. Normalize student skills map: canonical_name -> StudentSkill
        student_map: Dict[str, StudentSkill] = {}
        for s in student_skills:
            canon = self.normalizer.normalize(s.skill) or s.skill
            # Retain higher level if duplicates
            if canon not in student_map or s.level > student_map[canon].level:
                student_map[canon] = StudentSkill(
                    skill=canon,
                    level=s.level,
                    confidence=s.confidence,
                    source=s.source,
                )

        # 2. Retrieve career node & required skills
        career_node = self.graph.find_node_by_name(target_career, NodeType.CAREER)
        requirements: List[Dict[str, Any]] = []

        if career_node:
            requirements = career_node.properties.get("required_skills", [])
        else:
            # Fallback: check edges incoming to career
            edges = self.graph.get_edges(target_id=target_career, relation_type=RelationType.REQUIRED_FOR)
            for e in edges:
                sk_node = self.graph.get_node(e.source_id)
                if sk_node:
                    requirements.append({
                        "skill": sk_node.name,
                        "importance": e.properties.get("importance", 1.0),
                        "min_level": e.properties.get("min_level", 2),
                    })

        matched_skills: List[Dict[str, Any]] = []
        weak_skills: List[Dict[str, Any]] = []
        missing_skills: List[Dict[str, Any]] = []
        prerequisite_gaps_set: Set[str] = set()
        prerequisite_gaps: List[Dict[str, Any]] = []

        total_importance = 0.0
        earned_importance = 0.0
        critical_gap_count = 0

        for req in requirements:
            req_skill = self.normalizer.normalize(req["skill"]) or req["skill"]
            importance = float(req.get("importance", 1.0))
            min_level = int(req.get("min_level", 2))
            total_importance += importance

            curr_skill_obj = student_map.get(req_skill)
            curr_level = curr_skill_obj.level if curr_skill_obj else 0

            # Check prerequisites of this required skill
            prereqs = self.get_all_transitive_prerequisites(req_skill)
            missing_prereqs_for_skill = []
            for p in prereqs:
                p_level = student_map.get(p).level if p in student_map else 0
                if p_level < 2:  # Needs at least elementary foundation
                    missing_prereqs_for_skill.append(p)
                    prerequisite_gaps_set.add(p)

            skill_entry = {
                "skill": req_skill,
                "current_level": curr_level,
                "required_level": min_level,
                "importance": importance,
                "gap": max(0, min_level - curr_level),
                "unmet_prerequisites": missing_prereqs_for_skill,
            }

            if curr_level >= min_level:
                matched_skills.append(skill_entry)
                earned_importance += importance
            elif curr_level > 0:
                weak_skills.append(skill_entry)
                # Partial credit: fraction of required level
                earned_importance += importance * (curr_level / min_level)
                if importance >= 0.85:
                    critical_gap_count += 1
            else:
                missing_skills.append(skill_entry)
                if importance >= 0.85:
                    critical_gap_count += 1

        # Format prerequisite gaps
        for p_name in prerequisite_gaps_set:
            curr_lvl = student_map.get(p_name).level if p_name in student_map else 0
            prerequisite_gaps.append({
                "prerequisite_skill": p_name,
                "current_level": curr_lvl,
                "recommended_level": 2,
                "reason": f"Required prerequisite for downstream career skills",
            })

        # Calculate next best skills
        next_best = self.calculate_next_best_skills(
            student_map=student_map,
            requirements=requirements,
            weak_skills=weak_skills,
            missing_skills=missing_skills,
            prerequisite_gaps=prerequisite_gaps,
        )

        # Calculate scoring engine metrics
        total_req_count = len(requirements)
        matched_count = len(matched_skills)
        weak_count = len(weak_skills)
        missing_count = len(missing_skills)

        skill_match_score = round((earned_importance / total_importance * 100), 2) if total_importance > 0 else 0.0
        coverage = round(((matched_count + weak_count) / total_req_count * 100), 2) if total_req_count > 0 else 0.0
        prereq_completion = round((1.0 - (len(prerequisite_gaps) / max(1, len(prerequisite_gaps_set) + matched_count))) * 100, 2)

        metrics = {
            "skill_match_score": skill_match_score,
            "required_skill_coverage": coverage,
            "prerequisite_completion": max(0.0, prereq_completion),
            "skill_gap_count": weak_count + missing_count,
            "critical_skill_gap_count": critical_gap_count,
            "matched_skill_count": matched_count,
            "total_requirements": total_req_count,
            "learning_progress": round((matched_count / max(1, total_req_count)) * 100, 2),
        }

        return SkillGapAnalysisResult(
            target_career=target_career,
            matched_skills=matched_skills,
            weak_skills=weak_skills,
            missing_skills=missing_skills,
            prerequisite_gaps=prerequisite_gaps,
            next_best_skills=next_best,
            metrics=metrics,
        )

    def calculate_next_best_skills(
        self,
        student_map: Dict[str, StudentSkill],
        requirements: List[Dict[str, Any]],
        weak_skills: List[Dict[str, Any]],
        missing_skills: List[Dict[str, Any]],
        prerequisite_gaps: List[Dict[str, Any]],
        limit: int = 5,
    ) -> List[NextBestSkillRecommendation]:
        """
        Ranks which skills the student should tackle next.
        Prioritizes:
        1. Foundational prerequisites that unblock multiple career skills.
        2. Weak skills close to meeting required level (high ROI quick wins).
        3. High-importance missing skills whose prerequisites are already satisfied.
        """
        candidates: Dict[str, Dict[str, Any]] = {}

        # 1. Prerequisite blockers get highest foundation score
        for p in prerequisite_gaps:
            p_name = p["prerequisite_skill"]
            curr_l = p["current_level"]
            candidates[p_name] = {
                "skill": p_name,
                "priority_score": 0.95,
                "reason": "Foundational prerequisite required to unlock downstream career skills",
                "current_level": curr_l,
                "target_level": 2,
            }

        # 2. Weak skills (student already started; quick win to close the gap)
        for w in weak_skills:
            w_name = w["skill"]
            importance = w["importance"]
            gap = w["gap"]
            unmet = w.get("unmet_prerequisites", [])

            # Slightly penalized if prerequisites still missing
            prereq_penalty = 0.2 if unmet else 0.0
            score = (importance * 0.85) + (0.15 if gap == 1 else 0.05) - prereq_penalty

            reason = f"Weak skill with existing foundation (Level {w['current_level']}/{w['required_level']}); close the gap to meet minimum career threshold"
            if unmet:
                reason += f" (Note: Consider completing {', '.join(unmet[:2])} first)"

            if w_name not in candidates or score > candidates[w_name]["priority_score"]:
                candidates[w_name] = {
                    "skill": w_name,
                    "priority_score": round(max(0.1, score), 2),
                    "reason": reason,
                    "current_level": w["current_level"],
                    "target_level": w["required_level"],
                }

        # 3. Missing skills whose prerequisites are satisfied
        for m in missing_skills:
            m_name = m["skill"]
            importance = m["importance"]
            unmet = m.get("unmet_prerequisites", [])

            if not unmet:
                score = importance * 0.90
                reason = "High-importance core requirement; all prerequisites are satisfied"
            else:
                score = importance * 0.60
                reason = f"Core requirement, but blocked by missing prerequisite: {unmet[0]}"

            if m_name not in candidates or score > candidates[m_name]["priority_score"]:
                candidates[m_name] = {
                    "skill": m_name,
                    "priority_score": round(max(0.1, score), 2),
                    "reason": reason,
                    "current_level": 0,
                    "target_level": m["required_level"],
                }

        sorted_candidates = sorted(candidates.values(), key=lambda x: x["priority_score"], reverse=True)

        recommendations = [
            NextBestSkillRecommendation(
                skill=item["skill"],
                priority=item["priority_score"],
                reason=item["reason"],
                current_level=item["current_level"],
                target_level=item["target_level"],
            )
            for item in sorted_candidates[:limit]
        ]

        return recommendations


# Global singleton
skill_gap_analyzer = SkillGapAnalyzer()
