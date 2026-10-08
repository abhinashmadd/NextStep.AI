"""
Career Document Retriever for NextStep RAG Pipeline.
Performs semantic similarity search, metadata filtering, threshold pruning, and deduplication.
"""

from dataclasses import dataclass, field
import hashlib
import os
from typing import Any, Dict, List, Optional
from app.core.logger import logger
from rag.vector_store import BaseVectorStore, VectorDocument, get_vector_store


@dataclass
class RetrievedDoc:
    """Standardized retrieved document format returned to pipelines and downstream consumers."""
    id: str
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    source: str = "Unknown"


class CareerRetriever:
    """
    Retrieves career knowledge documents matching a student query or profile.
    Supports top-k retrieval, relevance score filtering, metadata constraints,
    and semantic deduplication.
    """

    def __init__(
        self,
        vector_store: Optional[BaseVectorStore] = None,
        default_top_k: int = 15,
        relevance_threshold: float = 0.35,
    ):
        self.vector_store = vector_store or get_vector_store()
        self.default_top_k = int(os.getenv("RETRIEVAL_TOP_K", str(default_top_k)))
        self.relevance_threshold = float(os.getenv("RELEVANCE_THRESHOLD", str(relevance_threshold)))

    def _normalize_text_fingerprint(self, text: str) -> str:
        """Create a fingerprint hash from normalized text to detect near-identical duplicates."""
        words = "".join(text.lower().split())
        return hashlib.md5(words[:300].encode("utf-8")).hexdigest()

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
        min_relevance_score: Optional[float] = None,
    ) -> List[RetrievedDoc]:
        """
        Execute semantic retrieval against the vector store.
        Filters out low-relevance results and duplicate chunks.
        """
        k = top_k or self.default_top_k
        threshold = min_relevance_score if min_relevance_score is not None else self.relevance_threshold

        logger.info(
            f"Executing semantic retrieval for query: '{query[:80]}...' "
            f"(top_k={k}, threshold={threshold}, filter={filter_metadata})"
        )

        raw_results = self.vector_store.similarity_search(
            query=query,
            k=k * 2,  # Fetch extra to account for deduplication and threshold pruning
            filter_metadata=filter_metadata,
        )

        deduped_docs: List[RetrievedDoc] = []
        seen_fingerprints = set()

        for doc, score in raw_results:
            # 1. Relevance threshold check
            if score < threshold:
                continue

            # 2. Near-duplicate removal
            fingerprint = self._normalize_text_fingerprint(doc.text)
            if fingerprint in seen_fingerprints:
                continue
            seen_fingerprints.add(fingerprint)

            # 3. Source resolution
            source = (
                doc.metadata.get("source")
                or doc.metadata.get("title")
                or doc.metadata.get("career")
                or "NextStep Knowledge Base"
            )

            deduped_docs.append(
                RetrievedDoc(
                    id=doc.id,
                    text=doc.text,
                    metadata=doc.metadata,
                    score=score,
                    source=str(source),
                )
            )

            if len(deduped_docs) >= k:
                break

        logger.info(f"Retrieved {len(deduped_docs)} relevant career documents after thresholding and deduplication.")
        return deduped_docs
