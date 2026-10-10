# NextStep Career Guidance Platform — Comprehensive Technical Documentation

NextStep is an enterprise-grade, AI-powered career recommendation and skill progression platform. It connects a **Graph Knowledge Engine**, a **Deterministic Multi-Dimensional Scoring Engine**, and a **Semantic RAG Pipeline** with the **NVIDIA NIM GLM-5.3 LLM** to deliver verifiable, transparent, and personalized career roadmaps for students.

---

## 1. Executive Summary & Core Architecture

NextStep eliminates hallucinations in career counseling by grounding every recommendation in a structured Skill Graph and transparent mathematical scoring before synthesizing personalized advice via LLMs.

### End-to-End Pipeline

```
Student Profile (Skills, Interests, Education, Projects, Certs, Experience)
                       │
                       ▼
       Skill Extraction & Canonical Normalization
                       │
                       ▼
           Skill Graph DAG Analysis
   (Matched, Weak, Missing Skills, Prerequisite Blockers)
                       │
                       ▼
     Deterministic Multi-Dimensional Scoring Engine
  (7-Factor Weighted Composite Score: 0.0 – 100.0)
                       │
                       ▼
             Career Ranker Algorithm
      (Sort, Assign Confidence & Diagnostic Breakdown)
                       │
                       ▼
          Top Career Contextual Enrichment
  (Graph Insights + Gap Summary injected into RAG Query)
                       │
                       ▼
        Semantic RAG Pipeline (ChromaDB Vector Store)
   (Dense Retrieval + Lexical-Semantic Hybrid Reranker)
                       │
                       ▼
       NVIDIA NIM GLM-5.3 LLM Inference
                       │
                       ▼
   Complete Personalized Career Recommendation Response
```

---

## 2. Subsystem 1: Skill Graph Knowledge Engine

The Skill Graph module is located in [`skill_graph/`](file:///d:/NextStep/skill_graph/). It models career domains, competencies, learning prerequisites, and professional credentials as a Directed Acyclic Graph (DAG).

### Graph Entities (Nodes)
- **`Skill`**: Canonical technology or conceptual skill (e.g., Python, Linux, Networking, Docker, SIEM).
- **`Career`**: Career pathway (e.g., Cybersecurity Analyst, Backend Developer, Data Analyst, DevOps Engineer, AI/ML Engineer).
- **`JobRole`**: Concrete organizational roles (e.g., SOC Analyst, Security Engineer, Backend API Developer).
- **`Technology`**: Tools and libraries implementing skills (e.g., Wireshark, Splunk, Kubernetes, FastAPI).
- **`Certification`**: Industry credentials validating competencies (e.g., CompTIA Security+, AWS Certified Developer).
- **`Project`**: Practical portfolio milestones (e.g., Home Virtual SOC Lab, REST API Microservice).
- **`Domain`**: Broad industry sectors (e.g., Cybersecurity, Software Development, Cloud Computing, Data Analytics).
- **`Education`**: Degree benchmarks and disciplines.
- **`Student`**: Student profile nodes with validated proficiencies.

### Relationships (Edges)
- `Skill → PREREQUISITE_OF → Skill` (e.g., `Linux` → `Networking` → `Network Security` → `Security Monitoring` → `SIEM`)
- `Skill → RELATED_TO → Skill`
- `Skill → REQUIRED_FOR → Career` (with `importance` weight and `min_level`)
- `Technology → USES → Skill`
- `Certification → VALIDATES → Skill`
- `Project → DEVELOPS → Skill`
- `Career → CONTAINS → JobRole`

### Skill Proficiency Scale (0 to 5)
1. `0` = **No Knowledge**
2. `1` = **Beginner**: Conceptual familiarity, basic tutorials.
3. `2` = **Elementary**: Working knowledge, syntax, core commands.
4. `3` = **Intermediate**: Applied hands-on projects, functional implementations.
5. `4` = **Advanced**: Production-grade system design, scalability.
6. `5` = **Expert**: Deep architectural mastery and optimization.

### Gap Analysis & Next Best Skill Algorithm
Given a student profile and a target career:
1. **Matched Skills**: `student_level >= required_level`.
2. **Weak Skills**: `0 < student_level < required_level`.
3. **Missing Skills**: `student_level == 0`.
4. **Prerequisite Gaps**: Any unfulfilled prerequisite in the transitive DAG closure.
5. **Next Best Skills Priority**:
   $$\text{Priority} = 0.4 \times \text{Career Importance} + 0.3 \times \text{Unblock Count} + 0.2 \times \text{Proximity} + 0.1 \times \text{Readiness}$$

---

## 3. Subsystem 2: Multi-Dimensional Scoring Engine

The Scoring Engine ([`scoring_engine/`](file:///d:/NextStep/scoring_engine/)) calculates deterministic readiness scores (0–100%) across 7 dimensions.

### Dimension Mathematical Models

#### 1. Skill Score (`skill_score.py`)
- Based on Skill Graph gap analysis:
  $$\text{Score} = \text{RawMatch} + \min(10, \text{Coverage} \times 0.1) - \max(0, (100 - \text{PrereqComp}) \times 0.15) - \min(20, \text{CriticalGaps} \times 5.0)$$
- Constrained strictly to $[0.0, 100.0]$.

#### 2. Interest Score (`interest_score.py`)
- Computes semantic alignment between student stated interests and career domain keywords or required skills.
- Default neutral baseline: `50.0` if no interests stated.
- Bonus applied when $\ge 2$ distinct interests align with the target career domain.

#### 3. Education Score (`education_score.py`)
- Maps student degree level (High School=1, Diploma=2, Bachelor=3, Master=4, PhD=5) to career threshold.
- Base level match score (70.0 for meeting requirements) + degree level bonus + field of study bonus (+15.0 for matching Computer Science, IT, etc.).

#### 4. Project Score (`project_score.py`)
- Evaluates practical project portfolio against career required skills and domain vocabulary.
- Rewards projects mentioning required technologies and tools.
- Baseline 20.0–25.0 for general projects; up to 100.0 for multiple high-relevance projects.

#### 5. Certification Score (`certification_score.py`)
- Matches student certifications against career-accredited industry certifications (e.g., CompTIA Security+ for Cybersecurity Analyst, AWS Developer for Backend Developer).
- Rewards initiatives with baseline score (30.0–40.0) and high bonuses for direct credentials (60.0–100.0).

#### 6. Experience Score (`experience_score.py`)
- Maps experience keywords (`beginner`: 30, `junior`: 40, `intermediate`: 60, `senior`: 85, `expert`: 95) or parsed numeric years ($X$ years).

#### 7. Preference Score (`preference_score.py`)
- Evaluates alignment between student's explicitly targeted career and the evaluated career (100.0 if targeted, 70.0 if mentioned in interests, 40.0 otherwise).

### Composite Weighted Score
The final score is computed as:
$$\text{FinalScore} = \sum_{i=1}^{7} W_i \times S_i$$
Default normalized weights:
- **Skills**: $0.35$
- **Interests**: $0.15$
- **Education**: $0.10$
- **Projects**: $0.15$
- **Certifications**: $0.10$
- **Experience**: $0.10$
- **Preference**: $0.05$

### Career Ranker & Confidence Levels
- Careers are sorted in descending order of composite score.
- **Confidence Rating**:
  - `high`: $\text{FinalScore} \ge 70.0$ and $\text{CriticalGaps} == 0$.
  - `medium`: $\text{FinalScore} \ge 50.0$ and $\text{CriticalGaps} \le 2$.
  - `low`: Otherwise.

---

## 4. Subsystem 3: Semantic RAG & LLM Engine

The RAG Pipeline ([`rag/`](file:///d:/NextStep/rag/)) enriches the top ranked career recommendations with grounded knowledge retrieved from [`knowledge_base/`](file:///d:/NextStep/knowledge_base/).

### Retrieval Flow
1. **Knowledge Ingestion**: Structured JSON and Markdown documents parsed from `knowledge_base/careers/`, `certifications/`, `projects/`, etc.
2. **Embeddings**: `FastDenseEmbedding` (384-dimensional dense vectors) or `SentenceTransformerEmbedding`.
3. **Vector Storage**: Local persistent `ChromaDB` (or fast `InMemoryVectorStore` fallback).
4. **Hybrid Reranking**: `LexicalSemanticHybridReranker` combines BM25 term overlap with semantic cosine similarity.
5. **Context Builder**: Combines top reranked chunks with structured Skill Graph gap analysis.
6. **Inference**: NVIDIA NIM GLM-5.3 (`z-ai/glm-5.3`) with temperature 0.2 and structured JSON prompts.

---

## 5. API Reference

The server exposes 13 REST API endpoints:

### End-to-End Recommendation & Scoring
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/recommend` | Full end-to-end pipeline: Skill Graph + Scoring Engine + Career Ranking + RAG + Personalized Advice |
| `POST` | `/api/scoring/rank` | Fast deterministic career ranking without RAG/LLM latency |
| `POST` | `/api/scoring/career` | Detailed 7-dimensional score breakdown for a single target career |

#### Example Request: `POST /api/recommend`
```json
{
  "skills": [
    {"skill": "Networking", "level": 3},
    {"skill": "Linux", "level": 3},
    {"skill": "Python", "level": 2},
    {"skill": "Security Fundamentals", "level": 3}
  ],
  "interests": ["Cybersecurity", "Network Security", "Threat Hunting"],
  "education": "B.Tech Computer Science",
  "projects": ["Wireshark Packet Sniffer", "Home Virtual SOC Lab"],
  "certifications": ["CompTIA Security+"],
  "experience_level": "beginner",
  "target_career": "Cybersecurity Analyst",
  "careers_to_evaluate": ["Cybersecurity Analyst", "Backend Developer", "DevOps Engineer"],
  "include_rag": true
}
```

### Skill Graph Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/skills/extract` | Extract canonical skills & levels from resume or plain text |
| `POST` | `/api/skills/normalize` | Map messy skill aliases to canonical names |
| `GET` | `/api/careers/{career}/skills` | Retrieve required skills, minimum levels, and importances |
| `POST` | `/api/skills/gap-analysis` | Matched, weak, missing skills and DAG prerequisite blockers |
| `POST` | `/api/skills/next-best` | Ranked next best skills to learn |
| `POST` | `/api/careers/match` | Compatibility percentage across all careers |
| `POST` | `/api/learning-path` | Multi-stage topological learning roadmap |

### RAG Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rag/query` | Direct semantic search and RAG guidance |
| `POST` | `/api/rag/ingest` | Ingest knowledge base files into vector database |

### AI Core & Health Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/health` | Healthcheck and NVIDIA NIM connectivity status |
| `POST` | `/api/ai/analyze` | Standalone deterministic skill verification |

---

## 6. Installation & Verification

### Prerequisites
- Python 3.11+
- Windows PowerShell or Bash

### Environment Configuration (`.env`)
```env
NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MODEL_NAME=z-ai/glm-5.3
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
LLM_PROVIDER=nvidia
```

### Running the Test Suite
The test suite contains 49 comprehensive unit and integration tests:
```powershell
# Using the dedicated virtual environment:
C:\Users\absma\.venvs\NextStep\Scripts\python.exe -m pytest -v
```

All 49 tests cover:
- `tests/test_api_endpoints.py`: Core health & deterministic scoring.
- `tests/test_rag.py`: Ingestion, embeddings, retrieval, hybrid reranking, and full RAG queries.
- `tests/test_skill_graph.py`: Nodes, edges, normalization, extraction, DAG gap analysis, learning paths.
- `tests/test_scoring_engine.py`: 7 individual dimensions, weights normalization, career ranker.
- `tests/test_recommendation_pipeline.py`: Full end-to-end integration and API routes.

### Starting the Server
```powershell
.\run_server.bat
# or
C:\Users\absma\.venvs\NextStep\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be accessible at `http://localhost:8000/docs`.
