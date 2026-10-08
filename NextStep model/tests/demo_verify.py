import json
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from skill_graph.schemas import StudentSkill
from skill_graph.skill_gap import skill_gap_analyzer
from skill_graph.graph_queries import graph_queries
from skill_graph.career_mapper import career_mapper

skills = [
    StudentSkill(skill="Python", level=3),
    StudentSkill(skill="Linux", level=2),
    StudentSkill(skill="Networking", level=1),
]

gap = skill_gap_analyzer.analyze_gap(skills, "Cybersecurity Analyst")

print("=== 1. MATCHED SKILLS ===")
for m in gap.matched_skills:
    print(f"  - {m['skill']} (Current: L{m['current_level']} >= Required: L{m['required_level']})")

print("\n=== 2. WEAK SKILLS ===")
for w in gap.weak_skills:
    print(f"  - {w['skill']} (Current: L{w['current_level']} vs Required: L{w['required_level']}) | Gap: {w['gap']} | Unmet Prereqs: {w['unmet_prerequisites']}")

print("\n=== 3. MISSING SKILLS ===")
for ms in gap.missing_skills:
    print(f"  - {ms['skill']} (Required: L{ms['required_level']}, Importance: {ms['importance']}) | Unmet Prereqs: {ms['unmet_prerequisites']}")

print("\n=== 4. PREREQUISITE GAPS ===")
for p in gap.prerequisite_gaps:
    print(f"  - {p['prerequisite_skill']} (Current: L{p['current_level']}, Recommended: L{p['recommended_level']}) -> {p['reason']}")

print("\n=== 5. NEXT BEST SKILLS (RANKED) ===")
for nb in gap.next_best_skills:
    print(f"  - {nb.skill} [Priority: {nb.priority}]: {nb.reason}")

print("\n=== 6. LEARNING PATH (STAGES) ===")
path = graph_queries.get_learning_path(skills, "Cybersecurity Analyst")
for st in path.stages:
    print(f"  Stage {st.stage}: {st.title}")
    print(f"    Skills: {st.skills}")
    if st.projects:
        print(f"    Projects: {st.projects}")
    if st.certifications:
        print(f"    Certifications: {st.certifications}")

print("\n=== 7. CAREER MATCHING ===")
matches = career_mapper.match_careers(skills, top_n=5)
for cm in matches:
    print(f"  - {cm.career}: {cm.compatibility_score}% (Matched: {cm.matched_count}/{cm.total_required})")
