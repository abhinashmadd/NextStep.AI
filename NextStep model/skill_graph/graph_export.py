"""
Graph Export and Persistence Utilities for NextStep Skill Graph.
Supports JSON serializing and NetworkX GraphML export for interoperability and future Neo4j migration.
"""

import json
import os
from typing import Any, Dict
import networkx as nx

from app.core.logger import logger
from skill_graph.graph import NetworkXSkillGraph


class SkillGraphExporter:
    """
    Serializes and exports the graph to JSON or GraphML formats.
    """

    @classmethod
    def to_json_dict(cls, graph: NetworkXSkillGraph) -> Dict[str, Any]:
        """Convert entire graph to structured JSON-serializable dictionary."""
        nodes = [node.to_dict() for node in graph.get_nodes_by_type.__self__._nodes_by_id.values()]
        edges = [edge.to_dict() for edge in graph.get_edges()]
        return {
            "version": "1.0",
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "node_count": len(nodes),
                "edge_count": len(edges),
            },
        }

    @classmethod
    def save_to_json(cls, graph: NetworkXSkillGraph, filepath: str = "data/skill_graph/exported_graph.json") -> bool:
        """Persist graph structure to a single JSON file."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        try:
            data = cls.to_json_dict(graph)
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Skill Graph exported to JSON: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to export graph to JSON: {e}")
            return False

    @classmethod
    def save_to_graphml(cls, graph: NetworkXSkillGraph, filepath: str = "data/skill_graph/exported_graph.graphml") -> bool:
        """Persist graph structure to GraphML format (compatible with Neo4j / Gephi)."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        try:
            # Flatten dict properties for GraphML compliance
            exportable_graph = nx.MultiDiGraph()
            for n_id, n_data in graph.nx_graph.nodes(data=True):
                clean_attrs = {}
                for k, v in n_data.items():
                    clean_attrs[k] = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
                exportable_graph.add_node(n_id, **clean_attrs)

            for u, v, k, e_data in graph.nx_graph.edges(keys=True, data=True):
                clean_attrs = {}
                for k_attr, v_attr in e_data.items():
                    clean_attrs[k_attr] = json.dumps(v_attr) if isinstance(v_attr, (list, dict)) else str(v_attr)
                exportable_graph.add_edge(u, v, key=str(k), **clean_attrs)

            nx.write_graphml(exportable_graph, filepath)
            logger.info(f"Skill Graph exported to GraphML: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to export graph to GraphML: {e}")
            return False
