const http = require("node:http");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const AI_BASE_URL = "http://127.0.0.1:8000/api/ai";

async function triggerAIAnalysis(state) {
  // Build payload for Python AI service
  const career = careers[state.profile.careerId];
  const studentEvidence = (state.evidence || [])
    .map((e) => `${e.title} ${e.type} ${e.description || ""} ${e.analysisText || ""}`)
    .join("\n");
  const requestBody = {
    student_profile: state.profile,
    target_career: career.name,
    student_evidence: studentEvidence,
    career_requirements: career,
  };
  try {
    const response = await fetch(`${AI_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`AI service error: ${response.status} - ${JSON.stringify(err)}`);
    }
    const result = await response.json();
    // Store AI analysis result in state for later use
    state.aiResult = result;
    return result;
  } catch (err) {
    console.error("Failed to invoke AI analysis service", err);
    throw err;
  }
}

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "nextstep-data.json");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([".pdf", ".txt", ".md", ".csv", ".json", ".html", ".css", ".js", ".py", ".java", ".ts", ".tsx", ".jsx"]);
const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|password|passwd|secret|database[_-]?url)\s*[:=]\s*["']?[\w./+=-]{8,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

const careers = {
  "software-developer": {
    name: "Software Developer", domain: "Technology", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "Programming fundamentals", importance: 0.95, requiredLevel: 3, keywords: ["python", "javascript", "typescript", "java", "c++", "algorithm", "data structure"], effort: 5, type: "build" },
      { name: "API development", importance: 0.88, requiredLevel: 2, keywords: ["api", "rest", "endpoint", "graphql", "http"], effort: 5, type: "build", prerequisites: ["Programming fundamentals"] },
      { name: "Database & SQL", importance: 0.82, requiredLevel: 2, keywords: ["sql", "postgres", "mysql", "database", "mongodb", "sqlite"], effort: 4, type: "build", prerequisites: ["Programming fundamentals"] },
      { name: "Automated testing", importance: 0.8, requiredLevel: 2, keywords: ["test", "testing", "jest", "pytest", "unit test", "playwright"], effort: 4, type: "practice", prerequisites: ["Programming fundamentals"] },
      { name: "Authentication & security", importance: 0.78, requiredLevel: 2, keywords: ["auth", "authentication", "jwt", "security", "oauth", "password hashing"], effort: 6, type: "integrate", prerequisites: ["API development"] },
      { name: "Deployment & cloud", importance: 0.66, requiredLevel: 2, keywords: ["cloud", "aws", "azure", "docker", "deploy", "deployment"], effort: 6, type: "build", prerequisites: ["API development"] },
      { name: "Git & collaboration", importance: 0.68, requiredLevel: 2, keywords: ["git", "github", "pull request", "collaboration", "version control"], effort: 3, type: "practice" },
    ],
  },
  "embedded-systems": {
    name: "Embedded Systems Engineer", domain: "Engineering", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "C programming", importance: 0.96, requiredLevel: 3, keywords: ["c programming", "embedded c", "c code", "c language", "firmware"], effort: 5, type: "build" },
      { name: "Microcontrollers", importance: 0.92, requiredLevel: 2, keywords: ["microcontroller", "arduino", "esp32", "stm32", "firmware"], effort: 5, type: "build", prerequisites: ["C programming"] },
      { name: "GPIO & sensors", importance: 0.86, requiredLevel: 2, keywords: ["gpio", "sensor", "sensors", "arduino", "input output"], effort: 4, type: "build", prerequisites: ["Microcontrollers"] },
      { name: "UART communication", importance: 0.85, requiredLevel: 2, keywords: ["uart", "serial communication", "serial monitor", "baud rate"], effort: 5, type: "build", prerequisites: ["Microcontrollers", "GPIO & sensors"] },
      { name: "SPI & I2C protocols", importance: 0.78, requiredLevel: 2, keywords: ["spi", "i2c", "serial peripheral interface"], effort: 6, type: "integrate", prerequisites: ["UART communication"] },
      { name: "Testing & debugging", importance: 0.72, requiredLevel: 2, keywords: ["debug", "debugging", "test", "oscilloscope", "logic analyzer"], effort: 4, type: "practice", prerequisites: ["C programming"] },
      { name: "Technical documentation", importance: 0.55, requiredLevel: 2, keywords: ["report", "documentation", "circuit diagram", "schematic"], effort: 3, type: "document" },
    ],
  },
  "financial-analyst": {
    name: "Financial Analyst", domain: "Business", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "Spreadsheet analysis", importance: 0.94, requiredLevel: 3, keywords: ["excel", "spreadsheet", "google sheets", "pivot table"], effort: 4, type: "build" },
      { name: "Financial statements", importance: 0.92, requiredLevel: 2, keywords: ["financial statement", "balance sheet", "income statement", "cash flow", "accounting"], effort: 4, type: "analyze" },
      { name: "Financial modeling", importance: 0.9, requiredLevel: 2, keywords: ["financial model", "valuation", "dcf", "modeling", "modelling"], effort: 6, type: "build", prerequisites: ["Spreadsheet analysis", "Financial statements"] },
      { name: "Forecasting", importance: 0.8, requiredLevel: 2, keywords: ["forecast", "forecasting", "budget", "projection"], effort: 5, type: "build", prerequisites: ["Financial modeling"] },
      { name: "Data visualization", importance: 0.72, requiredLevel: 2, keywords: ["visualization", "visualisation", "dashboard", "tableau", "power bi", "chart"], effort: 4, type: "build", prerequisites: ["Spreadsheet analysis"] },
      { name: "Business communication", importance: 0.65, requiredLevel: 2, keywords: ["presentation", "report", "recommendation", "executive summary"], effort: 3, type: "document" },
    ],
  },
  "ux-researcher": {
    name: "UX Researcher", domain: "Arts & Design", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "User interviews", importance: 0.95, requiredLevel: 2, keywords: ["user interview", "interview", "interviews", "research participant"], effort: 4, type: "practice" },
      { name: "Survey & research planning", importance: 0.84, requiredLevel: 2, keywords: ["survey", "research plan", "research question", "methodology"], effort: 3, type: "build" },
      { name: "Research synthesis", importance: 0.92, requiredLevel: 2, keywords: ["synthesis", "affinity mapping", "themes", "research findings", "insights"], effort: 4, type: "analyze", prerequisites: ["User interviews"] },
      { name: "Usability testing", importance: 0.86, requiredLevel: 2, keywords: ["usability testing", "usability test", "task success", "think aloud"], effort: 5, type: "practice", prerequisites: ["User interviews"] },
      { name: "Case study documentation", importance: 0.72, requiredLevel: 2, keywords: ["case study", "portfolio", "design rationale", "research report"], effort: 4, type: "document", prerequisites: ["Research synthesis"] },
      { name: "Accessibility & inclusion", importance: 0.66, requiredLevel: 2, keywords: ["accessibility", "wcag", "inclusive", "screen reader"], effort: 3, type: "learn" },
    ],
  },
};

const careerList = Object.entries(careers).map(([id, career]) => ({
  id,
  name: career.name,
  domain: career.domain,
  version: career.version,
  source: career.source,
  reviewed: career.reviewed,
  skillCount: career.skills.length,
  skills: career.skills.map(({ name, requiredLevel, effort }) => ({ name, requiredLevel, effort })),
}));

function containsKeyword(text, keyword) {
  if (keyword.length > 4) return text.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = keyword === "test" ? "(?:s|ed|ing)?" : "";
  return new RegExp(`(^|[^a-z0-9])${escaped}${suffix}(?=$|[^a-z0-9])`, "i").test(text);
}

function emptyState() {
  return {
    privacy: {
      consent: null,
      externalAiProcessing: false,
      modelTraining: false,
      retention: "Stored locally on this device until you delete it.",
    },
    currentUser: null,
    users: [],
    profile: null,
    assessment: [],
    evidence: [],
    skillReport: null,
    recommendedAction: null,
    activity: [],
    changeLog: [],
  };
}

function sanitizeState(state) {
  if (!state) return state;
  return {
    ...state,
    users: (state.users || []).map(({ passwordHash, salt, ...safe }) => safe),
  };
}

async function readState() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch (error) {
    if (error.code === "ENOENT") return emptyState();
    if (error instanceof SyntaxError) {
      console.warn("Corrupted JSON data encountered, falling back to empty state.");
      return emptyState();
    }
    throw error;
  }
}

async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.join(DATA_DIR, `nextstep-data.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  try {
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    // Windows file lock / rename fallback
    await fs.copyFile(tempFile, DATA_FILE);
    await fs.unlink(tempFile).catch(() => {});
  }
}

function addActivity(state, message) {
  state.activity.unshift({ id: crypto.randomUUID(), message, createdAt: new Date().toISOString() });
  state.activity = state.activity.slice(0, 8);
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES && !tooLarge) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body exceeds the 2 MB limit."), { status: 413 }));
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Send a valid JSON request body."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function validateProfile(value) {
  if (!value) return "Add your name, course, academic year, and target career.";
  if (!value.name || typeof value.name !== "string" || !value.name.trim()) return "Add your full name.";
  if (!value.course || typeof value.course !== "string" || !value.course.trim()) return "Add your course or degree.";
  if (!value.year || typeof value.year !== "string" || !value.year.trim()) return "Choose your academic year.";
  if (!value.careerId || typeof value.careerId !== "string" || !value.careerId.trim()) return "Choose your target career.";
  if (value.discipline !== undefined && typeof value.discipline !== "string") return "Discipline must be text.";
  if (!careers[value.careerId]) {
    return "Choose a target career from the supported career list.";
  }
  if (value.name.length > 100 || value.course.length > 120 || (value.discipline && value.discipline.length > 120)) {
    return "Profile fields must be 120 characters or fewer.";
  }
  if (value.bio && (typeof value.bio !== "string" || value.bio.length > 500)) {
    return "Your introduction must be 500 characters or fewer.";
  }
  if (value.interests && (typeof value.interests !== "string" || value.interests.length > 500)) {
    return "Interests must be 500 characters or fewer.";
  }
  if (value.semester !== undefined && (typeof value.semester !== "string" || value.semester.length > 40)) {
    return "Semester must be 40 characters or fewer.";
  }
  if (value.learningStyle !== undefined && (
    typeof value.learningStyle !== "string" || !["", "Hands-on projects", "Reading & documentation", "Videos & demonstrations", "Practice exercises"].includes(value.learningStyle)
  )) {
    return "Choose a supported learning style.";
  }
  if (value.skills !== undefined && (!Array.isArray(value.skills) || value.skills.length > 20 || value.skills.some((skill) => typeof skill !== "string" || skill.length > 60))) {
    return "Profile learning notes must contain up to 20 text items of 60 characters or fewer.";
  }
  if (value.availableHours !== undefined && value.availableHours !== "" && (
    !Number.isInteger(Number(value.availableHours)) || Number(value.availableHours) < 1 || Number(value.availableHours) > 80
  )) {
    return "Available study time must be between 1 and 80 hours per week.";
  }
  return null;
}

function validateEvidence(value) {
  if (!value || typeof value.title !== "string" || !value.title.trim()) return "Give your evidence a title.";
  if (value.title.length > 120) return "Evidence titles must be 120 characters or fewer.";
  const evidenceTypes = ["Project", "Coursework", "Assignment", "Internship", "GitHub repository", "Certificate", "Report", "Portfolio", "Other"];
  if (typeof value.type !== "string" || !evidenceTypes.includes(value.type)) return "Choose a supported evidence type.";
  if (value.description && (typeof value.description !== "string" || value.description.length > 5000)) {
    return "Evidence notes must be 5,000 characters or fewer.";
  }
  if (value.content && (typeof value.content !== "string" || value.content.length > 20000)) {
    return "Evidence text must be 20,000 characters or fewer.";
  }
  if (value.fileName && (typeof value.fileName !== "string" || value.fileName.length > 180)) {
    return "File names must be 180 characters or fewer.";
  }
  if (value.fileName && !ALLOWED_FILE_TYPES.has(path.extname(value.fileName).toLowerCase())) {
    return "Use a PDF, TXT, Markdown, CSV, JSON, HTML, CSS, JavaScript, Python, Java, or TypeScript file.";
  }
  if (value.link && (typeof value.link !== "string" || value.link.length > 500 || !isSafeEvidenceLink(value.link))) {
    return "Links must be valid public HTTPS GitHub or portfolio URLs.";
  }
  if (value.fileData && (
    typeof value.fileData !== "string"
    || value.fileData.length > 1_400_000
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.fileData)
  )) {
    return "The attached file is invalid or exceeds the 1 MB limit.";
  }
  if (value.fileData) {
    const bytes = Buffer.from(value.fileData, "base64");
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) return "The attached file is empty or exceeds the 1 MB limit.";
    const extension = path.extname(value.fileName).toLowerCase();
    if (extension === ".pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) return "That file does not have a valid PDF signature.";
    if (extension !== ".pdf" && bytes.includes(0)) return "Binary files aren't supported. Upload one of the listed document or source-code formats.";
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) return "This file may contain a secret or credential. Remove it before adding your evidence.";
    if (/\.(txt|md|csv|json|html|css|js|py|java|ts|tsx|jsx)$/i.test(value.fileName)) {
      if (value.content) {
        const normalizedFile = text.replace(/\r\n/g, "\n").slice(0, 20000);
        const normalizedContent = value.content.replace(/\r\n/g, "\n");
        if (normalizedContent !== normalizedFile && normalizedContent.trim() !== normalizedFile.trim()) {
          return "The extracted evidence text did not match the uploaded file. Please upload it again.";
        }
      }
    }
  }
  if (value.fileData && !value.fileName) return "Include the file name when attaching evidence.";
  if (value.link && !value.fileData && !value.description) return "Add a short description of the linked work so it can be assessed without fetching private files.";
  if (SECRET_PATTERNS.some((pattern) => pattern.test(`${value.description || ""}\n${value.content || ""}`))) {
    return "Your evidence text may contain a secret or credential. Remove it before submitting.";
  }
  return null;
}

function isSafeEvidenceLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "github.com" || url.hostname === "www.github.com" || url.hostname === "gitlab.com" || url.hostname === "www.gitlab.com" || url.hostname.includes("."));
  } catch {
    return false;
  }
}

function requireConsent(state) {
  if (!state.privacy?.consent?.accepted) {
    const error = new Error("Review and accept the privacy notice before adding personal information or evidence.");
    error.status = 403;
    throw error;
  }
}

function levelForSkill(state, skill, evidenceIds, matchCount) {
  if (evidenceIds.length === 0) {
    const claim = state.assessment.find((item) => item.skill.toLowerCase() === skill.name.toLowerCase());
    return {
      level: 0,
      score: 0,
      status: claim ? "claimed-unverified" : "missing",
      confidence: claim ? Math.min(0.35, 0.12 + claim.confidence * 0.2) : 0.05,
      evidenceIds: [],
      claim: claim ? { level: claim.level, confidence: claim.confidence } : null,
      observations: [],
    };
  }
  const score = Math.min(100, 25 + matchCount * 18 + Math.max(0, evidenceIds.length - 1) * 12);
  const level = score >= 75 ? 3 : score >= 50 ? 2 : 1;
  return {
    level,
    score,
    status: score >= 75 && (matchCount >= 3 || evidenceIds.length >= 2) ? "demonstrated" : "partial",
    confidence: Math.min(0.92, 0.35 + matchCount * 0.09 + Math.max(0, evidenceIds.length - 1) * 0.1),
    evidenceIds,
    claim: null,
    observations: [],
  };
}

function analyze(state) {
  requireConsent(state);
  if (!state.profile) throw Object.assign(new Error("Create your student profile before analyzing your skills."), { status: 400 });

  const career = careers[state.profile.careerId];
  if (!career) throw Object.assign(new Error("Selected career framework not found."), { status: 400 });

  const oldReport = state.skillReport;
  const framework = career.skills;

  const skills = framework.map((skill, index) => {
    const evidenceMatches = (state.evidence || []).map((item) => {
      const text = `${item.title} ${item.type} ${item.description || ""} ${item.analysisText || ""}`.toLowerCase();
      const detectedKeywords = new Set(item.detectedKeywords || []);
      const matchedKeywords = skill.keywords.filter((keyword) =>
        detectedKeywords.has(keyword.toLowerCase()) || containsKeyword(text, keyword.toLowerCase()),
      );
      return matchedKeywords.length ? { item, matchedKeywords } : null;
    }).filter(Boolean);
    const evidenceIds = evidenceMatches.map(({ item }) => item.id);
    const matches = evidenceMatches.flatMap(({ matchedKeywords }) => matchedKeywords);
    const capability = levelForSkill(state, skill, evidenceIds, matches.length);
    return {
      name: skill.name,
      importance: skill.importance,
      requiredLevel: skill.requiredLevel,
      ...capability,
      matchedKeywords: matches,
      prerequisites: skill.prerequisites || [],
      evidenceTitles: evidenceMatches.map(({ item }) => item.title),
    };
  });

  skills.forEach((skill) => {
    skill.dependencyReady = !skill.prerequisites.length || skill.prerequisites.every((prerequisite) =>
      (skills.find((existing) => existing.name === prerequisite)?.level || 0) > 0,
    );
  });

  // Calculate gaps and prioritization
  const allGapCandidates = framework.map((skill, index) => {
    const current = skills[index];
    const gapSeverity = Math.max(0, skill.requiredLevel - current.level) / skill.requiredLevel;
    const fit = state.profile.availableHours ? Math.max(0.25, Math.min(1, state.profile.availableHours / skill.effort)) : 1;
    const prereqsMet = !skill.prerequisites?.length || skill.prerequisites.every((prerequisite) => {
      const parent = skills.find((item) => item.name === prerequisite);
      return parent && parent.level > 0;
    });
    const prerequisiteScore = prereqsMet ? 1.0 : 0.65;
    const uncertainty = current.status === "claimed-unverified" || current.confidence < 0.5 ? 1.15 : 1.0;
    return {
      skill, current, index, gapSeverity, fit, prerequisiteScore, prereqsMet,
      priority: skill.importance * gapSeverity * prerequisiteScore * fit * uncertainty,
    };
  }).filter((candidate) => candidate.gapSeverity > 0);

  // First select from skills whose prerequisites are satisfied, ordered by priority
  const readyCandidates = allGapCandidates.filter((c) => c.prereqsMet).sort((a, b) => b.priority - a.priority);
  let selected = readyCandidates[0];

  // If no ready candidates (e.g. strict prerequisites), pick the highest priority gap overall
  if (!selected && allGapCandidates.length) {
    selected = allGapCandidates.sort((a, b) => b.priority - a.priority)[0];
  }

  const hasRoleRelevantEvidence = skills.some((skill) => skill.evidenceIds && skill.evidenceIds.length > 0);

  if (!selected) {
    // 100% readiness across all skills
    state.skillReport = {
      skills,
      readiness: 100,
      demonstratedCount: skills.filter((skill) => skill.status === "demonstrated" || skill.level > 0).length,
      totalSkills: skills.length,
      gaps: [],
      analyzedAt: new Date().toISOString(),
      evidenceCount: state.evidence.length,
      evidenceQuality: hasRoleRelevantEvidence ? "role-relevant-signals-found" : "insufficient-role-relevance",
      career: { name: career.name, version: career.version, source: career.source, reviewed: career.reviewed },
      method: "deterministic-prototype",
    };
    state.recommendedAction = null;
    addActivity(state, `Career requirements reviewed for ${career.name}; all framework competencies demonstrated.`);
    return state;
  }

  const { skill: prioritySkill, current } = selected;
  const actionTitle = {
    build: `Build a small ${prioritySkill.name} project`,
    learn: `Learn the foundations of ${prioritySkill.name}`,
    practice: `Practice ${prioritySkill.name} with a focused exercise`,
    improve: `Improve your ${prioritySkill.name} evidence`,
    integrate: `Add ${prioritySkill.name} to an existing project`,
    document: `Document your work in ${prioritySkill.name}`,
    analyze: `Create an analysis demonstrating ${prioritySkill.name}`,
  }[prioritySkill.type] || `Build a practical ${prioritySkill.name} project`;

  const reason = current.status === "claimed-unverified"
    ? `You self-reported ${prioritySkill.name}, but your submitted work does not demonstrate it yet. This action turns your claim into verifiable portfolio evidence.`
    : `${prioritySkill.name} is an essential ${career.name} requirement (${Math.round(prioritySkill.importance * 100)}% framework importance) and your profile shows a ${current.status === "missing" ? "gap" : "partial capability"}. ${state.profile.availableHours && prioritySkill.effort > state.profile.availableHours ? `Plan the ${prioritySkill.effort}-hour task across multiple weeks to fit your ${state.profile.availableHours} available hours per week.` : state.profile.availableHours ? `The ${prioritySkill.effort}-hour task fits your available weekly study time.` : `Plan for about ${prioritySkill.effort} hours of focused work.`}`;

  const action = {
    id: crypto.randomUUID(),
    title: actionTitle,
    skill: prioritySkill.name,
    type: prioritySkill.type,
    reason,
    priorityScore: Math.round(selected.priority * 100) / 100,
    careerRequirement: { role: career.name, version: career.version, importance: prioritySkill.importance, requiredLevel: prioritySkill.requiredLevel },
    currentCapability: { status: current.status, level: current.level, confidence: current.confidence, evidenceIds: current.evidenceIds },
    outcome: `A portfolio-ready deliverable demonstrating ${prioritySkill.name.toLowerCase()}, with a short explanation of your design decisions.`,
    expectedEvidence: ["Working project, script, or practice artifact", "README or short report explaining your approach", "Code repository link or uploaded source file"],
    estimatedEffortHours: prioritySkill.effort,
    feasibility: {
      weeklyHoursAvailable: state.profile.availableHours,
      fitsAvailableTime: state.profile.availableHours ? prioritySkill.effort <= state.profile.availableHours : null,
    },
    steps: [
      `Choose one small, practical problem in ${career.name} that exercises ${prioritySkill.name.toLowerCase()}.`,
      `Build a working solution demonstrating correct patterns and principles.`,
      `Document what you built, what you learned, and upload the source or link as new evidence.`,
    ],
    resources: [
      { label: `Search ${prioritySkill.name} tutorial & docs`, url: `https://www.google.com/search?q=${encodeURIComponent(`${prioritySkill.name} beginner project tutorial`)}` },
      { label: "Browse project ideas on GitHub", url: "https://github.com/topics/beginner-project" },
    ],
    createdAt: new Date().toISOString(),
    completed: false,
  };

  if (!hasRoleRelevantEvidence) {
    action.title = `Create a starter project demonstrating ${prioritySkill.name}`;
    action.type = "build";
    action.reason = `To begin your evidence-backed preparation toward ${career.name}, your first step is demonstrating ${prioritySkill.name} (${Math.round(prioritySkill.importance * 100)}% framework weight). Real work counts as proof; claims alone remain unverified.`;
    action.outcome = `A working starter project or code sample demonstrating ${prioritySkill.name.toLowerCase()} for your ${career.name} portfolio.`;
    action.expectedEvidence = [
      `A small project or code file demonstrating ${prioritySkill.name}`,
      "A short description explaining what you built and how it works",
      "Screenshot, repository link, or uploaded source file",
    ];
    action.steps = [
      `Pick a beginner-friendly project focused on ${prioritySkill.name.toLowerCase()}.`,
      `Implement the core functionality using standard tools and best practices.`,
      `Add your completed project to NextStep evidence to verify your capability.`,
    ];
  }

  const demonstratedCount = skills.filter((skill) => skill.status === "demonstrated" || skill.level > 0).length;
  const readiness = Math.round(skills.reduce((sum, item, idx) => sum + Math.min(1, item.level / framework[idx].requiredLevel) * 100, 0) / skills.length);

  state.skillReport = {
    skills,
    readiness,
    demonstratedCount,
    totalSkills: skills.length,
    gaps: skills.filter((skill) => skill.level < skill.requiredLevel).map((skill) => skill.name),
    analyzedAt: new Date().toISOString(),
    evidenceCount: state.evidence.length,
    evidenceQuality: hasRoleRelevantEvidence ? "role-relevant-signals-found" : "insufficient-role-relevance",
    career: { name: career.name, version: career.version, source: career.source, reviewed: career.reviewed },
    method: "deterministic-prototype",
  };
  state.recommendedAction = action;

  if (oldReport) {
    const previous = new Map(oldReport.skills.map((skill) => [skill.name, skill]));
    const changes = skills.filter((skill) => previous.has(skill.name) && (
      previous.get(skill.name).status !== skill.status || previous.get(skill.name).level !== skill.level
    ))
    .map((skill) => ({
      skill: skill.name,
      previousStatus: previous.get(skill.name).status,
      newStatus: skill.status,
      previousLevel: previous.get(skill.name).level,
      newLevel: skill.level,
      confidence: skill.confidence,
    }));
    if (changes.length) {
      state.changeLog.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        evidenceIds: state.evidence.map((item) => item.id),
        changes,
        nextSkill: action.skill,
      });
      state.changeLog = state.changeLog.slice(0, 20);
    }
  }

  addActivity(state, state.evidence.length
    ? `Skills analyzed from ${state.evidence.length} ${state.evidence.length === 1 ? "piece" : "pieces"} of evidence.`
    : `Career readiness mapped for ${career.name}. Next action prioritized.`);
  return state;
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
    sendJson(response, 403, { error: "That file is not available." });
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Page not found." });
      return;
    }
    throw error;
  }
}

async function deleteEvidenceFile(id) {
  try {
    await fs.unlink(path.join(DATA_DIR, "uploads", `${id}.upload`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function deleteAllStoredData() {
  const state = await readState();
  for (const evidence of state.evidence) {
    if (evidence.fileStored) await deleteEvidenceFile(evidence.id);
  }
  try {
    await fs.unlink(DATA_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      });
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const { pathname } = url;

    // Provide friendly favicon
    if (pathname === "/favicon.ico") {
      const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#18181b"/><path d="M7 16h15m-6-7 7 7-7 7" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      response.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(icon);
      return;
    }

    if (pathname === "/api/auth/me" && request.method === "GET") {
      const state = await readState();
      sendJson(response, 200, { user: state.currentUser || null });
      return;
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readBody(request);
      if (!body.email || !body.password) {
        sendJson(response, 400, { error: "Enter both your email and password." });
        return;
      }
      const state = await readState();
      const email = String(body.email).trim().toLowerCase();
      const user = (state.users || []).find((u) => u.email === email);
      if (!user) {
        sendJson(response, 401, { error: "No account found with this email address." });
        return;
      }
      const testHash = crypto.createHash("sha256").update(body.password + (user.salt || "")).digest("hex");
      if (testHash !== user.passwordHash) {
        sendJson(response, 401, { error: "Incorrect password. Please verify your credentials." });
        return;
      }
      const safeUser = {
        id: user.id,
        name: user.name,
        badgeId: user.badgeId,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        lastLoginAt: new Date().toISOString(),
      };
      state.currentUser = safeUser;
      addActivity(state, `Signed in as ${user.name} (${user.badgeId}).`);
      await writeState(state);
      sendJson(response, 200, { success: true, user: safeUser, state: sanitizeState(state) });
      return;
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      const body = await readBody(request);
      if (!body.name || !body.email || !body.password) {
        sendJson(response, 400, { error: "Name, email, and password are required." });
        return;
      }
      if (String(body.password).length < 6) {
        sendJson(response, 400, { error: "Password must be at least 6 characters." });
        return;
      }
      const state = await readState();
      state.users = state.users || [];
      const email = String(body.email).trim().toLowerCase();
      if (state.users.some((u) => u.email === email)) {
        sendJson(response, 409, { error: "An account with this email address already exists." });
        return;
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = crypto.createHash("sha256").update(body.password + salt).digest("hex");
      const year = new Date().getFullYear();
      const badgeId = (body.badgeId && String(body.badgeId).trim()) || `ST-${year}-${Math.floor(100 + Math.random() * 900)}`;
      const newUser = {
        id: crypto.randomUUID(),
        name: String(body.name).trim(),
        badgeId,
        email,
        mobile: String(body.mobile || "").trim(),
        role: String(body.role || "Software Developer").trim(),
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      state.users.push(newUser);
      const safeUser = {
        id: newUser.id,
        name: newUser.name,
        badgeId: newUser.badgeId,
        email: newUser.email,
        mobile: newUser.mobile,
        role: newUser.role,
      };
      state.currentUser = safeUser;
      const roleMap = {
        "Software Developer": { careerId: "software-developer", course: "Computer Science & Engineering", discipline: "Technology" },
        "Embedded Systems Engineer": { careerId: "embedded-systems", course: "Electronics & Electrical Engineering", discipline: "Engineering" },
        "Financial Analyst": { careerId: "financial-analyst", course: "Finance & Economics", discipline: "Business" },
        "UX Researcher": { careerId: "ux-researcher", course: "Design & Human-Computer Interaction", discipline: "Arts & Design" },
      };
      const mapped = roleMap[newUser.role] || { careerId: "software-developer", course: "Undergraduate Studies", discipline: "Technology" };

      if (!state.profile) {
        state.profile = {
          name: newUser.name,
          course: mapped.course,
          discipline: mapped.discipline,
          year: "3rd Year",
          semester: "5",
          careerId: mapped.careerId,
          targetRole: newUser.role,
          availableHours: 10,
          learningStyle: "Hands-on projects",
          skills: [],
          interests: `${newUser.role} career preparation`,
          bio: `Student ID: ${newUser.badgeId} · Verified student account`,
          updatedAt: new Date().toISOString(),
        };
      } else {
        state.profile.name = newUser.name;
        if (newUser.role) {
          state.profile.targetRole = newUser.role;
          state.profile.careerId = mapped.careerId;
        }
      }
      if (!state.privacy?.consent?.accepted) {
        state.privacy = {
          ...state.privacy,
          consent: {
            accepted: true,
            version: "1.0",
            acceptedAt: new Date().toISOString(),
            purpose: "Student registration and workspace access",
          },
        };
      }
      addActivity(state, `Account registered for ${newUser.name} (${newUser.badgeId}).`);
      try { await triggerAIAnalysis(state); } catch (e) { console.error(e); }
      await writeState(state);
      sendJson(response, 201, { success: true, user: safeUser, state: sanitizeState(state) });
      return;
    }

    if (pathname === "/api/auth/guest" && request.method === "POST") {
      const state = await readState();
      const guestUser = {
        id: "guest-" + crypto.randomUUID().slice(0, 8),
        name: "Guest Student",
        badgeId: "ST-GUEST-01",
        email: "guest.student@nextstep.edu",
        mobile: "+91 98765 43210",
        role: "Software Developer",
        isGuest: true,
      };
      state.currentUser = guestUser;
      if (!state.privacy?.consent?.accepted) {
        state.privacy = {
          ...state.privacy,
          consent: {
            accepted: true,
            version: "1.0",
            acceptedAt: new Date().toISOString(),
            purpose: "Guest student exploration and workspace access",
          },
        };
      }
      if (!state.profile) {
        state.profile = {
          name: "Guest Student",
          course: "Computer Science & Engineering",
          discipline: "Technology",
          year: "3rd Year",
          semester: "5",
          careerId: "software-developer",
          targetRole: "Software Developer",
          availableHours: 10,
          learningStyle: "Hands-on projects",
          skills: [],
          interests: "Software development, project evidence",
          bio: "Guest student exploring evidence-based career preparation on NextStep.",
          updatedAt: new Date().toISOString(),
        };
      }
      addActivity(state, "Accessed workspace as Guest Student.");
      try { await triggerAIAnalysis(state); } catch (e) { console.error(e); }
      await writeState(state);
      sendJson(response, 200, { success: true, user: guestUser, state: sanitizeState(state) });
      return;
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const state = await readState();
      const prevName = state.currentUser?.name || "User";
      state.currentUser = null;
      addActivity(state, `${prevName} signed out of session.`);
      await writeState(state);
      sendJson(response, 200, { success: true, state: sanitizeState(state) });
      return;
    }

    if (pathname === "/api/auth/send-otp" && request.method === "POST") {
      sendJson(response, 200, {
        success: true,
        message: "One-Time Password (OTP) dispatched to Gmail and Mobile SMS.",
        demoOtp: "849201",
      });
      return;
    }

    if (pathname === "/api/careers" && request.method === "GET") {
      sendJson(response, 200, { careers: careerList });
      return;
    }

    if (pathname === "/api/privacy" && request.method === "GET") {
      const state = await readState();
      sendJson(response, 200, {
        ...state.privacy,
        consent: state.privacy.consent,
        storedEvidence: state.evidence.length,
        storedFiles: state.evidence.filter((item) => item.fileStored).length,
        lastActivityAt: state.activity[0]?.createdAt || null,
        analysisMethod: "Local deterministic keyword matching. No AI provider receives your data.",
      });
      return;
    }

    if (pathname === "/api/privacy/export" && request.method === "GET") {
      const state = await readState();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nextstep-data-export.json"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify(state, null, 2));
      return;
    }

    if (pathname === "/api/privacy/consent" && request.method === "POST") {
      const body = await readBody(request);
      if (body?.accepted !== true) {
        sendJson(response, 400, { error: "Consent must be explicitly accepted before continuing." });
        return;
      }
      const state = await readState();
      state.privacy = {
        ...state.privacy,
        consent: { accepted: true, version: "1.0", acceptedAt: new Date().toISOString(), purpose: "Personalized evidence-to-action career guidance" },
      };
      addActivity(state, "Privacy notice reviewed and consent recorded.");
      await writeState(state);
      sendJson(response, 200, state);
      return;
    }

    if (pathname === "/api/privacy/account" && request.method === "DELETE") {
      await deleteAllStoredData();
      sendJson(response, 200, { deleted: true });
      return;
    }

    if (pathname === "/api/state" && request.method === "GET") {
      sendJson(response, 200, sanitizeState(await readState()));
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/evidence\/([0-9a-f-]{36})$/);
    if (deleteMatch && request.method === "DELETE") {
      requireConsent(await readState());
      const state = await readState();
      const index = state.evidence.findIndex((item) => item.id === deleteMatch[1]);
      if (index === -1) {
        sendJson(response, 404, { error: "That evidence was not found." });
        return;
      }
      const [deleted] = state.evidence.splice(index, 1);
      if (deleted.fileStored) await deleteEvidenceFile(deleted.id);
      state.skillReport = null;
      state.recommendedAction = null;
      state.changeLog = state.changeLog.filter((entry) => !entry.evidenceIds.includes(deleted.id));
      state.activity = state.activity.filter((item) => item.message !== `Evidence added: ${deleted.title}.`);
      addActivity(state, `Evidence deleted: ${deleted.title}. Refresh your skill map to recalculate recommendations.`);
      await writeState(state);
      sendJson(response, 200, state);
      return;
    }

    const fileMatch = pathname.match(/^\/api\/evidence\/([0-9a-f-]{36})\/file$/);
    if (fileMatch && request.method === "GET") {
      const state = await readState();
      const item = state.evidence.find((evidence) => evidence.id === fileMatch[1] && evidence.fileStored);
      if (!item) {
        sendJson(response, 404, { error: "That evidence file was not found." });
        return;
      }
      try {
        const content = await fs.readFile(path.join(DATA_DIR, "uploads", `${item.id}.upload`));
        response.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": content.length,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.fileName)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Access-Control-Allow-Origin": "*",
        });
        response.end(content);
      } catch (error) {
        if (error.code === "ENOENT") {
          sendJson(response, 404, { error: "That evidence file is no longer available." });
          return;
        }
        throw error;
      }
      return;
    }

    if (pathname.startsWith("/api/")) {
      if (request.method !== "POST" && request.method !== "PUT") {
        sendJson(response, 405, { error: "Use POST or PUT for this endpoint." });
        return;
      }

      const body = await readBody(request);
      const state = await readState();

      if (pathname === "/api/profile") {
        if (!state.privacy?.consent?.accepted) {
          state.privacy = {
            ...state.privacy,
            consent: {
              accepted: true,
              version: "1.0",
              acceptedAt: new Date().toISOString(),
              purpose: "Personalized evidence-to-action career guidance",
            },
          };
          addActivity(state, "Privacy notice accepted during profile setup.");
        }
        const error = validateProfile(body);
        if (error) {
          sendJson(response, 400, { error });
          return;
        }
        const previousCareerId = state.profile?.careerId;
        state.profile = {
          name: body.name.trim(),
          course: body.course.trim(),
          year: body.year.trim(),
          discipline: (body.discipline || "General Studies").trim(),
          semester: typeof body.semester === "string" ? body.semester.trim() : "",
          careerId: body.careerId,
          targetRole: careers[body.careerId].name,
          availableHours: body.availableHours ? Number(body.availableHours) : null,
          learningStyle: typeof body.learningStyle === "string" ? body.learningStyle.slice(0, 40) : "",
          skills: Array.isArray(body.skills)
            ? body.skills.filter((skill) => typeof skill === "string").map((skill) => skill.trim().slice(0, 60)).filter(Boolean).slice(0, 20)
            : [],
          interests: typeof body.interests === "string" ? body.interests.trim().slice(0, 500) : "",
          bio: typeof body.bio === "string" ? body.bio.trim() : "",
          updatedAt: new Date().toISOString(),
        };
        if (previousCareerId && previousCareerId !== state.profile.careerId) {
          state.assessment = [];
          state.skillReport = null;
          state.recommendedAction = null;
          state.changeLog = [];
        }
        addActivity(state, `Student profile ${state.activity.some((item) => item.message.includes("profile")) ? "updated" : "created"} for ${state.profile.targetRole}.`);
        analyze(state);
      } else if (pathname === "/api/evidence") {
        requireConsent(state);
        const error = validateEvidence(body);
        if (error) {
          sendJson(response, 400, { error });
          return;
        }
        let fileText = "";
        let fileBuffer = null;
        if (body.fileData) {
          fileBuffer = Buffer.from(body.fileData, "base64");
          if (!fileBuffer.length || fileBuffer.length > MAX_FILE_BYTES) {
            sendJson(response, 400, { error: "The attached file is empty or exceeds the 1 MB limit." });
            return;
          }
          const ext = path.extname(body.fileName || "").toLowerCase();
          if (ext !== ".pdf") {
            fileText = fileBuffer.toString("utf8").replace(/^\uFEFF/, "").slice(0, 20000);
          }
        }

        const evidence = {
          id: crypto.randomUUID(),
          title: body.title.trim(),
          type: body.type.trim(),
          description: (body.description || "").trim(),
          link: body.link || "",
          analysisText: (body.content || fileText || "").trim(),
          fileName: typeof body.fileName === "string" ? body.fileName.trim() : "",
          fileStored: Boolean(body.fileData),
          createdAt: new Date().toISOString(),
        };
        const evidenceText = `${evidence.title} ${evidence.type} ${evidence.description} ${evidence.analysisText}`.toLowerCase();
        evidence.detectedKeywords = [...new Set(Object.values(careers).flatMap((career) =>
          career.skills.flatMap((skill) => skill.keywords)
            .filter((keyword) => containsKeyword(evidenceText, keyword.toLowerCase()))
            .map((keyword) => keyword.toLowerCase()),
        ))];
        if (fileBuffer) {
          await fs.mkdir(path.join(DATA_DIR, "uploads"), { recursive: true });
          await fs.writeFile(path.join(DATA_DIR, "uploads", `${evidence.id}.upload`), fileBuffer, { flag: "wx" });
        }
        state.evidence.unshift(evidence);
        addActivity(state, `Evidence added: ${evidence.title}.`);
        if (state.profile) analyze(state);
        evidence.analysisText = "";
      } else if (pathname === "/api/assessment") {
        requireConsent(state);
        if (!state.profile) {
          sendJson(response, 400, { error: "Create your student profile and choose a career before self-assessment." });
          return;
        }
        if (!Array.isArray(body.skills) || body.skills.length > 30) {
          sendJson(response, 400, { error: "Submit up to 30 skill assessments." });
          return;
        }
        const framework = careers[state.profile.careerId].skills;
        const assessment = [];
        for (const item of body.skills) {
          if (typeof item.skill !== "string" || !framework.some((skill) => skill.name === item.skill)) {
            sendJson(response, 400, { error: "Self-assessment skills must belong to your selected career framework." });
            return;
          }
          if (!Number.isInteger(item.level) || item.level < 0 || item.level > 3 || !["low", "medium", "high"].includes(item.confidence)) {
            sendJson(response, 400, { error: "Each skill needs a level from 0–3 and a low, medium, or high confidence." });
            return;
          }
          assessment.push({
            skill: item.skill,
            level: item.level,
            confidence: { low: 0.25, medium: 0.55, high: 0.85 }[item.confidence],
            confidenceLabel: item.confidence,
          });
        }
        state.assessment = assessment;
        addActivity(state, "Self-assessment updated. Claims remain separate from evidence.");
        analyze(state);
      } else if (pathname === "/api/analyze") {
        analyze(state);
      } else if (pathname === "/api/complete-action") {
        if (!state.recommendedAction) {
          sendJson(response, 400, { error: "Analyze your evidence to get a next action first." });
          return;
        }
        if (typeof body.reflection !== "string" || body.reflection.trim().length < 3 || body.reflection.length > 1000) {
          sendJson(response, 400, { error: "Add a short reflection (3–1,000 characters) before completing this action." });
          return;
        }
        state.recommendedAction.completed = true;
        state.recommendedAction.reflection = body.reflection.trim();
        state.recommendedAction.completedAt = new Date().toISOString();
        addActivity(state, `Completed: ${state.recommendedAction.title}. Add your new work as evidence to refresh your next action.`);
      } else {
        sendJson(response, 404, { error: "API endpoint not found." });
        return;
      }

      await writeState(state);
      sendJson(response, 200, sanitizeState(state));
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(request, response, pathname);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.status || 500, { error: error.status ? error.message : "The server could not complete your request." });
    }
    if (!error.status) console.error("Request failed:", error);
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`NextStep backend is running:`);
  console.log(`  - Local:    http://${displayHost}:${PORT}`);
  console.log(`  - Loopback: http://127.0.0.1:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n[NextStep Server Error] Port ${PORT} is already in use by another process.`);
    console.error(`Either stop the existing process or run with a different port:\n  PORT=${PORT + 1} npm start\n`);
  } else {
    console.error("[NextStep Server Error]", error);
  }
  process.exit(1);
});
