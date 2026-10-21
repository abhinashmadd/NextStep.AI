# NextStep — System Architecture & Recent Enhancements Documentation

> **Document Version:** 2.0 (Post-Enhancements)  
> **Product:** NextStep Career Preparation System  
> **Core Principle:** `Student → Evidence → Capability Profiling → Target Career → Gap Analysis → Next Best Action → Iteration`

---

## 1. Executive Summary

**NextStep** is an evidence-driven, student-focused career preparation platform. Rather than relying on self-reported claims, resume buzzwords, or generic roadmaps, NextStep focuses on what students can actively demonstrate through code, technical documents, projects, and coursework. It compares demonstrated competencies against targeted industry career frameworks, identifies high-impact skill gaps, and recommends **one actionable, evidence-producing next step**.

This document captures the complete architectural blueprint and detailed technical documentation of the **recent enhancements ("new editing")**, which upgraded NextStep from a local single-node prototype to a hardened, sharded, secure, and production-ready full-stack application.

---

## 2. Summary of Recent Enhancements ("New Editing")

| Area | Enhancements & Key Changes | Primary Modules / Files |
| :--- | :--- | :--- |
| **Database Sharding** | Implemented deterministic consistent-hash sharding across 4 partitions (`shard_0` – `shard_3`), targeted $O(1)$ workspace routing, cross-shard isolation, parallel multi-shard state aggregation, and auto-migration from legacy storage. | `src/config/sharding.js`, `src/config/database.js`, `scripts/init-mongo-sharding.js`, `test-sharding.js` |
| **Authentication & Security** | Integrated Bcrypt 10-round password encryption, strict server-side validation against injection/XSS, anti-account enumeration with generic errors, and Firebase Auth (Google Sign-In + JWT verification). | `src/modules/auth/auth.controller.js`, `src/modules/auth/auth.validation.js`, `src/config/firebase.js`, `test-security.js` |
| **Brute-Force Protection** | Implemented multi-tier rate limiting tracking account IDs and IP/account combos with a 5-failed-attempt lockout (15-min window), IP flood limits, and HTTP 429 `Retry-After` headers. | `src/middleware/rateLimiter.js`, `server.js` |
| **UI/UX & Visual Refresh** | Applied translucent glassmorphic pipeline cards, streamlined footer with complete platform overview, updated direct empty-state CTAs, custom SVG favicon, and mobile-responsive layout. | `public/visual-refresh.css`, `public/index.html`, `public/app.js`, `public/favicon.svg` |
| **Error Handling & Routing** | Created custom responsive `404.html` page, flexible student identifier matching (Email, Roll Number, Student ID), strict CORS handling, and security headers (`nosniff`, `Cache-Control`). | `public/404.html`, `src/middleware/securityHeaders.js`, `src/middleware/corsMiddleware.js` |
| **Branding Refactoring** | Cleaned up career intelligence interface by replacing confusing AI status indicators with a clear, evidence-driven student experience. | `public/index.html`, `public/app.js` |
| **Unified Orchestration** | Upgraded Node.js (`run_all.js`) and Python (`run_all.py`) orchestrators with concurrent startup, health polling, port conflict alerts, and reverse proxying to Python AI microservices. | `run_all.js`, `run_all.py`, `server.js` |

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NextStep Client (Browser)                       │
│     Vanilla JS + HTML5 + CSS3 (Glassmorphism & Mobile Responsive)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST & Static Assets
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   NextStep Node.js Core Backend (:3000)                │
│                                                                        │
│  ┌────────────────────────── Middleware ────────────────────────────┐  │
│  │ Rate Limiter (Brute-Force) │ Security Headers │ CORS Middleware   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────── Controllers ───────────────────────────┐  │
│  │ Auth (Bcrypt/Firebase)     │ Careers Framework│ Profile & State  │  │
│  │ Evidence & File Uploads    │ Privacy Center   │ Sharding Admin   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────┬───────────────────────────────────────┬────────────────┘
                │ Proxy (/api/ai, /api/rag, etc.)       │ Sharded Storage I/O
                ▼                                       ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│ NextStep Python AI Microservice │   │ Database Sharding Engine         │
│  FastAPI (:8000)                │   │  ├─ Strategy: Consistent Hashing │
│  ├─ RAG Pipeline & Scoring      │   │  ├─ Shards: 4 Partitions         │
│  ├─ Skill Graph & Taxonomy      │   │  ├─ Dual Mode: MongoDB / JSON    │
│  └─ Recommendation Engine       │   │  └─ Shard Keys: studentId/userId │
└─────────────────────────────────┘   └──────────────────────────────────┘
```

---

## 4. Database Sharding Subsystem

### 4.1 Architecture & Consistent Hashing
The sharding layer (`src/config/sharding.js`) partitions student workspaces across $N$ shards (default: 4 partitions). It employs deterministic MD5 consistent hashing:

$$\text{hashKey}(key) = \text{MD5}(key)[0..3] \pmod N$$

```javascript
// src/config/sharding.js
function hashKey(key) {
  if (!key) return 0;
  const hash = crypto.createHash("md5").update(String(key).trim().toLowerCase()).digest();
  return hash.readUInt32BE(0);
}

function getShardIndex(key, count = SHARDS_COUNT) {
  if (count <= 1) return 0;
  return hashKey(key) % count;
}
```

### 4.2 Key Features
1. **$O(1)$ Targeted Single-Shard Routing**:
   - `readUserWorkspace(userId)` and `writeUserWorkspace(userId, workspace)` hash the `userId` and directly operate on `data/shards/shard_{idx}.json`.
   - Bypasses full database deserialization, drastically reducing memory overhead and file lock contention.
2. **Cross-Shard Isolation**:
   - Shards maintain strict tenant boundaries; no user workspace leaks across partitions.
3. **Multi-Shard Parallel Aggregation**:
   - `readShardedState()` executes asynchronous parallel reads across all partition files, stitching together users, sessions, and workspaces for administrative operations and cross-shard integrity checks.
4. **MongoDB Native Sharding Support**:
   - In production environments where MongoDB is enabled, `scripts/init-mongo-sharding.js` provisions native collection sharding:
     - `users`: Hashed shard key `{ studentId: "hashed" }`
     - `evidence`: Hashed shard key `{ studentId: "hashed" }`
     - `profiles`: Hashed shard key `{ studentId: "hashed" }`
     - `audit_logs`: Ranged shard key `{ timestamp: 1 }`
5. **Zero-Downtime Auto-Migration**:
   - On initial launch, `initShards()` inspects `data/prototype_state.json`. If legacy monolithic state exists, it partitions and migrates all existing records into respective partition files with backup preservation.

### 4.3 Sharding Telemetry & Administration Endpoints

* **`GET /api/sharding/stats`**  
  Returns real-time distribution metrics, shard balance score (target: $>0.80$), workspace count per shard, and file health status.
* **`POST /api/sharding/rebalance`**  
  Forces a cross-shard verification scan and resynchronizes workspace allocations across physical partition files.

---

## 5. Authentication & Security Subsystem

### 5.1 Strict Server-Side Validation (`src/modules/auth/auth.validation.js`)
All incoming payloads are strictly sanitized and validated before business logic execution:
* **Student Identifier Validation**: Validates alphanumeric college roll numbers, email addresses, and student IDs.
* **Anti-XSS Name Sanitization**: Rejects tags matching `/<[^>]*script[^>]*>|javascript:|data:/i`.
* **Password Complexity & Bounds**:
  * Minimum: 6 characters.
  * Maximum: 128 characters (explicitly preventing Bcrypt CPU-exhaustion DoS attacks).
* **Mobile Number Normalization**: Strips non-digit characters and extracts clean 10-digit mobile numbers.
* **Explicit Age Consent**: Rejects registration requests without explicit user consent confirmation.

### 5.2 Password Encryption (`src/modules/auth/auth.controller.js`)
* Implements `bcrypt` with a work factor of 10 rounds.
* **Zero Data Leakage Guarantee**: The password and `passwordHash` fields are stripped from all API outputs, session caches, and audit logs.

### 5.3 Brute-Force & Credential-Stuffing Defense (`src/middleware/rateLimiter.js`)
* **Threshold**: Maximum 5 failed login attempts per account identifier or IP/identifier combination.
* **Lockout Period**: 15 minutes (`LOCKOUT_WINDOW_MS = 900000`).
* **IP Flood Prevention**: Max 30 failed attempts across all accounts from a single IP before IP-wide blocking.
* **HTTP 429 Feedback**: Returns `429 Too Many Requests` with a compliant `Retry-After: <seconds>` HTTP header.
* **Automatic Cache Cleanup**: Self-purging in-memory tracking via `.unref()` intervals prevents memory leaks.

### 5.4 Anti-Account Enumeration
NextStep responds with identical generic error messages and response timings regardless of whether an account exists:
```json
{
  "error": "Invalid credentials. Please verify your email, username, or mobile and password."
}
```

### 5.5 Firebase Authentication Integration (`src/config/firebase.js`)
NextStep supports passwordless and social sign-in via Firebase / Google Identity:
1. **Client Setup**: `GET /api/auth/firebase-config` serves client configuration keys safely.
2. **Server-Side Token Verification**:
   - `POST /api/auth/firebase` accepts the client Firebase `idToken`.
   - Decodes and validates JWT claims: `aud` matches project ID, `iss` matches `https://securetoken.google.com/{projectId}`, and signature verification fallback via Google public x509 certificates.
   - Automatically provisions student record, creates unique `badgeId` (e.g. `NS-104928`), establishes secure HTTP-only session cookie (`nextstep_session`), and links targeted career framework.

---

## 6. Frontend & UI/UX Enhancements

### 6.1 Translucent Glassmorphism Design (`public/visual-refresh.css`)
* Translucent pipeline card components with backdrop filter blur (`backdrop-filter: blur(16px)`).
* Refined color scheme avoiding saturated defaults; utilizes modern zinc and slate palettes with royal blue and emerald accents.
* Interactive micro-animations for evidence submission, skill progress bars, and prioritized next-action steps.

### 6.2 Streamlined Header & Footer
* **Header**: Replaced intrusive "AI Online" indicators with a distraction-free, focused interface prioritizing student privacy and workflow clarity.
* **Footer**: Re-engineered footer displaying:
  * Complete platform overview and philosophy.
  * 4-step progressive workflow (`1. Profile Setup → 2. Add Evidence → 3. Skill Analysis → 4. Take Next Step`).
  * Direct links to Privacy Center, Terms, Compliance, and Refund Policy.

### 6.3 Empty States & Direct Action Triggers
* Replaced ambiguous placeholders with immediate action buttons:
  * `"Add your first evidence"` / `"Add your first piece"`.
  * Pre-populates relevant evidence categories directly in the modal.

### 6.4 Custom Error & Favicon Assets
* Custom SVG favicon (`public/favicon.svg`) rendering NextStep's forward-arrow branding.
* Standalone branded `public/404.html` page styled identically to the main application with self-recovery navigation.

---

## 7. API Reference

### Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create a new student account (with validation & Bcrypt) | No |
| `POST` | `/api/auth/login` | Authenticate student (Rate-limited, anti-enumeration) | No |
| `POST` | `/api/auth/firebase` | Authenticate with Firebase Google ID Token | No |
| `GET` | `/api/auth/firebase-config` | Fetch client-side Firebase public configuration | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user session | Session Cookie / Bearer |
| `POST` | `/api/auth/guest` | Generate temporary guest session | No |
| `POST` | `/api/auth/logout` | Invalidate current session | Yes |

### Sharding & System Diagnostics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, uptime, and sharding cluster status |
| `GET` | `/api/sharding/stats` | Detailed partition breakdown, shard sizes, and balance score |
| `POST` | `/api/sharding/rebalance` | Trigger partition resynchronization and rebalancing |

### Core Career & Evidence APIs
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/careers` | Retrieve versioned career frameworks (Software Dev, Embedded, Finance, UX) |
| `GET` | `/api/state` | Retrieve active student workspace, evidence list, and next action |
| `POST` | `/api/profile` | Update student profile (target career, discipline, semester, availability) |
| `POST` | `/api/assessment` | Submit self-assessed skill ratings (tracked strictly as self-claims) |
| `POST` | `/api/evidence` | Upload evidence (text, link, or document file up to 10MB) |
| `DELETE` | `/api/evidence/:id` | Delete specific evidence item and reclaim storage |
| `GET` | `/api/evidence/:id/file` | Download stored evidence artifact |
| `POST` | `/api/analyze` | Trigger deterministic gap calculation & next best action recommendation |
| `POST` | `/api/complete-action` | Mark prioritized action as completed and prompt for new evidence |

### Privacy & Data Governance
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/privacy` | Fetch privacy preferences and audit log summary |
| `POST` | `/api/privacy/consent` | Update data processing consent settings |
| `GET` | `/api/privacy/export` | Download full student portfolio and evidence in machine-readable JSON |
| `DELETE` | `/api/privacy/account` | Right-to-be-forgotten: irreversibly purge all student data across shards |

### AI Microservice Reverse Proxy
The Node.js server proxies requests transparently to the Python FastAPI microservice on port 8000:
* `/api/ai/*`
* `/api/rag/*`
* `/api/skills/*`
* `/api/recommend/*`
* `/api/scoring/*`
* `/api/careers/match`
* `/api/learning-path`

---

## 8. Verification & Test Suites

The repository contains automated end-to-end verification suites covering all tiers:

```powershell
# Run primary backend integration suite
npm test

# Run database sharding suite (distribution, isolation, O(1) routing, live endpoints)
npm run test:shard

# Run authentication & security suite (rate-limiting, Bcrypt, enumeration, Firebase)
npm run test:security

# Run AI microservice integration suite
npm run test:ai
```

### Test Suite Summaries:
* **`test-sharding.js`**:
  * 100% hash determinism across random keys.
  * Uniform partition distribution (at least 25% balance per shard over 200 simulation nodes).
  * Disk file isolation: Confirms writing to Shard $K$ leaves Shards $J \neq K$ untouched.
  * Live server endpoint verification: `/api/health`, `/api/sharding/stats`, `/api/sharding/rebalance`.
* **`test-security.js`**:
  * Server-side input validation rejects malformed emails, short/long passwords, and missing consent with HTTP 400.
  * Bcrypt password encryption verifies plain passwords and hashes are never returned.
  * Anti-enumeration confirms identical HTTP 401 error responses for valid vs invalid identifiers.
  * Rate limiter simulation confirms 5 consecutive failures result in HTTP 429 with `Retry-After`.
  * Firebase JWT verification validates token exchange, user creation, badge ID, and cookie issuance.

---

## 9. Setup, Configuration & Running Guide

### 9.1 Prerequisites
* **Node.js**: Version 20.x or newer.
* **Python** (for AI services): Version 3.10+ with dependencies installed in virtual environment (`NextStep model/requirements.txt`).
* **MongoDB** (Optional): For enterprise sharded cluster; automatically falls back to partitioned file sharding if MongoDB is not present.

### 9.2 Environment Configuration (`.env`)
```ini
# Server Configuration
PORT=3000
HOST=127.0.0.1
DEBUG=false

# Database & Sharding
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=nextstep
SHARDS_COUNT=4
SHARDING_ENABLED=true

# Firebase Authentication (Optional / Pre-configured)
FIREBASE_PROJECT_ID=nextstep-student-auth
FIREBASE_API_KEY=AIzaSyNextStepMockKeyForTesting
FIREBASE_AUTH_DOMAIN=nextstep-student-auth.firebaseapp.com
```

### 9.3 Launching the Application

#### Option A: Unified Orchestrator (Recommended)
Starts both Node.js backend (:3000) and Python AI service (:8000) concurrently with automatic health polling:
```powershell
npm start
```

#### Option B: Standalone Web Backend
```powershell
npm run start:web
# Or in watch mode for development:
npm run dev
```

#### Option C: Python Orchestrator
```powershell
python run_all.py
```

Access the application in your browser:
* Web Application: [http://localhost:3000](http://localhost:3000)
* Health Check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
* Sharding Diagnostics: [http://localhost:3000/api/sharding/stats](http://localhost:3000/api/sharding/stats)

---

## 10. Conclusion

With these recent enhancements, NextStep provides:
1. **High Scalability**: Partitioned horizontal sharding supporting thousands of concurrent student workspaces with constant-time $O(1)$ single-shard queries.
2. **Hardened Security**: Multi-tier rate limiting, Bcrypt hashing, robust input validation, and zero account enumeration.
3. **Flexible Authentication**: Unified student access via institutional IDs, email, phone, and Google Firebase sign-in.
4. **Focused Student UX**: Clean, accessible, mobile-optimized interface centered around evidence demonstration and actionable progress.
