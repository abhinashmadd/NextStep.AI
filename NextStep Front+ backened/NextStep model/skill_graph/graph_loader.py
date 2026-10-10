"""
Graph Loader for NextStep Skill Graph.
Ingests structured JSON files from data/skill_graph/ into the active graph backend.
"""

import json
import os
from typing import Dict, Optional

from app.core.logger import logger
from skill_graph.graph import BaseSkillGraph, NetworkXSkillGraph, default_skill_graph
from skill_graph.nodes import (
    SkillNode,
    CareerNode,
    JobRoleNode,
    CertificationNode,
    ProjectNode,
    DomainNode,
)
from skill_graph.edges import Edge
from skill_graph.schemas import NodeType, RelationType
from skill_graph.skill_normalizer import skill_normalizer


class SkillGraphLoader:
    """
    Populates a BaseSkillGraph with domains, skills, careers, job roles,
    certifications, projects, and multi-relational edges.
    """

    def __init__(self, data_dir: str = "data/skill_graph", graph: Optional[BaseSkillGraph] = None):
        self.data_dir = data_dir
        self.graph = graph or default_skill_graph

    def _read_json(self, filename: str) -> Dict:
        path = os.path.join(self.data_dir, filename)
        if not os.path.exists(path):
            logger.warning(f"Skill graph data file not found: {path}")
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load(self, clear_existing: bool = True) -> Dict[str, int]:
        """
        Loads all entities and edges into the graph.
        """
        if clear_existing:
            self.graph.clear()

        # 1. Load Skills
        skills_data = self._read_json("skills.json").get("skills", [])
        for s in skills_data:
            skill_id = s.get("id") or f"skill_{s['name'].lower().replace(' ', '_')}"
            name = s["name"]
            domain_name = s.get("domain", "General")

            # Register with normalizer
            for alias in s.get("aliases", []):
                skill_normalizer.add_alias(name, alias)

            node = SkillNode(
                id=skill_id,
                name=name,
                category=s.get("category", "General"),
                domain=domain_name,
                description=s.get("description", ""),
                aliases=s.get("aliases", []),
            )
            self.graph.add_node(node)

            # Domain node and edge
            domain_id = f"domain_{domain_name.lower().replace(' ', '_')}"
            if not self.graph.has_node(domain_id):
                self.graph.add_node(DomainNode(id=domain_id, name=domain_name))
            self.graph.add_edge(Edge(source_id=skill_id, target_id=domain_id, relation_type=RelationType.PART_OF))

        # 2. Load Careers and Career Requirements
        careers_data = self._read_json("careers.json").get("careers", [])
        for c in careers_data:
            career_id = c.get("id") or f"career_{c['name'].lower().replace(' ', '_')}"
            c_name = c["name"]
            c_domain = c.get("domain", "General")

            career_node = CareerNode(
                id=career_id,
                name=c_name,
                domain=c_domain,
                description=c.get("description", ""),
                properties={"required_skills": c.get("required_skills", [])},
            )
            self.graph.add_node(career_node)

            # Link Skill -> REQUIRED_FOR -> Career
            for req in c.get("required_skills", []):
                skill_name = req["skill"]
                canonical_skill = skill_normalizer.normalize(skill_name) or skill_name
                skill_node = self.graph.find_node_by_name(canonical_skill, NodeType.SKILL)
                if skill_node:
                    edge = Edge(
                        source_id=skill_node.id,
                        target_id=career_id,
                        relation_type=RelationType.REQUIRED_FOR,
                        properties={
                            "importance": req.get("importance", 1.0),
                            "min_level": req.get("min_level", 2),
                        },
                    )
                    self.graph.add_edge(edge)

        # 3. Load Job Roles
        roles_data = self._read_json("job_roles.json").get("job_roles", [])
        for r in roles_data:
            role_id = r.get("id") or f"role_{r['name'].lower().replace(' ', '_')}"
            r_name = r["name"]
            career_name = r.get("career", "")

            role_node = JobRoleNode(
                id=role_id,
                name=r_name,
                career=career_name,
                description=r.get("description", ""),
            )
            self.graph.add_node(role_node)

            # Career -> CONTAINS -> JobRole
            career_node = self.graph.find_node_by_name(career_name, NodeType.CAREER)
            if career_node:
                self.graph.add_edge(Edge(source_id=career_node.id, target_id=role_id, relation_type=RelationType.CONTAINS))

            # JobRole -> REQUIRES -> Skill
            for sk in r.get("required_skills", []):
                canonical = skill_normalizer.normalize(sk) or sk
                skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
                if skill_node:
                    self.graph.add_edge(Edge(source_id=role_id, target_id=skill_node.id, relation_type=RelationType.REQUIRES))

        # 4. Load Certifications
        certs_data = self._read_json("certifications.json").get("certifications", [])
        for cert in certs_data:
            cert_id = cert.get("id") or f"cert_{cert['name'].lower().replace(' ', '_')}"
            cert_node = CertificationNode(
                id=cert_id,
                name=cert["name"],
                full_name=cert.get("full_name", ""),
                difficulty=cert.get("difficulty", "intermediate"),
            )
            self.graph.add_node(cert_node)

            # Certification -> VALIDATES -> Skill
            for sk in cert.get("validates_skills", []):
                canonical = skill_normalizer.normalize(sk) or sk
                skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
                if skill_node:
                    self.graph.add_edge(Edge(source_id=cert_id, target_id=skill_node.id, relation_type=RelationType.VALIDATES))

        # 5. Load Projects
        projects_data = self._read_json("projects.json").get("projects", [])
        for p in projects_data:
            proj_id = p.get("id") or f"project_{p['name'].lower().replace(' ', '_')}"
            proj_node = ProjectNode(
                id=proj_id,
                name=p["name"],
                difficulty=p.get("difficulty", "intermediate"),
                description=p.get("description", ""),
            )
            self.graph.add_node(proj_node)

            # Project -> DEVELOPS -> Skill
            for sk in p.get("develops_skills", []):
                canonical = skill_normalizer.normalize(sk) or sk
                skill_node = self.graph.find_node_by_name(canonical, NodeType.SKILL)
                if skill_node:
                    self.graph.add_edge(Edge(source_id=proj_id, target_id=skill_node.id, relation_type=RelationType.DEVELOPS))

        # 6. Load Explicit Relationships
        rels_data = self._read_json("relationships.json").get("relationships", [])
        for rel in rels_data:
            src_name = rel["source"]
            tgt_name = rel["target"]
            rel_type_str = rel["type"]

            src_canonical = skill_normalizer.normalize(src_name) or src_name
            tgt_canonical = skill_normalizer.normalize(tgt_name) or tgt_name

            src_node = self.graph.find_node_by_name(src_canonical)
            tgt_node = self.graph.find_node_by_name(tgt_canonical)

            if src_node and tgt_node:
                try:
                    rtype = RelationType(rel_type_str)
                except ValueError:
                    rtype = RelationType.RELATED_TO
                self.graph.add_edge(Edge(source_id=src_node.id, target_id=tgt_node.id, relation_type=rtype))

        stats = {
            "node_count": self.graph.node_count(),
            "edge_count": self.graph.edge_count(),
            "status": "success",
        }
        logger.info(f"Skill Graph successfully loaded: {stats}")
        return stats


def load_default_skill_graph() -> NetworkXSkillGraph:
    """Helper to initialize and populate the default global Skill Graph."""
    loader = SkillGraphLoader(graph=default_skill_graph)
    loader.load()
    return default_skill_graph
