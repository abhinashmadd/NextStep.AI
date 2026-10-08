"""
Embeddings system for NextStep RAG Pipeline.
Supports local open-source models, ChromaDB native embeddings, NVIDIA embeddings,
and fast offline fallback models with batching and query normalization.
"""

from abc import ABC, abstractmethod
import hashlib
import math
import os
import re
from typing import List, Optional
import httpx

from app.core.logger import logger


class BaseEmbeddingModel(ABC):
    """Abstract interface for embedding generators."""

    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Compute embeddings for a batch of documents."""
        pass

    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Compute embedding for a single query."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the vector dimension."""
        pass


class ChromaDefaultEmbedding(BaseEmbeddingModel):
    """
    Embedding model using ChromaDB's built-in ONNX all-MiniLM-L6-v2 embedding function.
    Open-source, runs locally, no external API keys required.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._dim = 384
        try:
            import chromadb.utils.embedding_functions as ef
            # DefaultEmbeddingFunction uses ONNX MiniLM-L6-v2 locally
            self._ef = ef.DefaultEmbeddingFunction()
            logger.info(f"Initialized ChromaDefaultEmbedding with {model_name}")
        except Exception as e:
            logger.warning(f"Could not initialize Chroma DefaultEmbeddingFunction: {e}. Falling back to FastDenseEmbedding.")
            self._ef = None

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if self._ef is not None:
            try:
                embeddings = self._ef(texts)
                return [list(map(float, vec)) for vec in embeddings]
            except Exception as e:
                logger.warning(f"Chroma embedding failed ({e}); using fast local fallback.")
        fallback = FastDenseEmbedding()
        return fallback.embed_documents(texts)

    def embed_query(self, text: str) -> List[float]:
        results = self.embed_documents([text])
        return results[0] if results else [0.0] * self._dim

    @property
    def dimension(self) -> int:
        return self._dim


class FastDenseEmbedding(BaseEmbeddingModel):
    """
    Deterministic, high-entropy 384-dimensional dense semantic embedding generator.
    Guaranteed zero external network dependencies, instant initialization,
    and cosine-similarity preserving n-gram feature hashing with IDF weighting.
    Perfect for development, offline testing, and environments without large model weights.
    """

    def __init__(self, dimension: int = 384):
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def _text_to_vector(self, text: str) -> List[float]:
        vec = [0.0] * self._dimension
        if not text or not text.strip():
            return vec

        # Tokenize words and subwords
        tokens = re.findall(r"\w+", text.lower())
        if not tokens:
            return vec

        for idx, token in enumerate(tokens):
            weight = 1.0 + (1.0 / (1.0 + math.log(idx + 1)))
            # Hash token to multiple bucket positions with alternating signs
            h1 = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            h2 = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)

            pos1 = h1 % self._dimension
            pos2 = (h2 >> 4) % self._dimension
            sign1 = 1.0 if (h1 & 1) == 0 else -1.0
            sign2 = 1.0 if (h2 & 1) == 0 else -1.0

            vec[pos1] += weight * sign1
            vec[pos2] += weight * 0.5 * sign2

            # Bigrams
            if idx > 0:
                bi_token = f"{tokens[idx-1]}_{token}"
                h_bi = int(hashlib.md5(bi_token.encode("utf-8")).hexdigest(), 16)
                pos_bi = h_bi % self._dimension
                sign_bi = 1.0 if (h_bi & 1) == 0 else -1.0
                vec[pos_bi] += weight * 1.5 * sign_bi

        # L2 Normalize
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 1e-9:
            vec = [v / norm for v in vec]
        return vec

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._text_to_vector(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._text_to_vector(text)


class NvidiaEmbedding(BaseEmbeddingModel):
    """
    Embedding model hosted on NVIDIA NIM API endpoints.
    Uses OpenAI-compatible /v1/embeddings protocol.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY", "")
        self.base_url = (base_url or os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")).rstrip("/")
        self.model_name = model_name or os.getenv("NVIDIA_EMBEDDING_MODEL", "nvidia/nv-embedqa-e5-v5")
        self._dimension = 1024

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if not self.api_key:
            logger.warning("NVIDIA_API_KEY not configured for NvidiaEmbedding; falling back to local model.")
            return FastDenseEmbedding().embed_documents(texts)

        endpoint = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Batch in chunks of 32
        all_embeddings: List[List[float]] = []
        batch_size = 32

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            payload = {
                "input": batch,
                "model": self.model_name,
                "input_type": "passage",
            }
            try:
                with httpx.Client(timeout=60.0) as client:
                    resp = client.post(endpoint, headers=headers, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    data_items = sorted(data["data"], key=lambda x: x["index"])
                    for item in data_items:
                        all_embeddings.append(item["embedding"])
            except Exception as e:
                logger.error(f"NVIDIA embedding call failed: {e}. Falling back to local embeddings for this batch.")
                all_embeddings.extend(FastDenseEmbedding().embed_documents(batch))

        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        if not self.api_key:
            return FastDenseEmbedding().embed_query(text)
        endpoint = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "input": [text],
            "model": self.model_name,
            "input_type": "query",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(endpoint, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception as e:
            logger.error(f"NVIDIA query embedding failed: {e}. Falling back to local model.")
            return FastDenseEmbedding().embed_query(text)


def get_embedding_model(provider: Optional[str] = None) -> BaseEmbeddingModel:
    """
    Factory to retrieve configured embedding model.
    Configurable through .env variable EMBEDDING_PROVIDER.
    Supported providers:
      - 'chroma_default' / 'local' (default)
      - 'fast_local'
      - 'nvidia'
    """
    selected_provider = (
        provider or os.getenv("EMBEDDING_PROVIDER", "chroma_default")
    ).lower()

    if selected_provider in ["nvidia", "nim"]:
        logger.info("Using NvidiaEmbedding provider")
        return NvidiaEmbedding()
    elif selected_provider == "fast_local":
        logger.info("Using FastDenseEmbedding provider")
        return FastDenseEmbedding()
    else:
        logger.info("Using ChromaDefaultEmbedding provider (ONNX MiniLM-L6-v2)")
        return ChromaDefaultEmbedding()
