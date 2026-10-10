"""
System prompts and prompt generation templates for NextStep RAG Pipeline.
Enforces grounded answers, strict anti-hallucination rules, and personalized guidance.
"""

from typing import Any, Dict, Optional


NEXTSTEP_SYSTEM_PROMPT = """You are NextStep, an AI career guidance assistant for students.

Use the retrieved knowledge base context to provide accurate and personalized career guidance.

Never invent career requirements, certifications, salaries, job statistics, or learning resources when they are not supported by the retrieved context.

If the required information is unavailable, clearly say that the knowledge base does not contain enough information.

Consider the student's:
* education
* current skills
* interests
* projects
* certifications
* target career
* experience level

Explain recommendations clearly and provide actionable next steps."""


def format_student_profile(profile: Optional[Dict[str, Any]]) -> str:
    """Format student profile dictionary into a clean, structured string."""
    if not profile:
        return "No specific student profile provided."

    lines = []
    if profile.get("education"):
        lines.append(f"- Education: {profile['education']}")
    if profile.get("experience_level"):
        lines.append(f"- Experience Level: {profile['experience_level']}")
    if profile.get("target_career"):
        lines.append(f"- Target Career: {profile['target_career']}")
    if profile.get("skills"):
        skills = profile["skills"] if isinstance(profile["skills"], list) else [profile["skills"]]
        lines.append(f"- Current Skills: {', '.join(str(s) for s in skills)}")
    if profile.get("interests"):
        interests = profile["interests"] if isinstance(profile["interests"], list) else [profile["interests"]]
        lines.append(f"- Interests: {', '.join(str(i) for i in interests)}")
    if profile.get("projects"):
        projects = profile["projects"] if isinstance(profile["projects"], list) else [profile["projects"]]
        lines.append(f"- Projects: {', '.join(str(p) for p in projects)}")
    if profile.get("certifications"):
        certs = profile["certifications"] if isinstance(profile["certifications"], list) else [profile["certifications"]]
        lines.append(f"- Certifications: {', '.join(str(c) for c in certs)}")

    return "\n".join(lines) if lines else "Student profile provided with default parameters."


def construct_rag_query(query: str, student_profile: Optional[Dict[str, Any]] = None) -> str:
    """
    Constructs an enriched search query combining the student's primary question
    with their target career and core skills to maximize semantic retrieval relevance.
    """
    query_parts = [query.strip()]
    if student_profile:
        target = student_profile.get("target_career")
        if target and target.lower() not in query.lower():
            query_parts.append(f"Target Career: {target}")

        skills = student_profile.get("skills")
        if skills:
            skills_str = ", ".join(str(s) for s in skills[:4])
            query_parts.append(f"Current Skills: {skills_str}")

    return " | ".join(query_parts)


def build_rag_user_prompt(
    query: str,
    context_text: str,
    student_profile: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Assemble the complete user prompt containing the student profile,
    the retrieved knowledge context, and the student query.
    """
    formatted_profile = format_student_profile(student_profile)

    return f"""### STUDENT PROFILE:
{formatted_profile}

### RETRIEVED KNOWLEDGE BASE CONTEXT:
{context_text}

### STUDENT QUERY:
{query}

### INSTRUCTIONS:
Answer the student's query thoroughly and accurately based strictly on the retrieved knowledge base context above.
Relate the guidance directly to the student's current background, highlighted skills, and career goals.
If any critical requirement or roadmap step is missing from the context, explicitly state what is missing rather than inventing facts.
Provide clear, actionable next steps."""
