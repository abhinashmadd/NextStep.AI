"""
Reranking engine for NextStep RAG Pipeline.
Refines vector search results (Top 10-20) down to the most relevant items (Top 3-5)
using hybrid lexical-semantic cross-scoring and optional CrossEncoder models.
"""

from abc import ABC, abstractmethod
import math
import os
import re
from typing import Any, Dict, List, Optional

from app.core.logger import logger
from rag.retriever import RetrievedDoc


class BaseReranker(ABC):
    """Abstract interface for document rerankers."""

    @abstractmethod
    def rerank(
        self,
        query: str,
        documents: List[RetrievedDoc],
        top_k: int = 5,
        student_profile: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedDoc]:
        """Rerank documents and return the top-k highest scoring items."""
        pass


class LexicalSemanticHybridReranker(BaseReranker):
    """
    High-performance, lightweight cross-scoring reranker.
    Combines vector semantic similarity with:
    1. Query keyword BM25/TF-IDF term density in the document chunk.
    2. Exact career title and target role matching bonus.
    3. Student profile skill and interest alignment bonus.
    Runs 100% locally with zero extra dependencies and sub-millisecond latency.
    """

    def __init__(self, semantic_weight: float = 0.5, lexical_weight: float = 0.3, profile_weight: float = 0.2):
        self.semantic_weight = semantic_weight
        self.lexical_weight = lexical_weight
        self.profile_weight = profile_weight

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b\w{2,}\b", text)]

    def rerank(
        self,
        query: str,
        documents: List[RetrievedDoc],
        top_k: int = 5,
        student_profile: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedDoc]:
        if not documents:
            return []

        query_tokens = set(self._tokenize(query))
        profile_tokens: set = set()

        if student_profile:
            # Extract profile keywords for relevance alignment
            skills = student_profile.get("skills", [])
            interests = student_profile.get("interests", [])
            target = student_profile.get("target_career", "")
            for s in skills + interests + [target]:
                if s:
                    profile_tokens.update(self._tokenize(str(s)))

        scored_docs: List[RetrievedDoc] = []

        for doc in documents:
            doc_tokens = self._tokenize(doc.text)
            doc_token_counts: Dict[str, int] = {}
            for t in doc_tokens:
                doc_token_counts[t] = doc_token_counts.get(t, 0) + 1

            # 1. Semantic score from vector store (0.0 to 1.0)
            semantic_score = doc.score

            # 2. Lexical term density score
            if query_tokens and doc_tokens:
                matched_query_tokens = [t for t in query_tokens if t in doc_token_counts]
                lexical_score = len(matched_query_tokens) / len(query_tokens)
                # Boost if multiple occurrences
                freq_boost = min(0.3, sum(doc_token_counts.get(t, 0) for t in matched_query_tokens) / 20.0)
                lexical_score = min(1.0, lexical_score + freq_boost)
            else:
                lexical_score = 0.0

            # 3. Student profile alignment score
            if profile_tokens and doc_tokens:
                matched_profile_tokens = [t for t in profile_tokens if t in doc_token_counts]
                profile_score = min(1.0, len(matched_profile_tokens) / max(1, len(profile_tokens)))
            else:
                profile_score = 0.5  # neutral

            # Combined hybrid cross score
            hybrid_score = (
                (self.semantic_weight * semantic_score)
                + (self.lexical_weight * lexical_score)
                + (self.profile_weight * profile_score)
            )

            # Metadata exact career boost
            if student_profile and student_profile.get("target_career"):
                target_career = str(student_profile.get("target_career", "")).lower()
                doc_career = str(doc.metadata.get("career") or doc.metadata.get("target_career") or "").lower()
                if target_career and doc_career and (target_career in doc_career or doc_career in target_career):
                    hybrid_score = min(1.0, hybrid_score + 0.1)

            # Return updated doc copy
            updated_doc = RetrievedDoc(
                id=doc.id,
                text=doc.text,
                metadata=doc.metadata,
                score=round(hybrid_score, 4),
                source=doc.source,
            )
            scored_docs.append(updated_doc)

        scored_docs.sort(key=lambda x: x.score, reverse=True)
        return scored_docs[:top_k]


class CrossEncoderReranker(BaseReranker):
    """
    Reranker using HuggingFace / sentence-transformers CrossEncoder if installed.
    Falls back seamlessly to LexicalSemanticHybridReranker.
    """

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model_name = model_name
        self._model = None
        self._fallback = LexicalSemanticHybridReranker()
        try:
            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(model_name)
            logger.info(f"Loaded CrossEncoder model: {model_name}")
        except Exception as e:
            logger.info(f"CrossEncoder not available ({e}); utilizing hybrid reranker.")

    def rerank(
        self,
        query: str,
        documents: List[RetrievedDoc],
        top_k: int = 5,
        student_profile: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedDoc]:
        if not self._model:
            return self._fallback.rerank(query, documents, top_k, student_profile)

        pairs = [[query, doc.text] for doc in documents]
        try:
            scores = self._model.predict(pairs)
            scored_docs: List[RetrievedDoc] = []
            for doc, score in zip(documents, scores):
                # Sigmoid normalize
                norm_score = 1.0 / (1.0 + math.exp(-float(score)))
                scored_docs.append(
                    RetrievedDoc(
                        id=doc.id,
                        text=doc.text,
                        metadata=doc.metadata,
                        score=round(norm_score, 4),
                        source=doc.source,
                    )
                )
            scored_docs.sort(key=lambda x: x.score, reverse=True)
            return scored_docs[:top_k]
        except Exception as e:
            logger.warning(f"CrossEncoder prediction failed ({e}); falling back.")
            return self._fallback.rerank(query, documents, top_k, student_profile)


def get_reranker() -> Optional[BaseReranker]:
    """
    Factory function to retrieve reranker based on configuration.
    Controlled by RERANKING_ENABLED (default: true).
    """
    enabled_str = os.getenv("RERANKING_ENABLED", "true").lower()
    if enabled_str not in ["true", "1", "yes"]:
        logger.info("Reranking is disabled via RERANKING_ENABLED=false")
        return None

    provider = os.getenv("RERANKER_PROVIDER", "hybrid").lower()
    if provider == "cross_encoder":
        return CrossEncoderReranker()
    return LexicalSemanticHybridReranker()
