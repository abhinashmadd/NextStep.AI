"""
Comprehensive Test Suite for NextStep Skill Graph System.
Verifies:
1. Graph initialization & node creation
2. Graph relationships & edges
3. Skill normalization & alias handling
4. Skill extraction & level estimation from text
5. Prerequisite DAG traversal
6. Comprehensive skill gap analysis (matched, weak, missing, prerequisite gaps)
7. Next-best-skill prioritization
8. Multi-career compatibility matching
9. Topological learning path generation
10. RAG context building interface
11. Complete API route execution via TestClient
"""

import os
import sys
import pytest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from skill_graph.schemas import (
    NodeType,
    RelationType,
    StudentSkill,
)
from skill_graph.graph import NetworkXSkillGraph
from skill_graph.nodes import SkillNode, CareerNode
from skill_graph.edges import Edge
from skill_graph.skill_normalizer import SkillNormalizer
from skill_graph.skill_extractor import SkillExtractor
from skill_graph.skill_gap import SkillGapAnalyzer
from skill_graph.career_mapper import CareerMapper
from skill_graph.graph_queries import (
    SkillGraphQueries,
    get_required_skills,
    get_prerequisites,
    get_dependent_skills,
    get_career_roles,
    get_careers_for_skill,
)
from skill_graph.graph_loader import SkillGraphLoader
from skill_graph.context import build_skill_context


@pytest.fixture(scope="module")
def loaded_graph():
    """Initializes and loads the sample dataset into a fresh graph."""
    g = NetworkXSkillGraph()
    loader = SkillGraphLoader(graph=g)
    loader.load()
    return g


# Test 1: Graph creation and node insertion
def test_graph_creation_and_nodes():
    g = NetworkXSkillGraph()
    assert g.node_count() == 0

    s1 = SkillNode(id="skill_python", name="Python", category="Programming")
    c1 = CareerNode(id="career_backend", name="Backend Developer")

    g.add_node(s1)
    g.add_node(c1)

    assert g.node_count() == 2
    assert g.has_node("skill_python")
    assert g.has_node("career_backend")
    assert g.get_node("skill_python").name == "Python"


# Test 2: Relationships and edges
def test_graph_relationships():
    g = NetworkXSkillGraph()
    s1 = SkillNode(id="skill_linux", name="Linux")
    s2 = SkillNode(id="skill_networking", name="Networking")
    g.add_node(s1)
    g.add_node(s2)

    edge = Edge(source_id="skill_linux", target_id="skill_networking", relation_type=RelationType.PREREQUISITE_OF)
    g.add_edge(edge)

    assert g.edge_count() == 1
    assert g.has_edge("skill_linux", "skill_networking", RelationType.PREREQUISITE_OF)

    neighbors = g.get_neighbors("skill_linux", relation_type=RelationType.PREREQUISITE_OF, direction="out")
    assert len(neighbors) == 1
    assert neighbors[0].name == "Networking"


# Test 3: Skill normalization
def test_skill_normalization():
    normalizer = SkillNormalizer()
    assert normalizer.normalize("python programming") == "Python"
    assert normalizer.normalize("JS") == "JavaScript"
    assert normalizer.normalize("node") == "Node.js"
    assert normalizer.normalize("linux os") == "Linux"
    assert normalizer.normalize("machine learning") == "Machine Learning"
    assert normalizer.normalize("ML") == "Machine Learning"
    assert normalizer.normalize("k8s") == "Kubernetes"
    assert normalizer.normalize("unknown_skill_xyz") is None


# Test 4: Skill extraction with level inference
def test_skill_extraction_from_text():
    extractor = SkillExtractor()
    text = "I know Python, Linux and basic networking. I have built a port scanner."
    skills = extractor.extract_from_text(text)
    skill_names = {s.skill: s.level for s in skills}

    assert "Python" in skill_names
    assert "Linux" in skill_names
    assert "Networking" in skill_names
    assert "Port Scanning" in skill_names

    # Check evidence-grounded level estimation
    # "basic networking" -> level 1 or 2
    assert skill_names["Networking"] in [1, 2]
    # "built a port scanner" -> level 2 or 3
    assert skill_names["Port Scanning"] in [2, 3]


# Test 5: Prerequisite DAG traversal
def test_prerequisite_traversal(loaded_graph):
    queries = SkillGraphQueries(graph=loaded_graph)
    # Networking depends on Linux
    prereqs = queries.get_prerequisites("Networking")
    assert "Linux" in prereqs

    # SIEM depends on Security Monitoring
    siem_prereqs = queries.get_prerequisites("SIEM")
    assert "Security Monitoring" in siem_prereqs

    # Downstream dependents of Linux
    linux_deps = queries.get_dependent_skills("Linux")
    assert "Networking" in linux_deps or "Docker" in linux_deps


# Test 6: Skill gap analysis for Cybersecurity Analyst
def test_skill_gap_analysis(loaded_graph):
    analyzer = SkillGapAnalyzer(graph=loaded_graph)
    student_skills = [
        StudentSkill(skill="Python", level=3),
        StudentSkill(skill="Linux", level=2),
        StudentSkill(skill="Networking", level=1),
    ]

    result = analyzer.analyze_gap(student_skills, "Cybersecurity Analyst")

    matched = [m["skill"] for m in result.matched_skills]
    weak = [w["skill"] for w in result.weak_skills]
    missing = [m["skill"] for m in result.missing_skills]

    # Python req is level 2, student has 3 -> matched!
    assert "Python" in matched
    # Linux req is level 3, student has 2 -> weak!
    assert "Linux" in weak
    # Networking req is level 3, student has 1 -> weak!
    assert "Networking" in weak
    # SIEM, Incident Response, Security Fundamentals -> missing!
    assert "SIEM" in missing
    assert "Security Fundamentals" in missing

    # Metrics
    assert result.metrics["skill_gap_count"] > 0
    assert result.metrics["skill_match_score"] > 0.0


# Test 7: Next-best-skill prioritization
def test_next_best_skills(loaded_graph):
    queries = SkillGraphQueries(graph=loaded_graph)
    student_skills = [
        StudentSkill(skill="Python", level=3),
        StudentSkill(skill="Linux", level=2),
        StudentSkill(skill="Networking", level=1),
    ]

    next_best = queries.get_next_best_skills(student_skills, "Cybersecurity Analyst", limit=4)
    assert len(next_best) > 0

    next_skills = [nb.skill for nb in next_best]
    # Linux or Networking or Security Fundamentals should be high priority
    assert any(s in ["Linux", "Networking", "Security Fundamentals"] for s in next_skills)
    assert all(nb.priority > 0.0 for nb in next_best)
    assert all(len(nb.reason) > 0 for nb in next_best)


# Test 8: Multi-career compatibility matching
def test_career_matching(loaded_graph):
    mapper = CareerMapper(graph=loaded_graph)
    student_skills = [
        StudentSkill(skill="Python", level=3),
        StudentSkill(skill="Linux", level=2),
        StudentSkill(skill="Networking", level=2),
        StudentSkill(skill="SQL", level=2),
    ]

    matches = mapper.match_careers(student_skills, top_n=5)
    assert len(matches) >= 3

    career_names = [m.career for m in matches]
    assert "Backend Developer" in career_names
    assert "Cybersecurity Analyst" in career_names

    # All scores between 0 and 100
    for m in matches:
        assert 0.0 <= m.compatibility_score <= 100.0


# Test 9: Topological learning path generation
def test_learning_path_generation(loaded_graph):
    queries = SkillGraphQueries(graph=loaded_graph)
    student_skills = [
        StudentSkill(skill="Python", level=3),
        StudentSkill(skill="Linux", level=1),
        StudentSkill(skill="Networking", level=1),
    ]

    path = queries.get_learning_path(student_skills, "Cybersecurity Analyst")
    assert path.target_career == "Cybersecurity Analyst"
    assert path.total_stages > 1

    stage_titles = [st.title for st in path.stages]
    # Earliest stages must focus on Linux / Networking / Security fundamentals
    first_stage_skills = path.stages[0].skills
    assert any(s in ["Linux", "Networking", "Security Fundamentals"] for s in first_stage_skills)


# Test 10: RAG Context Builder Integration
def test_rag_context_integration():
    profile = {
        "education": "B.Tech Computer Science",
        "skills": ["Python", "Linux Basics"],
        "projects": ["Built a port scanner"],
        "target_career": "Cybersecurity Analyst",
    }
    context_data = build_skill_context(profile, "Cybersecurity Analyst")
    assert "formatted_context" in context_data
    assert "SKILL GRAPH ANALYSIS" in context_data["formatted_context"]
    assert "search_query_boosts" in context_data
    assert len(context_data["search_query_boosts"]) > 0


# Test 11: Skill Graph API endpoints
def test_skill_graph_api_endpoints():
    client = TestClient(app)

    # 1. POST /api/skills/extract
    ext_resp = client.post("/api/skills/extract", json={"text": "I know Python and Docker."})
    assert ext_resp.status_code == 200
    ext_data = ext_resp.json()
    extracted_names = [s["skill"] for s in ext_data["extracted_skills"]]
    assert "Python" in extracted_names
    assert "Docker" in extracted_names

    # 2. POST /api/skills/normalize
    norm_resp = client.post("/api/skills/normalize", json={"skills": ["python programming", "JS"]})
    assert norm_resp.status_code == 200
    norm_data = norm_resp.json()
    assert norm_data["normalized"]["python programming"] == "Python"
    assert norm_data["normalized"]["JS"] == "JavaScript"

    # 3. GET /api/careers/{career}/skills
    c_resp = client.get("/api/careers/Cybersecurity Analyst/skills")
    assert c_resp.status_code == 200
    skills_data = c_resp.json()
    assert len(skills_data) > 0

    # 4. POST /api/skills/gap-analysis
    gap_payload = {
        "student_skills": [
            {"skill": "Python", "level": 3},
            {"skill": "Linux", "level": 2},
            {"skill": "Networking", "level": 1},
        ],
        "target_career": "Cybersecurity Analyst",
    }
    gap_resp = client.post("/api/skills/gap-analysis", json=gap_payload)
    assert gap_resp.status_code == 200
    gap_data = gap_resp.json()
    assert len(gap_data["matched_skills"]) > 0
    assert len(gap_data["weak_skills"]) > 0
    assert len(gap_data["missing_skills"]) > 0
    assert "metrics" in gap_data

    # 5. POST /api/skills/next-best
    nb_resp = client.post("/api/skills/next-best", json=gap_payload)
    assert nb_resp.status_code == 200
    nb_data = nb_resp.json()
    assert len(nb_data) > 0

    # 6. POST /api/careers/match
    match_resp = client.post("/api/careers/match", json={"student_skills": gap_payload["student_skills"], "top_n": 3})
    assert match_resp.status_code == 200
    match_data = match_resp.json()
    assert len(match_data) == 3

    # 7. POST /api/learning-path
    lp_resp = client.post("/api/learning-path", json=gap_payload)
    assert lp_resp.status_code == 200
    lp_data = lp_resp.json()
    assert lp_data["total_stages"] > 0
