"""
Edge definitions and relationship contracts for NextStep Skill Graph.
"""

from typing import Any, Dict, Optional
from skill_graph.schemas import RelationType


class Edge:
    """Represents a directed relationship between two graph nodes."""

    def __init__(
        self,
        source_id: str,
        target_id: str,
        relation_type: RelationType,
        properties: Optional[Dict[str, Any]] = None,
    ):
        self.source_id = source_id
        self.target_id = target_id
        self.relation_type = relation_type
        self.properties = properties or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source_id,
            "target": self.target_id,
            "type": self.relation_type.value,
            **self.properties,
        }

    def __repr__(self) -> str:
        return f"Edge({self.source_id} -[{self.relation_type.value}]-> {self.target_id})"
