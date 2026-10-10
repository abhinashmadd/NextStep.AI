"""
End-to-End RAG Pipeline for NextStep Career Guidance Platform.
Orchestrates:
Student Query/Profile
↓
Query/Intent Processing & Query Expansion
↓
Embedding Generation
↓
Vector Retrieval
↓
Reranking
↓
Context Building & Source Attribution
↓
LLM Grounded Response
↓
Structured Guidance Output
"""

from dataclasses import dataclass, field
import time
from typing import Any, Dict, List, Optional

from app.core.logger import logger
from rag.retriever import CareerRetriever, RetrievedDoc
from rag.reranker import BaseReranker, get_reranker
from rag.context_builder import ContextBuilder
from rag.prompts import (
    NEXTSTEP_SYSTEM_PROMPT,
    construct_rag_query,
    build_rag_user_prompt,
)
from rag.llm import BaseLLM, get_llm
from rag.vector_store import BaseVectorStore, get_vector_store


@dataclass
class RAGResponse:
    """Output contract for the RAG pipeline."""
    answer: str
    sources: List[str]
    retrieved_documents: List[str]
    scores: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)


class RAGPipeline:
    """
    Production-ready Career Guidance RAG Pipeline.
    """

    def __init__(
        self,
        retriever: Optional[CareerRetriever] = None,
        reranker: Optional[BaseReranker] = None,
        context_builder: Optional[ContextBuilder] = None,
        llm: Optional[BaseLLM] = None,
    ):
        self.retriever = retriever or CareerRetriever()
        self.reranker = reranker if reranker is not None else get_reranker()
        self.context_builder = context_builder or ContextBuilder()
        self.llm = llm or get_llm()

    def run(
        self,
        query: str,
        student_profile: Optional[Dict[str, Any]] = None,
        top_k: int = 15,
        rerank_top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> RAGResponse:
        """
        Executes end-to-end RAG query flow.
        """
        start_time = time.time()
        logger.info(f"Initiating RAG pipeline for query: '{query}'")

        # 1. Query Construction & Context Augmentation
        constructed_query = construct_rag_query(query, student_profile)
        logger.info(f"Enriched retrieval query: '{constructed_query}'")

        # 2. Vector Retrieval (Top 10-20)
        retrieved_docs: List[RetrievedDoc] = self.retriever.retrieve(
            query=constructed_query,
            top_k=top_k,
            filter_metadata=filter_metadata,
        )

        retrieval_count = len(retrieved_docs)
        logger.info(f"Retrieved {retrieval_count} candidates from vector store.")

        # 3. Optional Reranking (Refining candidates down to Top 3-5)
        rerank_start = time.time()
        if self.reranker and retrieved_docs:
            final_docs = self.reranker.rerank(
                query=query,
                documents=retrieved_docs,
                top_k=rerank_top_k,
                student_profile=student_profile,
            )
            rerank_duration = time.time() - rerank_start
            logger.info(f"Reranked to {len(final_docs)} documents in {rerank_duration:.3f}s")
        else:
            final_docs = retrieved_docs[:rerank_top_k]
            rerank_duration = 0.0

        # 4. Context Building & Source Extraction
        context_text, sources = self.context_builder.build_context(final_docs)

        # 5. Build Grounded Prompt for LLM
        user_prompt = build_rag_user_prompt(
            query=query,
            context_text=context_text,
            student_profile=student_profile,
        )

        # 6. LLM Generation
        llm_start = time.time()
        answer = self.llm.generate(
            system_prompt=NEXTSTEP_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=2048,
        )
        llm_duration = time.time() - llm_start

        total_duration = time.time() - start_time

        # Format output structures
        doc_texts = [d.text for d in final_docs]
        scores = [d.score for d in final_docs]

        metadata = {
            "retrieved_count": retrieval_count,
            "final_count": len(final_docs),
            "reranking_applied": bool(self.reranker),
            "total_latency_seconds": round(total_duration, 3),
            "llm_latency_seconds": round(llm_duration, 3),
            "rerank_latency_seconds": round(rerank_duration, 3),
        }

        logger.info(f"RAG Pipeline completed in {total_duration:.3f}s. Returning {len(sources)} sources.")

        return RAGResponse(
            answer=answer,
            sources=sources,
            retrieved_documents=doc_texts,
            scores=scores,
            metadata=metadata,
        )


_rag_pipeline_instance: Optional[RAGPipeline] = None


def get_rag_pipeline() -> RAGPipeline:
    """Singleton getter for RAG pipeline."""
    global _rag_pipeline_instance
    if _rag_pipeline_instance is None:
        _rag_pipeline_instance = RAGPipeline()
    return _rag_pipeline_instance
