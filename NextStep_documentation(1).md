# NextStep --- Complete Product & Technical Documentation

> **Version:** 1.0 --- Final Prototype Design\
> **Product:** NextStep\
> **Audience:** Hackathon team, developers, AI/ML developers, UI/UX
> team, documentation/presentation team, judges\
> **Primary user:** Students preparing for jobs, internships, or career
> roles\
> **Core principle:**\
> **Student → Evidence → Skill Profile → Target Career → Gap → Next Best
> Action → New Evidence → Re-analysis → Next Action**

------------------------------------------------------------------------

# 1. Executive Summary

## 1.1 What is NextStep?

**NextStep** is a student-only, evidence-driven career preparation
system.

Instead of asking only:

> "What skills do you know?"

NextStep asks two questions:

1.  **What do you say you know?**
2.  **What can you actually demonstrate through the work you have
    done?**

It then compares the student's demonstrated capabilities with the
requirements of a selected target career, identifies the most important
current gap, and recommends **one feasible Next Best Action**.

The student performs that action and submits new evidence. NextStep
analyzes the new evidence, updates the student's capability profile,
recalculates the remaining gaps, and recommends the next action.

This creates a continuous loop rather than a static career roadmap.

------------------------------------------------------------------------

## 1.2 Core Product Promise

> **"Show us what you know. Show us what you have done. NextStep will
> tell you what you should do next --- and why."**

------------------------------------------------------------------------

## 1.3 Problem Being Solved

Students preparing for careers commonly face:

-   uncertainty about what to learn next;
-   too many courses and resources;
-   difficulty knowing whether their current skills are actually
    sufficient;
-   over-reliance on resumes and self-reported skills;
-   generic career roadmaps;
-   skill-gap lists without prioritization;
-   recommendations that ignore prerequisites;
-   recommendations that are unrealistic for the student's current level
    or available time;
-   lack of feedback after completing projects;
-   difficulty converting projects into meaningful evidence of
    capability;
-   privacy concerns when uploading resumes, code, reports, portfolios
    and academic information.

NextStep focuses on the decision:

> **"Given what I have already demonstrated and the career I want, what
> is the most useful thing I should do now?"**

------------------------------------------------------------------------

# 2. Product Scope

## 2.1 Target Users

NextStep is designed for **students only**.

The architecture is domain-independent and can eventually support
students from:

-   Computer Science
-   Information Technology
-   Electronics and Communication
-   Electrical Engineering
-   Mechanical Engineering
-   Civil Engineering
-   Medical/Healthcare-related education
-   Commerce
-   Management
-   Arts
-   Humanities
-   Design
-   Science
-   Other academic disciplines

The core engine remains the same. The **domain/career knowledge layer**
changes.

------------------------------------------------------------------------

## 2.2 Primary Use Cases

### Use Case A --- Student knows a target career

Example:

> B.Tech ECE student → Embedded Systems Engineer

NextStep analyzes existing work and determines the next useful action.

### Use Case B --- Student knows skills but has little evidence

Example:

> "I know Python and SQL."

But no meaningful project exists.

NextStep can identify that the skills are **claimed/unverified** and
recommend an evidence-producing project.

### Use Case C --- Student has projects but does not know their actual gaps

The student uploads:

-   project code;
-   report;
-   GitHub repository;
-   portfolio;
-   assignment;
-   internship work.

NextStep extracts demonstrated capabilities and compares them with the
target role.

### Use Case D --- Student completed a recommendation

The student uploads the new work.

NextStep re-analyzes the evidence and updates the student's capability
profile.

------------------------------------------------------------------------

# 3. Product Goals

## 3.1 Primary Goals

NextStep should:

1.  Understand the student's current state.
2.  Use actual work as evidence.
3.  Distinguish claims from demonstrated capability.
4.  Build an evidence-based skill profile.
5.  Use structured career requirements.
6.  Identify meaningful skill gaps.
7.  Prioritize gaps using dependencies and context.
8.  Recommend one practical next action.
9.  Explain why that action was selected.
10. Verify new evidence after the student acts.
11. Update the student's profile continuously.
12. Protect student data throughout the lifecycle.

------------------------------------------------------------------------

## 3.2 Non-Goals for the First MVP

NextStep should **not** attempt to become all of the following
simultaneously:

-   a full job portal;
-   a recruiter marketplace;
-   a college placement management system;
-   a huge course marketplace;
-   a social network;
-   a generic chatbot;
-   a resume-only analyzer;
-   a generic psychometric career test;
-   a complete LMS.

These can be considered future integrations only if they strengthen the
core loop.

------------------------------------------------------------------------

# 4. Core Product Flow

The original 15-step core flow is intentionally preserved.

## 4.1 Core Flow

``` text
1. Student Profile
        ↓
2. Target Career
        ↓
3. Self Assessment
        ↓
4. Actual Work / Evidence
        ↓
5. AI Evidence Analysis
        ↓
6. Evidence-Based Skill Profile
        ↓
7. Career Requirements
        ↓
8. Skill Gap
        ↓
9. Prioritization
        ↓
10. Next Best Action
        ↓
11. Student Executes
        ↓
12. Progress Submission
        ↓
13. Re-analysis
        ↓
14. Next Action
        ↓
      LOOP
```

The redesigned system adds supporting intelligence/security layers
around these stages without replacing the original sequence.

------------------------------------------------------------------------

# 5. Final End-to-End Flow

``` text
┌──────────────────────────────┐
│       PRIVACY + CONSENT      │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 1. STUDENT PROFILE           │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 2. TARGET CAREER             │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 3. SELF ASSESSMENT           │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 4. ACTUAL WORK / EVIDENCE    │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ SECURE INTAKE + MINIMIZATION │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 5. AI EVIDENCE ANALYSIS      │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ EVIDENCE QUALITY +           │
│ CONTRADICTION CHECK          │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 6. SKILL PROFILE +           │
│    CONFIDENCE                │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 7. STRUCTURED CAREER         │
│    REQUIREMENTS              │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 8. SKILL GAP                 │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 9. PRIORITY + DEPENDENCY +   │
│    FEASIBILITY               │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 10. NEXT BEST ACTION + WHY   │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 11. STUDENT EXECUTES         │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 12. SUBMIT NEW EVIDENCE      │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ SECURE RE-INGESTION          │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 13. RE-ANALYSIS + CHANGE LOG │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 14. NEXT ACTION              │
└──────────────┬───────────────┘
               ↓
      CONTINUE UNTIL
      TARGET READINESS IMPROVES
```

------------------------------------------------------------------------

# 6. Stage-by-Stage Functional Specification

## 6.1 Stage 0A --- Privacy & Consent Gate

This happens before collecting personal information or work.

### Purpose

Make the student understand:

-   what data is being collected;
-   why it is needed;
-   where it is processed;
-   what is stored;
-   how long it is retained;
-   how it can be deleted;
-   whether external AI services receive data;
-   whether data may be used for model improvement.

### Default principle

**Collect the minimum data necessary.**

### Example consent message

> "NextStep will analyze the information and files you provide to create
> your personalized skill profile and next-action recommendation. Your
> uploaded files may be processed by AI services required for analysis.
> You control what you upload and can request deletion of your stored
> data."

Separate consent should be used if future versions introduce optional
analytics/model-improvement use.

------------------------------------------------------------------------

# 7. Stage 1 --- Student Profile

## Data Collected

Required:

-   course/degree;
-   academic year/semester;
-   discipline/field;
-   basic career context.

Optional:

-   interests;
-   preferred preparation time;
-   available weekly hours;
-   preferred learning style;
-   current academic focus.

### Example

``` json
{
  "student_id": "student_001",
  "degree": "B.Tech",
  "discipline": "ECE",
  "year": 2,
  "semester": 4,
  "available_hours_per_week": 8,
  "interests": [
    "embedded systems",
    "electronics"
  ]
}
```

------------------------------------------------------------------------

# 8. Stage 2 --- Target Career

The student selects or searches for a target.

Examples:

-   Software Developer
-   Data Analyst
-   Embedded Systems Engineer
-   UX Researcher
-   Clinical Researcher
-   Financial Analyst
-   Product Designer

The career requirement should **not** be generated from an unconstrained
LLM response every time.

Instead, use a structured and versioned career knowledge layer.

------------------------------------------------------------------------

# 9. Career Knowledge Layer

## Purpose

Store:

-   required competencies;
-   proficiency expectations;
-   prerequisites;
-   dependencies;
-   domain;
-   role version;
-   source/date metadata;
-   recommended evidence types.

### Example

``` json
{
  "career": "Embedded Systems Engineer",
  "version": "1.0",
  "skills": [
    {
      "name": "C Programming",
      "importance": 0.95,
      "required_level": 3
    },
    {
      "name": "UART",
      "importance": 0.85,
      "required_level": 2,
      "prerequisites": [
        "microcontrollers",
        "GPIO"
      ]
    },
    {
      "name": "RTOS",
      "importance": 0.80,
      "required_level": 2,
      "prerequisites": [
        "C Programming",
        "microcontrollers"
      ]
    }
  ]
}
```

------------------------------------------------------------------------

# 10. Stage 3 --- Self Assessment

The student reports:

-   skills;
-   confidence;
-   previous exposure;
-   optionally how recently they used the skill.

Example:

``` text
Python
Student level: Intermediate
Confidence: High

React
Student level: Intermediate
Confidence: Medium

Docker
Student level: Beginner
Confidence: Low
```

## Important Rule

Self-assessment is a **signal**, not ground truth.

A student saying:

> "I know advanced React"

does not automatically make the system mark advanced React as
demonstrated.

------------------------------------------------------------------------

# 11. Stage 4 --- Actual Work / Evidence

This is one of the most important parts of NextStep.

Possible evidence:

-   project source code;
-   GitHub repository;
-   project report;
-   assignment;
-   internship work;
-   portfolio;
-   presentation;
-   circuit/project documentation;
-   research work;
-   dataset analysis;
-   design work;
-   writing sample;
-   other domain-specific evidence.

### Evidence should be linked to a student and an analysis session.

------------------------------------------------------------------------

# 12. Stage 4A --- Secure Intake & Data Minimization

Before analysis:

1.  Validate file type.
2.  Validate file size.
3.  Reject unsupported formats.
4.  Malware-scan where applicable.
5.  Isolate processing.
6.  Detect obvious secrets.
7.  Avoid unnecessary extraction.
8.  Send only required content to external AI services.
9.  Never execute arbitrary uploaded code on the production server.

### Secret detection examples

Potential:

-   API keys;
-   passwords;
-   access tokens;
-   private keys;
-   database credentials;
-   environment secrets.

If detected:

> "This file appears to contain a credential or secret. Remove it before
> continuing."

------------------------------------------------------------------------

# 13. Stage 5 --- AI Evidence Analysis

The AI should analyze the **actual artifact**, not only the student's
resume.

## Extraction targets

-   technologies;
-   concepts;
-   tasks;
-   complexity;
-   architecture;
-   implementation patterns;
-   outcomes;
-   domain competencies;
-   evidence of practical application.

### Example

Student uploads:

``` text
Python backend project
```

The system may extract:

``` text
Python
OOP
File handling
REST API
Database
Authentication
Error handling
Testing
Deployment
```

It should only mark a capability as demonstrated when sufficient
evidence exists.

------------------------------------------------------------------------

# 14. Stage 5A --- Evidence Quality & Contradiction Check

This layer prevents the AI from blindly trusting claims.

## Checks

### Missing evidence

Student says:

> "I know Docker."

No Docker evidence exists.

Result:

``` text
Docker → Claimed / Unverified
```

### Contradictory evidence

Student claims advanced backend development, but the submitted project
contains only a simple static frontend.

Result:

``` text
Backend development → Not sufficiently demonstrated
```

### Shallow evidence

A project may technically use a technology without demonstrating
meaningful understanding.

Example:

> API library imported but no meaningful API implementation.

Result:

``` text
API Development → Partially demonstrated
```

### Copy/template-like evidence

Where feasible, the system can identify suspiciously
generic/template-like artifacts.

For the MVP, advanced anti-copy/forensics should remain future work.

------------------------------------------------------------------------

# 15. Stage 6 --- Evidence-Based Skill Profile

Every important skill gets a state.

## Skill States

  -----------------------------------------------------------------------
  Status                              Meaning
  ----------------------------------- -----------------------------------
  Demonstrated                        Evidence clearly shows the
                                      capability

  Partially demonstrated              Some evidence exists but depth is
                                      limited

  Claimed / Unverified                Student claims it but evidence is
                                      insufficient

  Missing                             Target requires it and no evidence
                                      exists

  Not Relevant                        Not required for the current target
  -----------------------------------------------------------------------

### Example

``` text
Python
Status: Demonstrated
Confidence: 0.86
Evidence:
- Project A
- Project B
- Assignment C

React
Status: Partially Demonstrated
Confidence: 0.61

Docker
Status: Claimed / Unverified
Confidence: 0.18
```

------------------------------------------------------------------------

# 16. Confidence & Explainability

The system should never pretend that an AI judgment is certain.

For each important skill store:

-   skill state;
-   confidence;
-   evidence references;
-   missing evidence;
-   analysis timestamp;
-   source artifact;
-   reasoning summary.

### Example

``` text
Skill: REST API Development

Status:
Demonstrated

Confidence:
88%

Evidence:
Project "Student Management System"

Observed:
- REST endpoints
- CRUD operations
- request validation

Not observed:
- automated testing
- production deployment
```

------------------------------------------------------------------------

# 17. Explainability Chain

Every major recommendation should be traceable through:

``` text
Recommendation
      ↓
Skill Gap
      ↓
Career Requirement
      ↓
Current Capability
      ↓
Evidence
```

Example:

``` text
Recommendation:
Build authentication into your existing backend project.

Why?
        ↓
Backend authentication is important
for target role.

Why is it a gap?
        ↓
Current project has APIs but no
authentication evidence.

What supports this?
        ↓
Project analysis:
REST API = demonstrated
Database = demonstrated
Authentication = missing
```

------------------------------------------------------------------------

# 18. Stage 7 --- Career Requirements

For the selected role, retrieve:

-   required skills;
-   expected proficiency;
-   importance;
-   prerequisites;
-   dependencies;
-   evidence expectations.

The career map should be versioned.

Example:

``` text
Career:
Backend Developer

Version:
1.2

Requirements:
Python
REST APIs
SQL
Authentication
Testing
Deployment
Cloud basics
```

If the career requirements change, a new version can be created instead
of silently changing old analyses.

------------------------------------------------------------------------

# 19. Stage 8 --- Skill Gap

The system compares:

``` text
Current demonstrated capability
              VS
Target career requirement
```

### Example

``` text
Skill              Current      Required     Status

Python              3             3          ✓
REST API            2             3          ⚠
SQL                 2             3          ⚠
Authentication      0             2          🔴
Testing             0             2          🔴
Deployment           0             2          🔴
```

------------------------------------------------------------------------

# 20. Stage 9 --- Prioritization Engine

The system should **not** simply select the largest numerical gap.

It considers:

1.  Career importance
2.  Current capability
3.  Evidence confidence
4.  Prerequisites
5.  Dependency relationships
6.  Practical usefulness
7.  Student context
8.  Available time
9.  Estimated effort
10. Evidence outcome

### Conceptual scoring model

A practical implementation can use:

``` text
Priority Score =
Career Importance
× Gap Severity
× Dependency Relevance
× Practical Value
× Feasibility
× Evidence Value
```

The exact weights should be configurable and validated during testing.

------------------------------------------------------------------------

# 21. Dependency-Aware Recommendation

Example:

``` text
Docker
   ↓
Containers
   ↓
Networking
   ↓
Kubernetes
```

If Docker and networking are not demonstrated, the system should not
immediately recommend Kubernetes merely because Kubernetes has a large
numerical gap.

It should recommend the prerequisite that is most useful now.

------------------------------------------------------------------------

# 22. Stage 9A --- Feasibility & Student Context

The recommendation must fit the student.

Consider:

-   academic level;
-   current capability;
-   available hours;
-   prerequisite skills;
-   available tools;
-   expected difficulty;
-   project resources;
-   deadlines if provided.

### Example

Student has:

``` text
Available time: 3 hours/week
Current level: Beginner
```

A recommendation requiring:

> 40 hours

is not a good Next Best Action.

------------------------------------------------------------------------

# 23. Stage 10 --- Next Best Action

This is the primary product output.

NextStep should provide **one primary action**.

### Example

# Your Next Best Action

> **Add authentication to your existing REST API project.**

### Why now?

You already demonstrate:

-   Python;
-   REST APIs;
-   database integration.

Your target role requires authentication, and it is a prerequisite for
several more advanced backend tasks.

### Expected outcome

By completion, your evidence should demonstrate:

-   user authentication;
-   password handling;
-   authorization;
-   protected routes.

### Evidence to submit

-   source code;
-   README;
-   API documentation;
-   test evidence.

### Estimated effort

4--6 hours.

------------------------------------------------------------------------

# 24. Recommendation Types

NextStep may recommend:

### Learn

When foundational knowledge is missing.

### Build

When knowledge exists but practical evidence is missing.

### Practice

When knowledge exists but performance needs improvement.

### Improve

When an existing project is too basic.

### Integrate

When individual capabilities exist but are not connected.

### Simulate

When the student is ready for interview/job simulation.

### Document

When the student has capability but lacks portfolio evidence.

------------------------------------------------------------------------

# 25. Stage 10A --- Action Safety / Quality Guardrail

The system should not fabricate confidence.

If:

-   evidence is insufficient;
-   career data is missing;
-   the domain is unsupported;
-   the recommendation conflicts with prerequisites;
-   the model is uncertain;

then NextStep should say so.

Example:

> "I don't have enough evidence to confidently determine your current
> level in database optimization. Upload a relevant project or complete
> the optional assessment."

------------------------------------------------------------------------

# 26. Stage 11 --- Student Executes

The student:

-   learns;
-   practices;
-   builds;
-   improves;
-   documents;
-   completes the recommended task.

The system should prefer **evidence-producing activities**.

Instead of:

> Watch 10 hours of videos.

Prefer:

> Build a working API endpoint and submit the implementation.

------------------------------------------------------------------------

# 27. Stage 12 --- Progress Submission

The student submits:

-   code;
-   project;
-   report;
-   portfolio;
-   assessment;
-   documentation;
-   other relevant evidence.

The submission becomes new evidence.

------------------------------------------------------------------------

# 28. Stage 12A --- Secure Re-ingestion

New evidence goes through the same security pipeline:

``` text
Upload
 ↓
Validate
 ↓
Scan
 ↓
Minimize
 ↓
Isolate
 ↓
Analyze
```

Privacy controls do not disappear after onboarding.

------------------------------------------------------------------------

# 29. Stage 13 --- Re-analysis

The AI compares the new evidence against the previous capability state.

Example:

Before:

``` text
Authentication:
Missing
Confidence: 0.05
```

After:

``` text
Authentication:
Demonstrated
Confidence: 0.82
```

------------------------------------------------------------------------

# 30. Stage 13A --- Evidence Change Log

The system records:

``` text
Previous capability
        ↓
New evidence
        ↓
New capability
        ↓
Remaining gap
        ↓
New recommendation
```

### Example

``` text
2026-10-08

Authentication
Before: Missing

New evidence:
Backend Project v2

After:
Demonstrated

Confidence:
0.84

Next remaining gap:
Automated testing
```

This makes the system auditable and understandable.

------------------------------------------------------------------------

# 31. Stage 14 --- Next Action

After re-analysis:

``` text
Updated capability
        ↓
Remaining requirements
        ↓
Recalculate gaps
        ↓
Recalculate priorities
        ↓
Generate next action
```

The loop continues until the student's target readiness improves.

------------------------------------------------------------------------

# 32. Evidence Model

The evidence model is central to NextStep.

## Evidence object

Conceptually:

``` json
{
  "evidence_id": "ev_001",
  "student_id": "student_001",
  "type": "project",
  "name": "Student Management System",
  "source": "github",
  "submitted_at": "2026-10-08T10:00:00Z",
  "skills_detected": [
    "Python",
    "REST API",
    "SQL"
  ],
  "analysis_status": "completed"
}
```

------------------------------------------------------------------------

# 33. Skill Evidence Object

``` json
{
  "skill": "REST API",
  "status": "demonstrated",
  "confidence": 0.88,
  "evidence_ids": [
    "ev_001"
  ],
  "observations": [
    "CRUD endpoints",
    "request validation"
  ],
  "missing_evidence": [
    "automated testing"
  ]
}
```

------------------------------------------------------------------------

# 34. Student Capability Model

A student's capability profile should be a structured representation
rather than a single score.

``` text
Student
│
├── Profile
│
├── Target Career
│
├── Self Assessment
│
├── Evidence
│   ├── Project A
│   ├── GitHub B
│   └── Report C
│
├── Capabilities
│   ├── Python
│   ├── SQL
│   ├── REST API
│   └── Testing
│
├── Gaps
│
├── Recommendations
│
└── Change History
```

------------------------------------------------------------------------

# 35. Domain-Independent Architecture

The architecture is divided into:

## Core Engine

-   privacy/identity;
-   evidence ingestion;
-   artifact analysis;
-   skill graph;
-   gap engine;
-   priority engine;
-   next-best-action engine;
-   feedback loop.

## Domain Knowledge

-   student profile schema;
-   technical competency maps;
-   medical competency maps;
-   arts/design competency maps;
-   commerce/finance competency maps;
-   additional career/role maps;
-   domain-specific action templates;
-   domain-specific evidence standards.

### Architecture

``` text
                  NEXTSTEP CORE ENGINE
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
   Technical          Medical            Arts
   Knowledge          Knowledge          Knowledge
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ↓
                  Career Knowledge
                         ↓
                 Recommendation
```

------------------------------------------------------------------------

# 36. Example --- CSE Student

## Student

``` text
Course:
B.Tech CSE

Target:
Backend Developer
```

## Existing evidence

``` text
Python project
SQLite database
REST API
```

## Analysis

``` text
Python → Demonstrated
REST API → Demonstrated
SQL → Partially Demonstrated
Authentication → Missing
Testing → Missing
Deployment → Missing
```

## Recommendation

> Add authentication and authorization to the existing backend project.

## Why?

-   High career relevance;
-   builds on existing API knowledge;
-   manageable effort;
-   produces strong portfolio evidence;
-   prerequisite for more advanced backend security work.

------------------------------------------------------------------------

# 37. Example --- ECE Student

## Student

``` text
Course:
B.Tech ECE

Target:
Embedded Systems Engineer
```

## Evidence

-   C code;
-   Arduino project;
-   temperature-control project;
-   circuit diagram;
-   project report.

## Analysis

``` text
C → Demonstrated
GPIO → Demonstrated
Sensors → Basic
Microcontrollers → Partially demonstrated
UART → Missing
SPI → Missing
I2C → Missing
RTOS → Missing
```

## Recommendation

> Build a UART-based sensor communication project.

### Why?

It:

-   matches the target career;
-   builds on existing microcontroller experience;
-   introduces communication protocols;
-   creates new evidence;
-   provides a foundation for SPI/I2C.

------------------------------------------------------------------------

# 38. Example --- Arts / UX Student

## Target

UX Researcher

## Evidence

-   writing samples;
-   portfolio;
-   user interview assignment.

## Analysis

``` text
Writing → Demonstrated
User interviews → Partially demonstrated
Research synthesis → Missing
Usability testing → Missing
Case study documentation → Partial
```

## Next Best Action

> Conduct five structured user interviews and convert the findings into
> a UX research case study.

Again, the action produces new evidence.

------------------------------------------------------------------------

# 39. Example --- Commerce Student

## Target

Financial Analyst

## Evidence

-   Excel assignment;
-   financial statement analysis;
-   basic accounting project.

## Analysis

``` text
Excel → Demonstrated
Financial statements → Demonstrated
Financial modeling → Partial
Data visualization → Missing
Forecasting → Missing
```

## Next Best Action

> Build a three-year financial forecast model using a real or publicly
> available company dataset.

------------------------------------------------------------------------

# 40. Privacy & Security Architecture

Privacy is a **cross-cutting system property**, not a separate settings
page.

It covers:

``` text
Collection
 ↓
Upload
 ↓
Processing
 ↓
AI Analysis
 ↓
Storage
 ↓
Recommendation
 ↓
Re-analysis
 ↓
Deletion
```

------------------------------------------------------------------------

# 41. Data Minimization

Only collect information required for the requested function.

Examples:

If analyzing a project:

Do not require:

-   unrelated personal documents;
-   unnecessary contact details;
-   unrelated academic records.

Optional information must be clearly marked optional.

------------------------------------------------------------------------

# 42. Consent

Before uploading:

Explain:

-   what will be analyzed;
-   why;
-   which services may process it;
-   what will be stored;
-   retention period;
-   deletion options.

If future model-improvement use is introduced:

**Separate explicit consent must be requested.**

------------------------------------------------------------------------

# 43. Encryption

Use:

-   TLS/HTTPS for data in transit;
-   encryption at rest;
-   managed secrets/key management.

Never store:

-   API keys;
-   passwords;
-   credentials

inside student artifacts unnecessarily.

------------------------------------------------------------------------

# 44. File Isolation

Uploaded code must **never be blindly executed on the production
server**.

Use:

-   isolated processing;
-   sandboxing;
-   restricted permissions;
-   resource limits;
-   safe parsers.

------------------------------------------------------------------------

# 45. Access Control

Student data should only be accessible to:

-   the student's authorized account;
-   explicitly authorized backend services.

No student should be able to access another student's:

-   files;
-   profile;
-   recommendations;
-   skill history.

------------------------------------------------------------------------

# 46. Secret Detection

Uploaded code can accidentally contain:

``` text
API_KEY=...
PASSWORD=...
TOKEN=...
PRIVATE_KEY=...
DATABASE_URL=...
```

NextStep should attempt to detect obvious secrets and warn the student.

------------------------------------------------------------------------

# 47. Retention

Define how long:

-   raw artifacts;
-   extracted text;
-   skill profiles;
-   recommendation history;
-   logs

are stored.

Avoid indefinite retention by default.

------------------------------------------------------------------------

# 48. Deletion

The user should be able to request deletion of:

-   individual evidence;
-   projects;
-   profile;
-   recommendations;
-   account.

Deletion should cover both:

1.  raw uploaded data;
2.  associated derived data where appropriate.

------------------------------------------------------------------------

# 49. Export

Where practical, allow the student to export:

-   capability profile;
-   evidence metadata;
-   recommendation history;
-   career progress;
-   change history.

------------------------------------------------------------------------

# 50. Model Training Policy

NextStep should **not silently use private student artifacts to train or
fine-tune models**.

If future model improvement uses student data:

-   disclose it;
-   obtain appropriate consent;
-   provide clear controls;
-   document the policy.

------------------------------------------------------------------------

# 51. Third-Party AI Processing

If an external AI API receives student data:

-   disclose that processing path;
-   send only the minimum required content;
-   avoid sending unnecessary personal information;
-   avoid exposing secrets;
-   maintain provider/security documentation.

------------------------------------------------------------------------

# 52. Audit Trail

Record security-relevant events such as:

-   login;
-   upload;
-   deletion;
-   analysis request;
-   recommendation generation;
-   permission changes.

Do not unnecessarily log sensitive file contents.

------------------------------------------------------------------------

# 53. Competitor Limitations Addressed

NextStep should not add features simply because competitors have them.

The redesigned system specifically addresses these market limitations:

  -----------------------------------------------------------------------
  Market limitation                   NextStep response
  ----------------------------------- -----------------------------------
  Roadmaps/personalization are common Evidence-to-action reasoning is the
                                      central intelligence

  Assessment-heavy products           Real work artifacts become primary
                                      evidence

  Broad platforms dilute the core     One primary output: Next Best
  action                              Action

  Resumes can exaggerate capability   Resume/self-report treated as
                                      claims

  Test-centric skill verification     Verify through actual artifacts
                                      plus assessments

  Generic AI career requirements can  Structured/versioned career
  be inconsistent                     knowledge

  Static roadmaps become outdated     Re-analysis after new evidence

  Too many recommendations overwhelm  One primary action
  students                            

  Privacy can be an afterthought      Privacy is part of the architecture
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 54. What NextStep Should NOT Claim

## Do not claim:

> "No existing tool does this."

The market already contains products that perform career mapping,
skill-gap analysis, roadmap generation and experience analysis.

## Do not claim:

> "Our AI is always correct."

Instead:

> "Recommendations are evidence-based and include confidence and
> reasoning."

## Do not claim:

> "We verify every student's skill perfectly."

Instead:

> "We analyze submitted evidence and estimate demonstrated capability
> with confidence."

## Do not claim:

> "We support every career from day one."

The MVP should support a limited set of domains/roles.

------------------------------------------------------------------------

# 55. Product Differentiation

The differentiation should be:

## Evidence-to-Action Intelligence

Not simply:

``` text
Profile → Career → Roadmap
```

But:

``` text
Actual Evidence
      ↓
Demonstrated Capability
      ↓
Target Requirement
      ↓
Gap
      ↓
Priority
      ↓
Feasible Next Action
      ↓
New Evidence
      ↓
Verification
      ↓
Updated Capability
```

------------------------------------------------------------------------

# 56. Recommended UI

## Main Dashboard

The student should not see the complete internal AI pipeline.

The main screen should answer:

1.  Where am I?
2.  What is my biggest gap?
3.  What should I do next?
4.  Why?
5.  How will I prove completion?

------------------------------------------------------------------------

## Dashboard Structure

``` text
┌─────────────────────────────────────────────┐
│ NextStep                         Profile    │
├─────────────┬───────────────────────────────┤
│ Dashboard   │ Target Career                 │
│             │ Backend Developer             │
│ My Work     │                               │
│             │ Current Capability            │
│ My Skills   │ ███████░░░ 68%                │
│             │                               │
│ Career      │ TOP GAP                        │
│             │ Authentication                │
│ Progress    │                               │
│             │ ⭐ NEXT BEST ACTION           │
│             │ Add authentication to your    │
│             │ existing backend project.     │
│             │                               │
│             │ WHY NOW?                      │
│             │ High role relevance and       │
│             │ builds on your current API.   │
│             │                               │
│             │ [Start Action]                │
└─────────────┴───────────────────────────────┘
```

------------------------------------------------------------------------

# 57. Recommended Screens

## 1. Welcome

Purpose:

-   explain NextStep;
-   explain privacy;
-   start onboarding.

## 2. Consent

Show:

-   data collected;
-   processing;
-   retention;
-   deletion;
-   third-party AI processing.

## 3. Student Profile

Collect:

-   course;
-   year;
-   discipline;
-   interests;
-   optional available time.

## 4. Target Career

Search/select target role.

## 5. Self Assessment

Enter:

-   skill;
-   level;
-   confidence.

## 6. My Work

Upload:

-   projects;
-   reports;
-   code;
-   GitHub;
-   portfolio;
-   assignments.

## 7. AI Analysis

Show:

-   detected skills;
-   evidence;
-   analysis status.

## 8. Skill Profile

Show:

-   demonstrated;
-   partial;
-   claimed;
-   missing;
-   not relevant.

## 9. Skill Gap

Show current vs required.

## 10. Next Best Action

Hero screen.

## 11. Progress

Show capability changes rather than only study hours.

## 12. Re-analysis

Submit new evidence.

## 13. Career Journey

Long-term view.

## 14. Privacy Center

Show:

-   stored data;
-   permissions;
-   deletion;
-   export;
-   processing information.

------------------------------------------------------------------------

# 58. Technology Architecture --- Prototype

The exact technology stack can be chosen by the development team, but
the architecture should follow these logical layers.

``` text
FRONTEND
   │
   ├── Authentication
   ├── Student Profile
   ├── Career Selection
   ├── Self Assessment
   ├── Evidence Upload
   ├── Skill Dashboard
   ├── Next Best Action
   └── Privacy Center
            │
            ▼
API / BACKEND
   │
   ├── Authentication Service
   ├── Student Profile Service
   ├── Evidence Service
   ├── Analysis Service
   ├── Skill Graph Service
   ├── Career Knowledge Service
   ├── Gap Engine
   ├── Priority Engine
   ├── Recommendation Engine
   ├── Progress/Re-analysis Service
   └── Privacy/Data Management Service
            │
            ▼
AI / INTELLIGENCE
   │
   ├── Document Parsing
   ├── Code/Artifact Analysis
   ├── Skill Extraction
   ├── Evidence Evaluation
   ├── Confidence Estimation
   ├── Recommendation Generation
   └── Explanation Generation
            │
            ▼
DATA
   │
   ├── User Database
   ├── Evidence Metadata
   ├── Secure Object Storage
   ├── Skill Graph
   ├── Career Knowledge Base
   ├── Recommendation History
   └── Audit Logs
```

------------------------------------------------------------------------

# 59. AI Architecture

NextStep should not rely on one giant LLM prompt for the entire system.

Use separate logical components.

## Component 1 --- Evidence Extraction

Input:

``` text
PDF / code / report / portfolio
```

Output:

``` json
{
  "technologies": [],
  "concepts": [],
  "tasks": [],
  "outcomes": []
}
```

------------------------------------------------------------------------

## Component 2 --- Skill Mapping

Map extracted evidence to a standardized skill taxonomy.

Example:

``` text
“JWT authentication”
        ↓
Authentication
        ↓
Backend Security
```

------------------------------------------------------------------------

## Component 3 --- Evidence Evaluator

Determine:

``` text
Demonstrated
Partially Demonstrated
Claimed/Unverified
Missing
Not Relevant
```

------------------------------------------------------------------------

## Component 4 --- Career Knowledge Engine

Retrieve:

-   role requirements;
-   proficiency;
-   dependencies;
-   importance.

------------------------------------------------------------------------

## Component 5 --- Gap Engine

Compare:

``` text
Current Capability
       VS
Target Requirement
```

------------------------------------------------------------------------

## Component 6 --- Priority Engine

Select the most important feasible gap.

------------------------------------------------------------------------

## Component 7 --- Recommendation Engine

Generate:

-   action;
-   reason;
-   expected outcome;
-   evidence requirement;
-   estimated effort;
-   resources.

------------------------------------------------------------------------

## Component 8 --- Verification Engine

After new evidence:

``` text
Previous State
     +
New Evidence
     ↓
Updated Capability
```

------------------------------------------------------------------------

# 60. LLM Responsibility Boundaries

The LLM should be used for:

-   extracting semantic information;
-   interpreting artifacts;
-   mapping concepts;
-   generating explanations;
-   generating action descriptions.

The LLM should **not be the only source of truth** for:

-   authentication;
-   access control;
-   data deletion;
-   privacy permissions;
-   career requirement storage;
-   security decisions;
-   exact numerical scoring.

Critical decisions should be supported by deterministic application
logic and structured data.

------------------------------------------------------------------------

# 61. Data Model

## User

``` json
{
  "id": "user_id",
  "email": "student@example.com",
  "created_at": "...",
  "privacy_preferences": {}
}
```

## Student Profile

``` json
{
  "user_id": "user_id",
  "degree": "B.Tech",
  "discipline": "ECE",
  "year": 2,
  "semester": 4,
  "interests": [],
  "available_hours": 8
}
```

## Career

``` json
{
  "career_id": "embedded-engineer",
  "name": "Embedded Systems Engineer",
  "version": "1.0"
}
```

## Evidence

``` json
{
  "evidence_id": "ev_001",
  "user_id": "user_id",
  "type": "project",
  "name": "Temperature Controlled Fan",
  "storage_reference": "...",
  "analysis_status": "completed"
}
```

## Skill State

``` json
{
  "user_id": "user_id",
  "skill_id": "uart",
  "status": "missing",
  "confidence": 0.05,
  "evidence_ids": []
}
```

## Recommendation

``` json
{
  "recommendation_id": "rec_001",
  "user_id": "user_id",
  "target_skill": "uart",
  "action_type": "build",
  "action": "Build a UART-based sensor communication project",
  "reason": "...",
  "expected_evidence": [],
  "estimated_effort_hours": 5
}
```

------------------------------------------------------------------------

# 62. API Design --- Conceptual

## Authentication

``` http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

## Profile

``` http
GET /api/profile
PUT /api/profile
```

## Careers

``` http
GET /api/careers
GET /api/careers/:id
```

## Assessment

``` http
POST /api/assessment
GET /api/assessment
```

## Evidence

``` http
POST /api/evidence
GET /api/evidence
GET /api/evidence/:id
DELETE /api/evidence/:id
```

## Analysis

``` http
POST /api/evidence/:id/analyze
GET /api/evidence/:id/analysis
```

## Skills

``` http
GET /api/skills
GET /api/skills/:id
```

## Recommendations

``` http
GET /api/recommendations/current
POST /api/recommendations/:id/start
POST /api/recommendations/:id/complete
```

## Re-analysis

``` http
POST /api/reanalysis
GET /api/progress
GET /api/change-log
```

## Privacy

``` http
GET /api/privacy
POST /api/privacy/consent
POST /api/privacy/export
DELETE /api/privacy/account
```

------------------------------------------------------------------------

# 63. Security Requirements

Minimum requirements:

-   HTTPS;
-   secure password hashing;
-   session/token security;
-   role-based access control;
-   encrypted storage;
-   secure file upload;
-   file-size limits;
-   allowed MIME types;
-   malware scanning where available;
-   isolated processing;
-   secret detection;
-   audit logs;
-   rate limiting;
-   secure environment variables;
-   no secrets in source control;
-   no arbitrary code execution on production;
-   secure deletion strategy.

------------------------------------------------------------------------

# 64. Privacy Requirements

MVP must support:

-   consent;
-   data minimization;
-   privacy explanation;
-   deletion;
-   retention policy;
-   export where practical;
-   third-party AI disclosure;
-   no silent model training;
-   access control.

A fake "Delete Data" button that does nothing is not acceptable.

------------------------------------------------------------------------

# 65. MVP Boundary

The product should **not** attempt every course and every career in the
hackathon prototype.

Build a convincing vertical slice.

## MVP Must Prove

### 1. Student onboarding + consent

### 2. Target career selection

### 3. Self assessment

### 4. Actual work upload

### 5. Evidence extraction

### 6. Confidence + evidence references

### 7. Skill gap + priority

### 8. Next Best Action

### 9. Secure storage/deletion

### 10. At least one complete re-analysis iteration

------------------------------------------------------------------------

# 66. Recommended MVP Domain Strategy

Although the architecture is multi-domain, the demo should initially use
a limited set of careers.

A practical demonstration can use:

### Technical

Software Developer

### Engineering

Embedded Systems Engineer

### Business

Financial Analyst

### Arts/Design

UX Researcher

This demonstrates that the core engine is domain-independent without
requiring a huge knowledge base.

------------------------------------------------------------------------

# 67. MVP Evidence Types

Start with:

-   PDF project report;
-   TXT/Markdown;
-   selected code files;
-   GitHub repository link;
-   portfolio link.

Add more formats later.

------------------------------------------------------------------------

# 68. What Should NOT Be Built First

Avoid spending MVP time on:

-   social networking;
-   chat communities;
-   huge job marketplace;
-   hundreds of careers;
-   hundreds of courses;
-   advanced anti-cheating;
-   complicated recommendation feeds;
-   unnecessary animations;
-   full college management dashboards.

The demo should prove the intelligence loop.

------------------------------------------------------------------------

# 69. MVP Demo Scenario

## Step 1

Student creates profile.

``` text
B.Tech ECE
2nd Year
```

## Step 2

Selects:

``` text
Embedded Systems Engineer
```

## Step 3

Self-assessment:

``` text
C → Intermediate
Arduino → Intermediate
Sensors → Beginner
```

## Step 4

Uploads:

``` text
Temperature Controlled Fan Project
```

## Step 5

AI analyzes:

``` text
C → Demonstrated
GPIO → Demonstrated
Sensors → Basic
UART → Missing
SPI → Missing
I2C → Missing
RTOS → Missing
```

## Step 6

Career requirements loaded.

## Step 7

Gap calculated.

## Step 8

Dependency/priority engine selects:

``` text
UART
```

## Step 9

Next Best Action:

> Build a UART-based sensor communication project.

## Step 10

Student completes it.

## Step 11

Uploads new project.

## Step 12

AI finds:

``` text
UART → Demonstrated
```

## Step 13

Change log:

``` text
UART:
Missing → Demonstrated
```

## Step 14

Next action:

> Introduce SPI communication.

This single demo proves the complete product loop.

------------------------------------------------------------------------

# 70. Evaluation Metrics

The system should eventually measure:

## Recommendation Quality

-   Was the action relevant?
-   Was it feasible?
-   Did the student complete it?
-   Did it produce meaningful evidence?

## Evidence Quality

-   How often does evidence support the assigned skill?
-   How often does human review disagree?

## Progress

-   Number of demonstrated skills;
-   reduction in high-priority gaps;
-   completed evidence-producing actions.

## Student Engagement

-   action start rate;
-   action completion rate;
-   re-upload rate;
-   recommendation acceptance rate.

## Trust

-   explanation usefulness;
-   privacy confidence;
-   recommendation confidence;
-   correction rate.

------------------------------------------------------------------------

# 71. Human Correction

The student should be able to correct the system.

Example:

> "This skill was incorrectly marked as missing."

Student can provide additional evidence.

The system should re-evaluate rather than permanently trusting the
original AI judgment.

------------------------------------------------------------------------

# 72. Failure Handling

## Insufficient Evidence

``` text
I don't have enough evidence to determine this skill reliably.
```

## Unsupported Domain

``` text
This career is not currently supported with enough structured requirements.
```

## Contradictory Evidence

``` text
Your self-assessment and submitted evidence do not currently agree.
```

## Low Confidence

``` text
The recommendation is low-confidence because the evidence is incomplete.
```

## Unsafe Upload

``` text
This file may contain a secret or unsafe content. Please remove sensitive information before uploading.
```

------------------------------------------------------------------------

# 73. Product Principles

## Principle 1 --- Evidence over claims

Actual work matters more than self-description.

## Principle 2 --- One next action

Do not overwhelm students.

## Principle 3 --- Explain every recommendation

Students should understand why.

## Principle 4 --- Dependencies matter

Do not recommend advanced skills before prerequisites.

## Principle 5 --- Feasibility matters

A technically correct recommendation can still be a bad recommendation
if the student cannot realistically complete it.

## Principle 6 --- New work changes the model

The student's profile is dynamic.

## Principle 7 --- Privacy by design

Privacy is part of every stage.

## Principle 8 --- Uncertainty must be visible

Never present uncertain AI inference as fact.

------------------------------------------------------------------------

# 74. Competitive Positioning

The market already contains products focused on:

-   career matching;
-   skill assessments;
-   roadmaps;
-   daily learning;
-   resume analysis;
-   interviews;
-   job matching;
-   readiness scores.

NextStep should therefore avoid positioning itself as simply:

> "An AI career roadmap."

Instead:

> **"An evidence-driven next-action system for students."**

### Core differentiation

``` text
Competitor-style:
Profile
  ↓
Career
  ↓
Skill Gap
  ↓
Roadmap

NextStep:
Actual Work
  ↓
Demonstrated Capability
  ↓
Target Requirement
  ↓
Skill Gap
  ↓
Priority + Dependency + Feasibility
  ↓
Next Best Action
  ↓
New Evidence
  ↓
Verification
  ↓
Updated Capability
```

------------------------------------------------------------------------

# 75. Product Architecture Principle

Do not add features just because competitors have them.

Add a feature only if it strengthens:

``` text
Understand evidence
      ↓
Identify important gap
      ↓
Recommend feasible action
      ↓
Verify new evidence
      ↓
Update student model
```

------------------------------------------------------------------------

# 76. Development Roadmap

## Phase 1 --- Foundation

-   authentication;
-   profile;
-   consent;
-   privacy settings;
-   target career selection.

## Phase 2 --- Evidence

-   upload;
-   file validation;
-   storage;
-   document extraction;
-   GitHub integration.

## Phase 3 --- AI Analysis

-   skill extraction;
-   evidence mapping;
-   confidence;
-   evidence states.

## Phase 4 --- Career Engine

-   career knowledge base;
-   role-skill relationships;
-   prerequisites;
-   proficiency requirements.

## Phase 5 --- Gap + Recommendation

-   gap engine;
-   priority engine;
-   feasibility;
-   Next Best Action.

## Phase 6 --- Feedback Loop

-   progress submission;
-   re-analysis;
-   change log;
-   updated recommendations.

## Phase 7 --- Security Hardening

-   encryption;
-   access controls;
-   secret detection;
-   deletion;
-   audit logging.

## Phase 8 --- Expansion

-   more careers;
-   more domains;
-   more artifact types;
-   better verification;
-   institution integrations.

------------------------------------------------------------------------

# 77. Future Enhancements

Only after the core loop works:

-   deeper GitHub analysis;
-   portfolio quality analysis;
-   project complexity estimation;
-   advanced anti-copy analysis;
-   labor-market integration;
-   job matching;
-   interview simulation;
-   mentor/human review;
-   institution dashboards;
-   resource recommendation;
-   adaptive assessments;
-   team/project collaboration analysis.

These should remain secondary.

------------------------------------------------------------------------

# 78. Final Product Definition

> **NextStep is a student-only, evidence-driven career preparation
> system that analyzes what a student knows and what they have actually
> done, compares demonstrated capabilities with the requirements of a
> target career, identifies and prioritizes skill gaps, and continuously
> recommends one explainable, feasible Next Best Action while protecting
> the student's data throughout the entire lifecycle.**

------------------------------------------------------------------------

# 79. Final One-Line Pitch

> **NextStep tells students what they should do next based on what they
> can actually demonstrate --- not just what they claim to know.**

------------------------------------------------------------------------

# 80. Final Flow --- One Line

``` text
Student
→ Profile
→ Target Career
→ Self Assessment
→ Actual Work
→ Secure Evidence Intake
→ AI Evidence Analysis
→ Evidence Quality Check
→ Evidence-Based Skill Profile
→ Career Requirements
→ Skill Gap
→ Priority + Dependency + Feasibility
→ Next Best Action
→ Student Executes
→ New Evidence
→ Secure Re-ingestion
→ Re-analysis
→ Change Log
→ Next Action
→ Loop
```

------------------------------------------------------------------------

# 81. Hackathon Success Criteria

The prototype should successfully demonstrate:

-   a real student pain point;
-   evidence that students experience the pain;
-   an understandable workflow;
-   actual work analysis;
-   evidence-based skill identification;
-   career-specific gap analysis;
-   one clear recommendation;
-   explanation of that recommendation;
-   realistic action selection;
-   new evidence submission;
-   profile update;
-   recommendation update;
-   privacy/consent;
-   secure data handling;
-   a working end-to-end iteration.

------------------------------------------------------------------------

# 82. Final Rule

**Do not build NextStep as a collection of AI features.**

Build it as one intelligent loop:

> **Understand the student's evidence → identify the most important
> current gap → recommend a feasible next action → verify the new
> evidence → update the student model.**

Everything else exists to make that loop:

-   accurate;
-   explainable;
-   useful;
-   safe;
-   private;
-   repeatable.

------------------------------------------------------------------------

## End of Documentation

**Product Name:** NextStep\
**Core System:** Evidence → Capability → Gap → Next Best Action →
Evidence\
**Primary User:** Student\
**Primary Output:** One explainable Next Best Action\
**Primary Differentiator:** Evidence-driven, continuously updated
next-step intelligence\
**Security Principle:** Privacy and security by design
