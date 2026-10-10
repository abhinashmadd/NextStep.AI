# NextStep Career Guidance Platform — Skill Graph, RAG & AI Engine

NextStep is an AI-powered career guidance platform designed to give students personalized, verified career recommendations based on their skills, interests, education, projects, certifications, and career aspirations.

The platform architecture connects:
1. **Skill Graph Knowledge System**: Models multi-relational graphs of Skills, Careers, Roles, Prerequisites, Projects, and Certifications. Computes skill gaps, next best skills, and topological learning paths.
2. **Deterministic Scoring Engine**: Normalizes evidence, computes mathematical readiness scores (0-100%), resolves skill gaps, and assigns next best actions.
3. **Semantic RAG (Retrieval-Augmented Generation) Pipeline**: Grounded retrieval from local ChromaDB, hybrid lexical-semantic reranking, and NVIDIA NIM GLM-5.3 for verified career guidance.

---

## Target Architecture

```
Student Profile
      │
      ▼
Skill Extraction & Normalization
      │
      ▼
Skill Graph (Nodes, DAG Prerequisites, Dependencies)
      │
      ▼
Skill Gap Analysis (Matched, Weak, Missing, Prerequisite Blockers)
      │
      ▼
Scoring Engine (Readiness Metrics & Gap Verification)
      │
      ▼
RAG Pipeline (Graph Context + Semantic Retrieval + Reranker)
      │
      ▼
LLM Generation (NVIDIA NIM GLM-5.3)
      │
      ▼
Personalized Career Recommendation
```

---

## 1. Skill Graph System

The Skill Graph module is located in [`skill_graph/`](file:///d:/NextStep/skill_graph/) and models the intricate relationships across tech domains:

```
Student → Skills → Skill Levels → Prerequisites → Related Skills → Career Roles → Required Skills → Learning Resources → Projects → Certifications
```

### Node Types
- **`Skill`**: Canonical skill concepts (Python, Linux, Networking, SIEM, Docker, Machine Learning).
- **`Career`**: Career pathways (Cybersecurity Analyst, Backend Developer, Data Analyst, DevOps Engineer, AI/ML Engineer).
- **`JobRole`**: Specific industry roles within careers (SOC Analyst, Security Engineer, Backend API Developer).
- **`Technology`**: Tools and platforms implementing skills (Wireshark, Splunk, Kubernetes, Docker).
- **`Certification`**: Credentials validating competencies (CompTIA Security+, CEH, AWS Solutions Architect).
- **`Project`**: Practical deliverables that build skills (Home Virtual SOC Lab, Python Port Scanner, FastAPI REST API).
- **`Course`**: Curricula teaching skills.
- **`Domain`**: High-level sectors (Cybersecurity, Software Development, Cloud Computing, Data Analytics, AI/ML).
- **`Education`**: Degree requirements and academic benchmarks.
- **`Student`**: Student competency profiles.

### Relationship Types
- `Skill → PREREQUISITE_OF → Skill` (e.g. Linux → Networking → Network Security → Security Monitoring → SIEM)
- `Skill → RELATED_TO → Skill`
- `Skill → PART_OF → Domain`
- `Skill → REQUIRED_FOR → Career`
- `Skill → NEXT_SKILL → Skill`
- `Technology → USES → Skill`
- `Certification → VALIDATES → Skill`
- `Project → DEVELOPS → Skill`
- `Career → CONTAINS → JobRole`
- `JobRole → REQUIRES → Skill`
- `Student → HAS_SKILL → Skill`
- `Student → INTERESTED_IN → Career`
- `Student → COMPLETED → Project`
- `Student → COMPLETED → Certification`

### Skill Level System (0 to 5)
Every skill proficiency is quantified:
- `0` = **No knowledge**
- `1` = **Beginner** (introduced to concepts, basic tutorials)
- `2` = **Elementary** (working knowledge, understand core syntax/tools)
- `3` = **Intermediate** (hands-on project experience, built functioning applications)
- `4` = **Advanced** (production experience, system design, scalable implementation)
- `5` = **Expert** (deep mastery, architectural leadership)

The system stores:
```json
{
  "skill": "Python",
  "level": 3,
  "confidence": 0.85,
  "source": "student_profile"
}
```
*Provenance*: Explicitly distinguishes between `student_profile` (self-reported), `extracted` (evidence-grounded), and `inferred` (deduced from prerequisite trees).

---

## 2. Skill Gap & Prerequisite Traversal

Given a student's skills and a target career, [`skill_graph/skill_gap.py`](file:///d:/NextStep/skill_graph/skill_gap.py) calculates:

1. **Matched Skills**: `current_level >= required_level`.
2. **Weak Skills**: `0 < current_level < required_level` (high ROI quick wins).
3. **Missing Skills**: `current_level == 0`.
4. **Prerequisite Gaps**: Any transitive prerequisite in the DAG that the student has not mastered to at least Level 2.
5. **Next Best Skills**: Ranked learning targets prioritizing:
   - Foundational prerequisites that unblock multiple career skills.
   - Weak skills close to meeting career thresholds.
   - High-importance missing skills whose prerequisites are satisfied.
6. **Scoring Engine Metrics**:
   - `skill_match_score` (0-100)
   - `required_skill_coverage` (0-100)
   - `prerequisite_completion` (0-100)
   - `skill_gap_count`
   - `critical_skill_gap_count` (importance >= 0.85)
   - `learning_progress` (0-100)

---

## 3. Learning Path Generation

The function `get_learning_path(student_skills, target_career)` builds a topological sequence of stages from the prerequisite Directed Acyclic Graph (DAG):

- Groups unmet skills into sequential stages.
- Guarantees foundational prerequisites (Linux, Networking, Computer Science basics) precede specialized skills (SIEM, Incident Response, Kubernetes).
- Attaches hands-on portfolio projects and certifications relevant to each stage.

---

## 4. Multi-Career Compatibility Matching

[`skill_graph/career_mapper.py`](file:///d:/NextStep/skill_graph/career_mapper.py) computes compatibility percentages across all careers in the graph:
```
Student: Python=3, Linux=2, Networking=1
- Backend Developer: 84%
- Cybersecurity Analyst: 78%
- Data Analyst: 72%
- DevOps Engineer: 61%
```
## 4. Deterministic Multi-Dimensional Scoring Engine

Located in [`scoring_engine/`](file:///d:/NextStep/scoring_engine/), the Scoring Engine calculates weighted compatibility scores ($0.0$ to $100.0\%$) across 7 dimensions:

| Dimension | Module | Description & Baseline | Default Weight |
|---|---|---|---|
| **Skill Match** | [`skill_score.py`](file:///d:/NextStep/scoring_engine/skill_score.py) | Graph match %, coverage bonus, prereq penalty, critical gap penalty | **35%** |
| **Interests** | [`interest_score.py`](file:///d:/NextStep/scoring_engine/interest_score.py) | Alignment with career domain keywords and required skill taxonomy | **15%** |
| **Education** | [`education_score.py`](file:///d:/NextStep/scoring_engine/education_score.py) | Degree hierarchy (Bachelor, Master) + field relevance bonus | **10%** |
| **Projects** | [`project_score.py`](file:///d:/NextStep/scoring_engine/project_score.py) | Portfolio relevance to required technologies & domain tools | **15%** |
| **Certifications** | [`certification_score.py`](file:///d:/NextStep/scoring_engine/certification_score.py) | Industry credential matching (Security+, AWS Developer, etc.) | **10%** |
| **Experience** | [`experience_score.py`](file:///d:/NextStep/scoring_engine/experience_score.py) | Proficiency level mapping & parsed numeric years of experience | **10%** |
| **Preference** | [`preference_score.py`](file:///d:/NextStep/scoring_engine/preference_score.py) | Explicit student target career alignment bonus | **5%** |

### Career Ranking & Diagnostics
[`scoring_engine/career_ranker.py`](file:///d:/NextStep/scoring_engine/career_ranker.py) ranks careers by composite score and returns:
- Numerical rank (`1`, `2`, `3`...)
- Confidence tiers:
  - `high`: Score $\ge 70\%$ and $0$ critical gaps
  - `medium`: Score $\ge 50\%$ and $\le 2$ critical gaps
  - `low`: Score $< 50\%$ or $> 2$ critical gaps
- Detailed score breakdown, matched/weak/missing skills, recommended next skills, and topological learning stages.

---

## 5. End-to-End Career Recommendation Pipeline

Located in [`api/recommendation_pipeline.py`](file:///d:/NextStep/api/recommendation_pipeline.py), the pipeline brings together:
1. **Extraction**: Profile skills parsed and canonicalized via Skill Graph.
2. **Scoring**: Multi-career evaluation across all 7 dimensions.
3. **Ranking**: Careers sorted with confidence and diagnostic breakdowns.
4. **Context Injection**: Top career gap analysis and insights injected into the RAG query.
5. **RAG & LLM**: Grounded semantic search in ChromaDB, hybrid BM25/cosine reranking, and NVIDIA NIM GLM-5.3 generation.

---

## 6. Complete API Endpoints

The FastAPI server exposes 13 REST endpoints:

### End-to-End Recommendation & Scoring
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/recommend` | Complete pipeline: Profile → Graph → Scoring → Ranking → RAG → LLM |
| `POST` | `/api/scoring/rank` | Fast deterministic multi-career ranking without RAG/LLM latency |
| `POST` | `/api/scoring/career` | Detailed 7-dimensional score breakdown for a single career |

### Skill Graph Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/skills/extract` | Extract canonical skills & levels (1-5) from resume or text |
| `POST` | `/api/skills/normalize` | Map messy skill aliases to canonical skill names |
| `GET` | `/api/careers/{career}/skills` | Retrieve required skills, importance, and minimum levels |
| `POST` | `/api/skills/gap-analysis` | Computes matched, weak, missing, prerequisite gaps, and metrics |
| `POST` | `/api/skills/next-best` | Returns ranked Next Best Skills to learn next |
| `POST` | `/api/careers/match` | Comparative compatibility percentages across careers |
| `POST` | `/api/learning-path` | Generates DAG-ordered multi-stage learning roadmaps |

### Semantic RAG Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rag/query` | Grounded career guidance query using vector search, reranker, and LLM |
| `POST` | `/api/rag/ingest` | Incremental ingestion of `knowledge_base/` files into ChromaDB |

### Core AI & Health Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ai/health` | Healthcheck and NVIDIA NIM connectivity status |
| `POST` | `/api/ai/analyze` | Standalone deterministic skill verification |

---

## 7. How to Add New Graph Data

All seed data is stored in [`data/skill_graph/`](file:///d:/NextStep/data/skill_graph/):

1. **Add a Skill**: Edit [`data/skill_graph/skills.json`](file:///d:/NextStep/data/skill_graph/skills.json):
   ```json
   {
     "id": "skill_terraform",
     "name": "Terraform",
     "category": "Infrastructure as Code",
     "domain": "Cloud Computing",
     "description": "Declarative multi-cloud infrastructure provisioning tool.",
     "aliases": ["terraform", "iac", "hashicorp terraform"]
   }
   ```
2. **Add a Career**: Edit [`data/skill_graph/careers.json`](file:///d:/NextStep/data/skill_graph/careers.json):
   ```json
   {
     "id": "career_sre",
     "name": "Site Reliability Engineer",
     "domain": "Cloud Computing",
     "required_skills": [
       {"skill": "Linux", "importance": 1.0, "min_level": 4},
       {"skill": "Docker", "importance": 0.9, "min_level": 3},
       {"skill": "CI/CD", "importance": 0.85, "min_level": 3}
     ]
   }
   ```
3. **Add Relationships / Prerequisites**: Edit [`data/skill_graph/relationships.json`](file:///d:/NextStep/data/skill_graph/relationships.json):
   ```json
   {"source": "Docker", "target": "Kubernetes", "type": "PREREQUISITE_OF"}
   ```

To reload graph data in memory:
```python
from skill_graph.graph_loader import load_default_skill_graph
load_default_skill_graph()
```

---

## 8. Running Tests

The test suite contains **49 comprehensive unit and integration tests**:

```bash
# Run all 49 tests across API, RAG, Scoring Engine, and Skill Graph
pytest -v

# Run Scoring Engine tests only
pytest tests/test_scoring_engine.py -v

# Run Recommendation Pipeline integration tests
pytest tests/test_recommendation_pipeline.py -v

# Run Skill Graph tests only
pytest tests/test_skill_graph.py -v

# Run RAG tests only
pytest tests/test_rag.py -v
```

For complete architectural specifications, see [`documentation.md`](file:///d:/NextStep/documentation.md).

