"""
Node definitions for NextStep Skill Graph.
Provides strongly-typed representation for all node entities in the knowledge graph.
"""

from typing import Any, Dict, List, Optional
from skill_graph.schemas import NodeType


class Node:
    """Base graph node."""

    def __init__(self, id: str, node_type: NodeType, name: str, properties: Optional[Dict[str, Any]] = None):
        self.id = id
        self.node_type = node_type
        self.name = name
        self.properties = properties or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.node_type.value,
            "name": self.name,
            **self.properties,
        }

    def __repr__(self) -> str:
        return f"Node({self.node_type.value}: {self.name} [{self.id}])"


class SkillNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        category: str = "General",
        domain: str = "General",
        description: str = "",
        aliases: Optional[List[str]] = None,
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "category": category,
            "domain": domain,
            "description": description,
            "aliases": aliases or [],
        })
        super().__init__(id=id, node_type=NodeType.SKILL, name=name, properties=props)


class CareerNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        domain: str = "General",
        description: str = "",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "domain": domain,
            "description": description,
        })
        super().__init__(id=id, node_type=NodeType.CAREER, name=name, properties=props)


class JobRoleNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        career: str = "",
        description: str = "",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "career": career,
            "description": description,
        })
        super().__init__(id=id, node_type=NodeType.JOB_ROLE, name=name, properties=props)


class TechnologyNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        category: str = "Technology",
        description: str = "",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "category": category,
            "description": description,
        })
        super().__init__(id=id, node_type=NodeType.TECHNOLOGY, name=name, properties=props)


class CertificationNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        full_name: str = "",
        difficulty: str = "intermediate",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "full_name": full_name or name,
            "difficulty": difficulty,
        })
        super().__init__(id=id, node_type=NodeType.CERTIFICATION, name=name, properties=props)


class ProjectNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        difficulty: str = "intermediate",
        description: str = "",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "difficulty": difficulty,
            "description": description,
        })
        super().__init__(id=id, node_type=NodeType.PROJECT, name=name, properties=props)


class CourseNode(Node):
    def __init__(
        self,
        id: str,
        name: str,
        provider: str = "",
        url: str = "",
        properties: Optional[Dict[str, Any]] = None,
    ):
        props = properties or {}
        props.update({
            "provider": provider,
            "url": url,
        })
        super().__init__(id=id, node_type=NodeType.COURSE, name=name, properties=props)


class DomainNode(Node):
    def __init__(self, id: str, name: str, properties: Optional[Dict[str, Any]] = None):
        super().__init__(id=id, node_type=NodeType.DOMAIN, name=name, properties=properties)


class EducationNode(Node):
    def __init__(self, id: str, name: str, degree_type: str = "", properties: Optional[Dict[str, Any]] = None):
        props = properties or {}
        props.update({"degree_type": degree_type})
        super().__init__(id=id, node_type=NodeType.EDUCATION, name=name, properties=props)


class StudentNode(Node):
    def __init__(self, id: str, name: str = "Student", properties: Optional[Dict[str, Any]] = None):
        super().__init__(id=id, node_type=NodeType.STUDENT, name=name, properties=properties)
