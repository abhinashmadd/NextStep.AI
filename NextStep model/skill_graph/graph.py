"""
Skill Graph Storage Abstraction & NetworkX Implementation.
Provides a clean, modular graph interface decouped from any specific graph engine,
allowing seamless future migration to Neo4j.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Set
import networkx as nx

from app.core.logger import logger
from skill_graph.nodes import Node, SkillNode, CareerNode, JobRoleNode, CertificationNode, ProjectNode
from skill_graph.edges import Edge
from skill_graph.schemas import NodeType, RelationType


class BaseSkillGraph(ABC):
    """Abstract interface for Skill Knowledge Graph backends."""

    @abstractmethod
    def add_node(self, node: Node) -> None:
        """Add a typed node to the graph."""
        pass

    @abstractmethod
    def get_node(self, node_id: str) -> Optional[Node]:
        """Retrieve a node by ID."""
        pass

    @abstractmethod
    def has_node(self, node_id: str) -> bool:
        """Check if a node ID exists."""
        pass

    @abstractmethod
    def add_edge(self, edge: Edge) -> None:
        """Add a typed directed edge between nodes."""
        pass

    @abstractmethod
    def has_edge(self, source_id: str, target_id: str, relation_type: Optional[RelationType] = None) -> bool:
        """Check if an edge exists."""
        pass

    @abstractmethod
    def get_edges(
        self,
        source_id: Optional[str] = None,
        target_id: Optional[str] = None,
        relation_type: Optional[RelationType] = None,
    ) -> List[Edge]:
        """Query edges matching filters."""
        pass

    @abstractmethod
    def get_neighbors(
        self,
        node_id: str,
        relation_type: Optional[RelationType] = None,
        direction: str = "out",
    ) -> List[Node]:
        """Get neighboring nodes along specified edge direction ('out', 'in', or 'both')."""
        pass

    @abstractmethod
    def get_nodes_by_type(self, node_type: NodeType) -> List[Node]:
        """Retrieve all nodes of a specific type."""
        pass

    @abstractmethod
    def node_count(self) -> int:
        """Total node count."""
        pass

    @abstractmethod
    def edge_count(self) -> int:
        """Total edge count."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clear all nodes and edges."""
        pass


class NetworkXSkillGraph(BaseSkillGraph):
    """
    In-memory and file-backed implementation of BaseSkillGraph using NetworkX DiGraph.
    """

    def __init__(self):
        self.nx_graph = nx.MultiDiGraph()
        self._nodes_by_id: Dict[str, Node] = {}
        self._nodes_by_name_and_type: Dict[str, Dict[str, Node]] = {}

    def add_node(self, node: Node) -> None:
        self._nodes_by_id[node.id] = node
        t_key = node.node_type.value
        if t_key not in self._nodes_by_name_and_type:
            self._nodes_by_name_and_type[t_key] = {}
        self._nodes_by_name_and_type[t_key][node.name.lower()] = node

        # Add to networkx MultiDiGraph
        self.nx_graph.add_node(
            node.id,
            node_type=node.node_type.value,
            name=node.name,
            **node.properties,
        )

    def get_node(self, node_id: str) -> Optional[Node]:
        return self._nodes_by_id.get(node_id)

    def find_node_by_name(self, name: str, node_type: Optional[NodeType] = None) -> Optional[Node]:
        """Lookup node by name and optional type."""
        lower_name = name.strip().lower()
        if node_type:
            t_key = node_type.value
            return self._nodes_by_name_and_type.get(t_key, {}).get(lower_name)

        for type_dict in self._nodes_by_name_and_type.values():
            if lower_name in type_dict:
                return type_dict[lower_name]
        return None

    def has_node(self, node_id: str) -> bool:
        return node_id in self._nodes_by_id

    def add_edge(self, edge: Edge) -> None:
        # Auto-create fallback node placeholders if referenced nodes not present
        if not self.has_node(edge.source_id):
            self.add_node(Node(id=edge.source_id, node_type=NodeType.SKILL, name=edge.source_id))
        if not self.has_node(edge.target_id):
            self.add_node(Node(id=edge.target_id, node_type=NodeType.SKILL, name=edge.target_id))

        self.nx_graph.add_edge(
            edge.source_id,
            edge.target_id,
            key=edge.relation_type.value,
            relation_type=edge.relation_type.value,
            **edge.properties,
        )

    def has_edge(self, source_id: str, target_id: str, relation_type: Optional[RelationType] = None) -> bool:
        if not self.nx_graph.has_edge(source_id, target_id):
            return False
        if relation_type is None:
            return True
        edge_data = self.nx_graph.get_edge_data(source_id, target_id)
        if not edge_data:
            return False
        return any(d.get("relation_type") == relation_type.value for d in edge_data.values())

    def get_edges(
        self,
        source_id: Optional[str] = None,
        target_id: Optional[str] = None,
        relation_type: Optional[RelationType] = None,
    ) -> List[Edge]:
        results: List[Edge] = []
        u_list = [source_id] if source_id else list(self.nx_graph.nodes())

        for u in u_list:
            if not self.nx_graph.has_node(u):
                continue
            for v, edge_dict in self.nx_graph[u].items():
                if target_id and v != target_id:
                    continue
                for k, attrs in edge_dict.items():
                    rel_val = attrs.get("relation_type")
                    if relation_type and rel_val != relation_type.value:
                        continue
                    try:
                        rt = RelationType(rel_val) if rel_val else RelationType.RELATED_TO
                    except ValueError:
                        rt = RelationType.RELATED_TO
                    props = {k_attr: v_attr for k_attr, v_attr in attrs.items() if k_attr != "relation_type"}
                    results.append(Edge(source_id=u, target_id=v, relation_type=rt, properties=props))

        return results

    def get_neighbors(
        self,
        node_id: str,
        relation_type: Optional[RelationType] = None,
        direction: str = "out",
    ) -> List[Node]:
        if not self.has_node(node_id):
            return []

        neighbor_ids: Set[str] = set()

        if direction in ["out", "both"]:
            for _, v, data in self.nx_graph.out_edges(node_id, data=True):
                if relation_type is None or data.get("relation_type") == relation_type.value:
                    neighbor_ids.add(v)

        if direction in ["in", "both"]:
            for u, _, data in self.nx_graph.in_edges(node_id, data=True):
                if relation_type is None or data.get("relation_type") == relation_type.value:
                    neighbor_ids.add(u)

        return [self._nodes_by_id[nid] for nid in neighbor_ids if nid in self._nodes_by_id]

    def get_nodes_by_type(self, node_type: NodeType) -> List[Node]:
        return [node for node in self._nodes_by_id.values() if node.node_type == node_type]

    def node_count(self) -> int:
        return self.nx_graph.number_of_nodes()

    def edge_count(self) -> int:
        return self.nx_graph.number_of_edges()

    def clear(self) -> None:
        self.nx_graph.clear()
        self._nodes_by_id.clear()
        self._nodes_by_name_and_type.clear()


# Global default instance
default_skill_graph = NetworkXSkillGraph()
