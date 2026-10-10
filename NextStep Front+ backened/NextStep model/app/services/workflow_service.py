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

        # 1. AI Skill Analysis using NVIDIA NIM GLM-5.3
        raw_analysis = self.ai_service.analyze_career_readiness(
            student_profile=request.student_profile,
            target_career=request.target_career,
            student_evidence=request.student_evidence,
            career_requirements=request.career_requirements,
        )

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


workflow_service = NextStepWorkflowService()
