"""
Modular vector store interface and implementations for NextStep RAG Pipeline.
Supports persistent local ChromaDB and in-memory fallback, ready for future Pinecone/Qdrant expansion.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from app.core.logger import logger
from rag.embeddings import BaseEmbeddingModel, get_embedding_model


@dataclass
class VectorDocument:
    """Represents a text chunk stored in the vector database."""
    id: str
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


class BaseVectorStore(ABC):
    """Abstract interface for vector database stores."""

    @abstractmethod
    def add_documents(self, documents: List[VectorDocument]) -> List[str]:
        """Add documents and persist embeddings."""
        pass

    @abstractmethod
    def update_documents(self, documents: List[VectorDocument]) -> bool:
        """Update existing documents."""
        pass

    @abstractmethod
    def delete_documents(self, ids: List[str]) -> bool:
        """Delete documents by their IDs."""
        pass

    @abstractmethod
    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[VectorDocument, float]]:
        """
        Search for most similar documents.
        Returns list of (VectorDocument, similarity_score) tuples,
        where higher score means higher relevance (e.g. 0.0 to 1.0).
        """
        pass

    @abstractmethod
    def count(self) -> int:
        """Return total document count."""
        pass

    @abstractmethod
    def clear(self) -> bool:
        """Clear all documents from the store."""
        pass


class ChromaVectorStore(BaseVectorStore):
    """
    Persistent local vector database implemented with ChromaDB.
    Stores embeddings in `data/vector_db/` with ACID guarantees.
    """

    def __init__(
        self,
        persist_directory: str = "data/vector_db",
        collection_name: str = "nextstep_career_kb",
        embedding_model: Optional[BaseEmbeddingModel] = None,
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embedding_model = embedding_model or get_embedding_model()

        os.makedirs(self.persist_directory, exist_ok=True)

        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
            )
            # Create or get collection
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(
                f"Connected to ChromaDB at '{self.persist_directory}' "
                f"(Collection: '{self.collection_name}', items: {self.collection.count()})"
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB ({e}).")
            raise

    def add_documents(self, documents: List[VectorDocument]) -> List[str]:
        if not documents:
            return []

        ids: List[str] = [doc.id for doc in documents]
        texts: List[str] = [doc.text for doc in documents]
        # Clean metadata (ChromaDB allows only str, int, float, bool, or list of primitive types)
        clean_metas: List[Dict[str, Any]] = []
        for doc in documents:
            meta = {}
            for k, v in doc.metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    meta[k] = v
                elif isinstance(v, list):
                    # Convert list of strings to comma-separated string for simpler Chroma filtering
                    meta[k] = ", ".join(str(item) for item in v)
                else:
                    meta[k] = str(v)
            clean_metas.append(meta)

        # Generate embeddings if not present
        embeddings: List[List[float]] = []
        texts_to_embed: List[str] = []
        indices_to_embed: List[int] = []

        for idx, doc in enumerate(documents):
            if doc.embedding is not None and len(doc.embedding) > 0:
                embeddings.append(doc.embedding)
            else:
                texts_to_embed.append(doc.text)
                indices_to_embed.append(idx)

        if texts_to_embed:
            generated = self.embedding_model.embed_documents(texts_to_embed)
            if len(embeddings) == 0:
                embeddings = generated
            else:
                for gen_idx, orig_idx in enumerate(indices_to_embed):
                    embeddings.insert(orig_idx, generated[gen_idx])

        # Upsert into Chroma collection
        self.collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=clean_metas,
            embeddings=embeddings,
        )
        logger.info(f"Upserted {len(documents)} documents into ChromaDB collection '{self.collection_name}'.")
        return ids

    def update_documents(self, documents: List[VectorDocument]) -> bool:
        self.add_documents(documents)
        return True

    def delete_documents(self, ids: List[str]) -> bool:
        if not ids:
            return True
        try:
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents from ChromaDB collection.")
            return True
        except Exception as e:
            logger.error(f"Error deleting documents from ChromaDB: {e}")
            return False

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[VectorDocument, float]]:
        if self.count() == 0:
            return []

        query_vec = self.embedding_model.embed_query(query)
        where_clause = None

        if filter_metadata:
            # Build valid ChromaDB where filter
            filters = []
            for k_meta, v_meta in filter_metadata.items():
                if isinstance(v_meta, list):
                    filters.append({k_meta: {"$in": v_meta}})
                else:
                    filters.append({k_meta: {"$eq": v_meta}})
            if len(filters) == 1:
                where_clause = filters[0]
            elif len(filters) > 1:
                where_clause = {"$and": filters}

        try:
            results = self.collection.query(
                query_embeddings=[query_vec],
                n_results=min(k, self.count()),
                where=where_clause,
                include=["documents", "metadatas", "distances", "embeddings"],
            )
        except Exception as e:
            logger.warning(f"ChromaDB filtered query error ({e}); retrying without metadata filter.")
            results = self.collection.query(
                query_embeddings=[query_vec],
                n_results=min(k, self.count()),
                include=["documents", "metadatas", "distances", "embeddings"],
            )

        output: List[Tuple[VectorDocument, float]] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return output

        ids = results["ids"][0]
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results.get("distances", [[0.0] * len(ids)])[0]

        for doc_id, doc_text, meta, dist in zip(ids, docs, metas, distances):
            # ChromaDB cosine distance = 1 - cosine_similarity.
            # Convert distance to similarity score in [0.0, 1.0]
            sim_score = max(0.0, min(1.0, 1.0 - float(dist)))
            vector_doc = VectorDocument(
                id=doc_id,
                text=doc_text,
                metadata=meta or {},
            )
            output.append((vector_doc, round(sim_score, 4)))

        return output

    def count(self) -> int:
        return self.collection.count()

    def clear(self) -> bool:
        try:
            self.client.delete_collection(self.collection_name)
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            return True
        except Exception as e:
            logger.error(f"Failed to clear ChromaDB collection: {e}")
            return False


class InMemoryVectorStore(BaseVectorStore):
    """
    Lightweight, fast in-memory vector store for unit tests or minimal environments.
    """

    def __init__(self, embedding_model: Optional[BaseEmbeddingModel] = None):
        self.embedding_model = embedding_model or get_embedding_model()
        self.documents: Dict[str, VectorDocument] = {}

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot = sum(a * b for a, b in zip(v1, v2))
        n1 = math.sqrt(sum(a * a for a in v1))
        n2 = math.sqrt(sum(b * b for b in v2))
        if n1 < 1e-9 or n2 < 1e-9:
            return 0.0
        return dot / (n1 * n2)

    def add_documents(self, documents: List[VectorDocument]) -> List[str]:
        ids: List[str] = []
        for doc in documents:
            if doc.embedding is None or len(doc.embedding) == 0:
                doc.embedding = self.embedding_model.embed_query(doc.text)
            self.documents[doc.id] = doc
            ids.append(doc.id)
        return ids

    def update_documents(self, documents: List[VectorDocument]) -> bool:
        self.add_documents(documents)
        return True

    def delete_documents(self, ids: List[str]) -> bool:
        for doc_id in ids:
            self.documents.pop(doc_id, None)
        return True

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[VectorDocument, float]]:
        if not self.documents:
            return []

        query_vec = self.embedding_model.embed_query(query)
        scored: List[Tuple[VectorDocument, float]] = []

        for doc in self.documents.values():
            # Check filter metadata
            if filter_metadata:
                match = True
                for fk, fv in filter_metadata.items():
                    doc_val = doc.metadata.get(fk)
                    if isinstance(fv, list):
                        if doc_val not in fv:
                            match = False
                            break
                    elif doc_val != fv:
                        match = False
                        break
                if not match:
                    continue

            sim = self._cosine_similarity(query_vec, doc.embedding or [])
            score = max(0.0, min(1.0, (sim + 1.0) / 2.0))
            scored.append((doc, round(score, 4)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]

    def count(self) -> int:
        return len(self.documents)

    def clear(self) -> bool:
        self.documents.clear()
        return True


def get_vector_store(
    store_type: Optional[str] = None,
    persist_dir: Optional[str] = None,
    embedding_model: Optional[BaseEmbeddingModel] = None,
) -> BaseVectorStore:
    """
    Factory function to retrieve or initialize the configured vector store.
    Configurable via VECTOR_DB_TYPE env var ('chroma', 'memory').
    """
    selected_type = (
        store_type or os.getenv("VECTOR_DB_TYPE", "chroma")
    ).lower()
    data_dir = persist_dir or os.getenv("VECTOR_DB_PATH", "data/vector_db")

    if selected_type == "memory":
        logger.info("Initializing InMemoryVectorStore")
        return InMemoryVectorStore(embedding_model=embedding_model)

    try:
        logger.info(f"Initializing ChromaVectorStore at '{data_dir}'")
        return ChromaVectorStore(
            persist_directory=data_dir,
            embedding_model=embedding_model,
        )
    except Exception as e:
        logger.warning(f"Could not initialize ChromaVectorStore ({e}); falling back to InMemoryVectorStore.")
        return InMemoryVectorStore(embedding_model=embedding_model)
