"""
Comprehensive Test Suite for NextStep Career Guidance RAG Pipeline.
Tests:
- Document loading
- Chunking
- Embedding generation
- Vector insertion & persistence
- Semantic retrieval
- Metadata filtering
- Reranking
- Context construction
- Complete end-to-end RAG query flow with at least 5 realistic career queries
"""

import os
import sys
import pytest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Use mock LLM provider for fast, deterministic unit and integration tests
os.environ["LLM_PROVIDER"] = "mock"
os.environ["RELEVANCE_THRESHOLD"] = "0.20"

from fastapi.testclient import TestClient
from main import app
from rag.embeddings import FastDenseEmbedding, get_embedding_model
from rag.vector_store import (
    VectorDocument,
    InMemoryVectorStore,
    get_vector_store,
)
from rag.ingestion import KnowledgeBaseIngestion
from rag.retriever import CareerRetriever, RetrievedDoc
from rag.reranker import LexicalSemanticHybridReranker
from rag.context_builder import ContextBuilder
from rag.prompts import construct_rag_query, build_rag_user_prompt
from rag.llm import MockCareerLLM
from rag.pipeline import RAGPipeline


@pytest.fixture
def sample_documents():
    return [
        VectorDocument(
            id="doc_1",
            text="Cybersecurity Analyst requires skills in Computer Networking, Linux, and Wireshark packet analysis.",
            metadata={"career": "cybersecurity analyst", "category": "careers", "difficulty": "intermediate", "source": "Cyber KB"},
        ),
        VectorDocument(
            id="doc_2",
            text="Cloud DevOps Engineer involves Docker, Kubernetes, CI/CD with GitHub Actions, and Terraform.",
            metadata={"career": "cloud devops engineer", "category": "careers", "difficulty": "intermediate", "source": "DevOps KB"},
        ),
        VectorDocument(
            id="doc_3",
            text="CompTIA Security+ is an entry-level certification covering security operations and threat management.",
            metadata={"career": "cybersecurity analyst", "category": "certifications", "difficulty": "beginner", "source": "Certs KB"},
        ),
        VectorDocument(
            id="doc_4",
            text="Build a Home Virtual SOC Lab with Splunk and Sysmon to detect malicious PowerShell attacks.",
            metadata={"career": "cybersecurity analyst", "category": "projects", "difficulty": "intermediate", "source": "Projects KB"},
        ),
        VectorDocument(
            id="doc_5",
            text="Machine Learning Engineer requires Python, PyTorch, Scikit-Learn, and FastAPI deployment.",
            metadata={"career": "machine learning engineer", "category": "careers", "difficulty": "advanced", "source": "AI KB"},
        ),
    ]


def test_embedding_generation():
    """Verify document, query, and batch embeddings generation."""
    embedder = FastDenseEmbedding(dimension=384)
    query_vec = embedder.embed_query("cybersecurity analyst")
    assert len(query_vec) == 384
    assert any(v != 0.0 for v in query_vec)

    batch_texts = [
        "Network packet analysis with Wireshark",
        "Docker container orchestration with Kubernetes",
    ]
    batch_vecs = embedder.embed_documents(batch_texts)
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 384
    assert len(batch_vecs[1]) == 384


def test_chunking_and_loading():
    """Verify document chunking respects boundaries and preserves headers."""
    ingestor = KnowledgeBaseIngestion()
    sample_text = (
        "This is paragraph one about cybersecurity and network fundamentals.\n\n"
        "This is paragraph two detailing SIEM log analysis using Splunk and Elastic.\n\n"
        "This is paragraph three describing defensive countermeasures and firewalls."
    )
    chunks = ingestor._chunk_text(sample_text, header_context="Context: SOC Role")
    assert len(chunks) >= 1
    assert "Context: SOC Role" in chunks[0]
    assert "cybersecurity" in chunks[0]


def test_vector_insertion_and_search(sample_documents):
    """Verify vector insertion and cosine similarity search in vector store."""
    embedder = FastDenseEmbedding(dimension=384)
    store = InMemoryVectorStore(embedding_model=embedder)

    inserted_ids = store.add_documents(sample_documents)
    assert len(inserted_ids) == 5
    assert store.count() == 5

    # Search for cybersecurity
    results = store.similarity_search("Wireshark network packet analysis", k=3)
    assert len(results) > 0
    top_doc, top_score = results[0]
    assert "doc_1" in top_doc.id or "Wireshark" in top_doc.text
    assert top_score > 0.0


def test_metadata_filtering(sample_documents):
    """Verify metadata filtering isolates specified categories or careers."""
    embedder = FastDenseEmbedding(dimension=384)
    store = InMemoryVectorStore(embedding_model=embedder)
    store.add_documents(sample_documents)

    # Filter only certifications
    results = store.similarity_search(
        "security credentials",
        k=5,
        filter_metadata={"category": "certifications"},
    )
    assert len(results) == 1
    assert results[0][0].id == "doc_3"
    assert results[0][0].metadata["category"] == "certifications"


def test_reranking():
    """Verify reranker re-weights documents according to query terms and student profile."""
    docs = [
        RetrievedDoc(id="1", text="Python programming for machine learning models", score=0.6, source="KB"),
        RetrievedDoc(id="2", text="Computer Networking and Wireshark for SOC analyst", score=0.55, source="KB"),
        RetrievedDoc(id="3", text="General software testing tips", score=0.5, source="KB"),
    ]
    reranker = LexicalSemanticHybridReranker()
    reranked = reranker.rerank(
        query="How do I become a SOC analyst with Wireshark?",
        documents=docs,
        top_k=2,
        student_profile={"target_career": "SOC Analyst", "skills": ["Networking"]},
    )
    assert len(reranked) == 2
    # doc 2 should be boosted to the top because of Wireshark, Networking, and SOC Analyst overlap
    assert reranked[0].id == "2"
    assert "Wireshark" in reranked[0].text


def test_context_construction():
    """Verify context builder groups documents and extracts sources within budget."""
    builder = ContextBuilder(max_tokens=1000)
    docs = [
        RetrievedDoc(id="1", text="Career profile for Cybersecurity Analyst", metadata={"category": "careers"}, score=0.9, source="NextStep Career KB"),
        RetrievedDoc(id="2", text="CompTIA Security+ Exam Guide", metadata={"category": "certifications"}, score=0.85, source="NextStep Certs KB"),
    ]
    context, sources = builder.build_context(docs)
    assert "=== CAREERS ===" in context
    assert "=== CERTIFICATIONS ===" in context
    assert "NextStep Career KB" in sources
    assert "NextStep Certs KB" in sources


def test_realistic_career_queries():
    """
    Verify complete RAG pipeline across at least 5 realistic student career queries.
    """
    embedder = FastDenseEmbedding(dimension=384)
    store = InMemoryVectorStore(embedding_model=embedder)
    ingestor = KnowledgeBaseIngestion(vector_store=store, manifest_path="data/vector_db/test_manifest.json")
    ingest_result = ingestor.ingest_all(force_reingest=True)
    assert ingest_result["chunks_ingested"] > 0

    retriever = CareerRetriever(vector_store=store, default_top_k=10, relevance_threshold=0.1)
    reranker = LexicalSemanticHybridReranker()
    context_builder = ContextBuilder()
    mock_llm = MockCareerLLM()

    pipeline = RAGPipeline(
        retriever=retriever,
        reranker=reranker,
        context_builder=context_builder,
        llm=mock_llm,
    )

    test_queries = [
        {
            "query": "What career is suitable for me?",
            "profile": {
                "education": "B.Tech Computer Science",
                "skills": ["Python", "Linux", "Networking"],
                "interests": ["Security", "Defense"],
                "target_career": "cybersecurity analyst",
            },
            "expected_keyword": "cybersecurity",
        },
        {
            "query": "What skills do I need to become a cybersecurity analyst?",
            "profile": {
                "education": "IT Undergraduate",
                "skills": ["Basics of Computers"],
                "target_career": "cybersecurity analyst",
            },
            "expected_keyword": "skills",
        },
        {
            "query": "I know Python, networking and Linux. What career paths can I pursue?",
            "profile": {
                "skills": ["Python", "Networking", "Linux"],
                "target_career": "cybersecurity analyst",
            },
            "expected_keyword": "career",
        },
        {
            "query": "What projects should I build for cybersecurity?",
            "profile": {
                "target_career": "cybersecurity analyst",
                "skills": ["Linux", "Python"],
            },
            "expected_keyword": "project",
        },
        {
            "query": "What certifications are relevant to this career?",
            "profile": {
                "target_career": "cybersecurity analyst",
                "experience_level": "beginner",
            },
            "expected_keyword": "certification",
        },
        {
            "query": "What is the roadmap from beginner to cybersecurity engineer?",
            "profile": {
                "target_career": "cybersecurity analyst",
                "experience_level": "beginner",
            },
            "expected_keyword": "roadmap",
        },
    ]

    for item in test_queries:
        response = pipeline.run(
            query=item["query"],
            student_profile=item["profile"],
            top_k=8,
            rerank_top_k=3,
        )
        assert len(response.answer) > 0
        assert len(response.retrieved_documents) > 0
        assert len(response.sources) > 0
        assert len(response.scores) > 0
        assert response.metadata["retrieved_count"] > 0


def test_api_rag_endpoints():
    """Verify FastAPI endpoints /api/rag/ingest and /api/rag/query via TestClient."""
    client = TestClient(app)

    # 1. Test Ingestion endpoint with full force re-ingest
    ingest_resp = client.post("/api/rag/ingest", json={"force_reingest": True})
    assert ingest_resp.status_code == 200
    ingest_data = ingest_resp.json()
    assert ingest_data["status"] == "success"
    assert ingest_data["chunks_ingested"] > 0
    assert ingest_data["total_documents_in_store"] > 0

    # 2. Test Query endpoint
    query_payload = {
        "query": "What should I learn to become a cybersecurity analyst?",
        "student_profile": {
            "education": "B.Tech Computer Science 3rd Year",
            "skills": ["Python", "Linux Basics"],
            "interests": ["Security", "Networking"],
            "projects": ["Simple Port Scanner"],
            "certifications": [],
            "experience_level": "beginner",
            "target_career": "cybersecurity analyst",
        },
        "top_k": 10,
        "rerank_top_k": 3,
    }

    query_resp = client.post("/api/rag/query", json=query_payload)
    assert query_resp.status_code == 200
    data = query_resp.json()
    assert "answer" in data
    assert "sources" in data
    assert "retrieved_documents" in data
    assert "scores" in data
    assert len(data["retrieved_documents"]) > 0
