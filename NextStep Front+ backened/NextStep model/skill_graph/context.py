"""
RAG Integration Interface for NextStep Skill Graph.
Generates structured graph context, skill gap summaries, and augmented queries
for the RAG Retriever and LLM prompting without duplicating RAG internals.
"""

from typing import Any, Dict, List, Optional
from skill_graph.schemas import StudentSkill
from skill_graph.skill_extractor import skill_extractor
from skill_graph.skill_gap import skill_gap_analyzer
from skill_graph.graph_queries import graph_queries


def build_skill_context(
    student_profile: Dict[str, Any],
    target_career: str,
) -> Dict[str, Any]:
    """
    Constructs high-density graph context for RAG retrieval and LLM prompting.

    Returns:
        Dict containing:
        - formatted_context: Clean string for LLM system/user prompt
        - search_query_boosts: Terms to feed into RAG retriever
        - gap_analysis: Raw gap metrics and skill lists
        - next_best_skills: Top 3 priority skills with reasons
        - learning_path_summary: Stage progression overview
    """
    # 1. Extract student skills
    extracted_skills: List[StudentSkill] = skill_extractor.extract_from_profile(student_profile)

    # 2. Execute Graph Gap Analysis
    gap_result = skill_gap_analyzer.analyze_gap(extracted_skills, target_career)

    # 3. Generate Topological Learning Path
    learning_path = graph_queries.get_learning_path(extracted_skills, target_career)

    # 4. Assemble readable summary for LLM context
    matched_names = [f"{m['skill']} (L{m['current_level']})" for m in gap_result.matched_skills]
    weak_names = [f"{w['skill']} (Current L{w['current_level']} vs Req L{w['required_level']})" for w in gap_result.weak_skills]
    missing_names = [f"{m['skill']} (Req L{m['required_level']})" for m in gap_result.missing_skills]
    prereq_names = [f"{p['prerequisite_skill']}" for p in gap_result.prerequisite_gaps]

    next_best_bullets = "\n".join(
        f"  * {nb.skill} (Priority: {nb.priority:.2f}): {nb.reason}"
        for nb in gap_result.next_best_skills[:3]
    )

    path_stages_bullets = "\n".join(
        f"  * Stage {st.stage}: {st.title} -> {st.description}"
        for st in learning_path.stages[:4]
    )

    formatted_context = (
        f"### SKILL GRAPH ANALYSIS FOR TARGET CAREER: {target_career.upper()}\n"
        f"- Verified Matched Skills ({len(matched_names)}): {', '.join(matched_names) if matched_names else 'None yet'}\n"
        f"- Weak / Partial Skills ({len(weak_names)}): {', '.join(weak_names) if weak_names else 'None'}\n"
        f"- Missing Core Skills ({len(missing_names)}): {', '.join(missing_names) if missing_names else 'None'}\n"
        f"- Prerequisite Blockers ({len(prereq_names)}): {', '.join(prereq_names) if prereq_names else 'None'}\n"
        f"- Graph Metrics: Match Score: {gap_result.metrics.get('skill_match_score', 0)}%, "
        f"Coverage: {gap_result.metrics.get('required_skill_coverage', 0)}%, "
        f"Progress: {gap_result.metrics.get('learning_progress', 0)}%\n\n"
        f"- Top Recommended Next Skills:\n{next_best_bullets}\n\n"
        f"- Recommended Learning Roadmap Stages:\n{path_stages_bullets}\n"
    )

    # Retrieval query boost terms (critical missing skills and prerequisites)
    search_terms = [target_career]
    for nb in gap_result.next_best_skills[:3]:
        search_terms.append(nb.skill)
    for p in gap_result.prerequisite_gaps[:2]:
        search_terms.append(p["prerequisite_skill"])

    return {
        "formatted_context": formatted_context,
        "search_query_boosts": search_terms,
        "gap_analysis": gap_result.model_dump(),
        "learning_path": learning_path.model_dump(),
        "metrics": gap_result.metrics,
    }
