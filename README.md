# NextStep

NextStep is a student-focused, evidence-driven career-preparation prototype. It compares submitted work with a small, versioned career framework, distinguishes self-reported claims from evidence estimates, prioritizes a feasible skill gap, and recommends one explainable, evidence-producing next action.

## Run locally

Use Node.js 20 or newer:

```powershell
npm start
```

Then open [http://localhost:3000](http://localhost:3000). Set `PORT` to choose another port. Open the app through the local server to use profile and evidence APIs. The relative CSS and script links also let the page load its styles when opening `public/index.html` directly, but direct-file mode cannot use the backend.

## MVP workflow

1. Review and accept the privacy notice before entering student data.
2. Create a profile with course, discipline, year/semester, a supported target career, and optional weekly availability.
3. Optionally rate the target-role skills; self-assessments remain claims and are never counted as demonstrated evidence.
4. Add evidence through a description and an optional allowed file or public GitHub/portfolio URL.
5. Review role-specific skill states, confidence estimates, evidence references, and the single prioritized next action.
6. Complete an action, submit new evidence, and analyze again to view capability changes and the next action.
7. Export your profile and progress or withdraw consent and delete local data from the Privacy Center.

The prototype career frameworks are Software Developer, Embedded Systems Engineer, Financial Analyst, and UX Researcher. Each includes a version and source note. Careers and skill requirements outside these frameworks are not inferred.

## Analysis and file handling

Analysis uses deterministic keyword matching against evidence descriptions and the first 20,000 characters of uploaded text/code. It is **not an AI model, verified proficiency assessment, or hiring score**. Skill status, confidence, and priority are directional prototype estimates; PDF files are retained but not parsed. Public links are recorded but never fetched. Files are limited to 1 MB and supported document/source formats; uploaded code is never executed, obvious credentials are rejected, and extracted document text is not retained. No external AI service receives student data, and artifacts are not used for model training.

Data is stored in the local `data/` directory until deleted, and that directory is excluded from Git. The app binds to `127.0.0.1` by default. **This demo has no authentication, encryption-at-rest, or multi-user access control; do not expose it to untrusted networks or use it for confidential student information.**
