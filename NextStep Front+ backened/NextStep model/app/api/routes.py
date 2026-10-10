from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.core.logger import logger
from app.core.exceptions import (
    NextStepException,
    EmptyEvidenceError,
    MissingAPIKeyError,
    InvalidAPIKeyError,
    NVIDIAAPITimeoutError,
    NVIDIAAPIError,
    InvalidAIResponseError,
)
from app.models.schemas import (
    AnalyzeRequest,
    ReAnalyzeRequest,
    AIAnalysisResult,
    HealthResponse,
)
from app.services.workflow_service import workflow_service

router = APIRouter(prefix="/api/ai", tags=["AI Career Analysis"])


@router.get("/health", response_model=HealthResponse)
def check_health():
    """Health check endpoint displaying service and model connectivity status."""
    return HealthResponse(
        status="healthy",
        service="NextStep NVIDIA NIM Backend",
        model=settings.nvidia_model,
        nvidia_configured=settings.is_nvidia_configured,
        masked_key=settings.masked_api_key,
    )


@router.post(
    "/analyze",
    response_model=AIAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Analyze Student Profile, Evidence and Career Requirements",
)
def analyze_career_path(request: AnalyzeRequest):
    """
    Analyzes student background and project evidence against target career requirements
    using NVIDIA NIM GLM-5.3 and deterministic backend scoring.
    """
    if not request.student_evidence or not request.student_evidence.strip():
        raise EmptyEvidenceError("Student evidence is required and cannot be empty.")

    if not request.career_requirements:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one career requirement must be specified.",
        )

    try:
        result = workflow_service.execute_analysis(request)
        return result
    except NextStepException as exc:
        logger.error(f"Analysis failed with NextStepException: {exc.message} (Code: {exc.error_code})")
        raise HTTPException(status_code=exc.status_code, detail={"error": exc.error_code, "message": exc.message})
    except Exception as exc:
        logger.error(f"Unhandled exception during analysis: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred during analysis."},
        )


@router.post(
    "/re-analyze",
    response_model=AIAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Re-analyze Progress After Student Completes Next Best Action",
)
def reanalyze_career_path(request: ReAnalyzeRequest):
    """
    Ingests new evidence produced by completing the recommended Next Best Action,
    re-evaluates readiness, and produces updated recommendations.
    """
    if not request.new_evidence or not request.new_evidence.strip():
        raise EmptyEvidenceError("New evidence is required to perform re-analysis.")

    try:
        updated_result, _ = workflow_service.execute_reanalysis(request)
        return updated_result
    except NextStepException as exc:
        logger.error(f"Re-analysis failed with NextStepException: {exc.message}")
        raise HTTPException(status_code=exc.status_code, detail={"error": exc.error_code, "message": exc.message})
    except Exception as exc:
        logger.error(f"Unhandled exception during re-analysis: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred during re-analysis."},
        )
