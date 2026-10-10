from typing import Dict, Any, Tuple
from app.core.logger import logger
from app.models.schemas import AnalyzeRequest, ReAnalyzeRequest, AIAnalysisResult
from app.services.nvidia_service import nvidia_ai_service
from app.services.scoring_service import DeterministicScoringService


class NextStepWorkflowService:
    """
    Orchestrates the NextStep Career Guidance Workflow:
    Student Profile
    → Target Career
    → Existing Evidence
    → AI Skill Analysis (GLM-5.3)
    → Career Requirement Analysis
    → Skill Gap Detection (Deterministic)
    → Next Best Action
    → [New Evidence Iteration]
    → Re-analysis
    → Updated Recommendation
    """

    def __init__(self, ai_service=nvidia_ai_service, scoring_service=DeterministicScoringService):
        self.ai_service = ai_service
        self.scoring_service = scoring_service

    def execute_analysis(self, request: AnalyzeRequest) -> AIAnalysisResult:
        """
        Execute full initial AI analysis and deterministic calculation pipeline.
        """
        logger.info(
            f"Starting NextStep workflow for student: '{request.student_profile}' -> Target: '{request.target_career}'"
        )

        # 1. AI Skill Analysis using NVIDIA NIM GLM-5.3 with Skill Graph Fallback
        try:
            raw_analysis = self.ai_service.analyze_career_readiness(
                student_profile=request.student_profile,
                target_career=request.target_career,
                student_evidence=request.student_evidence,
                career_requirements=request.career_requirements,
            )
        except Exception as exc:
            logger.warning(
                f"NVIDIA NIM call failed or timed out ({exc}). Executing NextStep Skill Graph inference engine."
            )
            raw_analysis = self._skill_graph_fallback_analysis(request)

        # 2. Deterministic Scoring & Skill Gap Resolution
        refined_analysis = self.scoring_service.validate_and_refine_analysis(
            raw_result=raw_analysis,
            career_requirements=request.career_requirements,
        )

        # 3. Schema validation & structuring
        validated_result = AIAnalysisResult(**refined_analysis)
        logger.info(
            f"NextStep analysis complete. Demonstrated: {len(validated_result.demonstrated_skills)}, "
            f"Gaps: {len(validated_result.skill_gaps)}, Readiness: {validated_result.readiness_score}%"
        )
        return validated_result

    def execute_reanalysis(self, request: ReAnalyzeRequest) -> Tuple[AIAnalysisResult, Dict[str, Any]]:
        """
        Executes re-analysis when a student provides new evidence after completing
        a recommended next best action.
        """
        logger.info(f"Executing NextStep re-analysis iteration for: '{request.target_career}'")

        # Combine previous baseline and new evidence
        combined_evidence = (
            f"Prior Project Baseline:\n{request.prior_evidence.strip()}\n\n"
            f"Newly Completed Evidence:\n{request.new_evidence.strip()}"
        )

        initial_req = AnalyzeRequest(
            student_profile=request.student_profile,
            target_career=request.target_career,
            student_evidence=combined_evidence,
            career_requirements=request.career_requirements,
        )

        updated_analysis = self.execute_analysis(initial_req)

        progression_meta = {
            "workflow_stage": "re-analyzed",
            "new_evidence_processed": True,
            "updated_readiness_score": updated_analysis.readiness_score,
            "updated_next_best_action": updated_analysis.next_best_action.title,
        }

        return updated_analysis, progression_meta

    def _skill_graph_fallback_analysis(self, request: AnalyzeRequest) -> Dict[str, Any]:
        """
        High-precision deterministic analysis fallback using NextStep Skill Graph & Extractor
        when remote NVIDIA NIM endpoint experiences latency or connection timeouts.
        """
        from skill_graph.skill_extractor import skill_extractor

        evidence_text = request.student_evidence or ""
        extracted = skill_extractor.extract_from_text(evidence_text)
        extracted_names = {s.skill.lower(): s.skill for s in extracted}

        req_lower = {r.lower(): r for r in request.career_requirements}
        demonstrated = []
        skill_evidence = []

        for k_low, k_orig in req_lower.items():
            if k_low in extracted_names:
                demonstrated.append(k_orig)
                skill_evidence.append({
                    "skill": k_orig,
                    "evidence": f"Demonstrated in student project evidence ({extracted_names[k_low]}).",
                })
            elif any(k_low in s.lower() or s.lower() in k_low for s in extracted_names):
                demonstrated.append(k_orig)
                skill_evidence.append({
                    "skill": k_orig,
                    "evidence": "Related skill verified in student portfolio.",
                })

        # Check evidence text directly for requirements
        evidence_lower = evidence_text.lower()
        for r in request.career_requirements:
            if r not in demonstrated and r.lower() in evidence_lower:
                demonstrated.append(r)
                skill_evidence.append({
                    "skill": r,
                    "evidence": f"Found direct evidence mention of {r}.",
                })

        demonstrated_set = set(demonstrated)
        gaps = [r for r in request.career_requirements if r not in demonstrated_set]

        total_reqs = len(request.career_requirements) or 1
        readiness = int(round((len(demonstrated) / total_reqs) * 100))
        readiness = max(0, min(100, readiness))

        next_gap = gaps[0] if gaps else (request.career_requirements[0] if request.career_requirements else "Portfolio Project")

        return {
            "demonstrated_skills": demonstrated,
            "skill_evidence": skill_evidence,
            "skill_gaps": gaps,
            "strengths": [f"Demonstrated competence in {s}" for s in demonstrated[:3]] or ["Practical hands-on exploration started"],
            "weaknesses": [f"Lacks verified project evidence for {g}" for g in gaps[:3]],
            "readiness_score": readiness,
            "next_best_action": {
                "title": f"Build a practical project demonstrating {next_gap}",
                "reason": f"{next_gap} is a key requirement for {request.target_career}. Building and documenting a hands-on project closes this gap.",
                "expected_outcome": f"Working deliverable demonstrating {next_gap} with source code in your NextStep portfolio.",
                "difficulty": "Intermediate",
                "estimated_time": "3-5 days",
            },
        }


workflow_service = NextStepWorkflowService()
