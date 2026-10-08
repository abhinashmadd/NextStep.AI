"""
FastAPI Routes for NextStep RAG Career Guidance Pipeline.
Provides endpoints for student query retrieval generation and knowledge base ingestion.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.logger import logger
from rag.pipeline import get_rag_pipeline
from rag.ingestion import KnowledgeBaseIngestion

router = APIRouter(prefix="/api/rag", tags=["RAG Career Guidance"])


class StudentProfileSchema(BaseModel):
    """Student profile attributes informing personalized career guidance."""
    education: Optional[str] = Field(default=None, description="Current education / degree")
    skills: List[str] = Field(default_factory=list, description="Demonstrated skills")
    interests: List[str] = Field(default_factory=list, description="Career interests")
    projects: List[str] = Field(default_factory=list, description="Completed or ongoing projects")
    certifications: List[str] = Field(default_factory=list, description="Earned certifications")
    experience_level: Optional[str] = Field(default="beginner", description="Experience level (e.g. beginner, intermediate)")
    target_career: Optional[str] = Field(default=None, description="Target career role")


class RAGQueryRequest(BaseModel):
    """Input contract for student RAG query."""
    query: str = Field(..., description="Student career question", min_length=2)
    student_profile: Optional[StudentProfileSchema] = Field(
        default=None,
        description="Optional student profile metadata"
    )
    top_k: Optional[int] = Field(default=15, description="Initial candidates to retrieve")
    rerank_top_k: Optional[int] = Field(default=5, description="Final documents after reranking")


class RAGQueryResponse(BaseModel):
    """Output contract for student RAG query."""
    answer: str = Field(..., description="LLM-generated grounded career guidance")
    sources: List[str] = Field(default_factory=list, description="Cited knowledge base sources")
    retrieved_documents: List[str] = Field(default_factory=list, description="Raw text of retrieved documents")
    scores: List[float] = Field(default_factory=list, description="Relevance scores")


class IngestRequest(BaseModel):
    """Optional settings when triggering ingestion."""
    force_reingest: bool = Field(default=False, description="Clear existing store and force re-embedding")


class IngestResponse(BaseModel):
    """Result of knowledge base ingestion."""
    status: str
    scanned_files: int
    processed_files: int
    skipped_files: int
    chunks_ingested: int
    total_documents_in_store: int


@router.post(
    "/query",
    response_model=RAGQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Career Guidance Question via RAG",
)
def rag_career_query(request: RAGQueryRequest):
    """
    Retrieves grounded career guidance using semantic search, reranking,
    and LLM generation over NextStep verified career documents.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty.",
        )

    try:
        profile_dict = request.student_profile.model_dump() if request.student_profile else None
        pipeline = get_rag_pipeline()
        result = pipeline.run(
            query=request.query,
            student_profile=profile_dict,
            top_k=request.top_k or 15,
            rerank_top_k=request.rerank_top_k or 5,
        )

        return RAGQueryResponse(
            answer=result.answer,
            sources=result.sources,
            retrieved_documents=result.retrieved_documents,
            scores=result.scores,
        )
    except Exception as exc:
        logger.error(f"Error processing RAG query: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "RAG_PROCESSING_ERROR", "message": str(exc)},
        )


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger Knowledge Base Ingestion",
)
def trigger_knowledge_ingestion(request: Optional[IngestRequest] = None):
    """
    Scans the knowledge_base/ directory, extracts and chunks documents,
    generates embeddings, and stores them in the persistent vector database.
    """
    force = request.force_reingest if request else False
    try:
        ingestor = KnowledgeBaseIngestion()
        stats = ingestor.ingest_all(force_reingest=force)
        return IngestResponse(**stats)
    except Exception as exc:
        logger.error(f"Error executing knowledge base ingestion: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INGESTION_ERROR", "message": str(exc)},
        )
