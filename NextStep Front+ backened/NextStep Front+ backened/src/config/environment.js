const path = require("node:path");

// Automatically load local .env if available
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // .env file not present or not accessible - continue with process.env
}

const ROOT = path.resolve(__dirname, "../..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "nextstep-data.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "nextstep";
const AI_BASE_URL = process.env.AI_BASE_URL || "http://127.0.0.1:8000/api/ai";

// 10 MB maximum file upload limit (expanded from 1 MB)
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes (10 MB)
// 15 MB maximum request body to comfortably accommodate 10 MB base64 data (~13.3 MB) + JSON wrapper
const MAX_BODY_BYTES = 15 * 1024 * 1024; 
// Base64 string length for 10 MB is ceil(10*1024*1024 / 3) * 4 ≈ 13,981,016 characters
const MAX_BASE64_LENGTH = 15_000_000;

const ALLOWED_FILE_TYPES = new Set([
  ".pdf", ".txt", ".md", ".csv", ".json", ".html", ".css", ".js", ".py", ".java",
  ".ts", ".tsx", ".jsx", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".zip"
]);

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|password|passwd|secret|database[_-]?url)\s*[:=]\s*["']?[\w./+=-]{8,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

// Expanded comprehensive list of evidence types organized by domain
const EVIDENCE_CATEGORIES = {
  "Academic & Coursework": [
    "Coursework",
    "Academic Transcript",
    "Capstone Project",
    "Assignment",
    "Research Paper",
    "Thesis / Dissertation"
  ],
  "Projects & Technical Work": [
    "Project",
    "GitHub repository",
    "Open Source Contribution",
    "Technical Report",
    "System Architecture / Design",
    "Code Sample"
  ],
  "Work & Experience": [
    "Internship",
    "Employment Experience",
    "Freelance Project",
    "Apprenticeship"
  ],
  "Certifications & Training": [
    "Certificate",
    "Online Course Completion",
    "Bootcamp Completion",
    "Workshop / Training"
  ],
  "Honors, Awards & Competitions": [
    "Award",
    "Competition / Hackathon",
    "Scholarship",
    "Honor Society"
  ],
  "Leadership & Extracurricular": [
    "Leadership Role",
    "Extracurricular Activity",
    "Volunteering",
    "Student Organization"
  ],
  "Presentations & Publications": [
    "Conference Presentation",
    "Publication",
    "Poster Session",
    "Tech Talk / Demo"
  ],
  "Portfolio & Recommendations": [
    "Portfolio",
    "Recommendation Letter",
    "Client Testimonial",
    "Other"
  ]
};

const ALL_EVIDENCE_TYPES = new Set(
  Object.values(EVIDENCE_CATEGORIES).flat()
);

module.exports = {
  ROOT,
  PUBLIC_DIR,
  DATA_DIR,
  DATA_FILE,
  UPLOADS_DIR,
  PORT,
  HOST,
  MONGODB_URI,
  MONGODB_DB_NAME,
  AI_BASE_URL,
  MAX_FILE_BYTES,
  MAX_BODY_BYTES,
  MAX_BASE64_LENGTH,
  ALLOWED_FILE_TYPES,
  SECRET_PATTERNS,
  EVIDENCE_CATEGORIES,
  ALL_EVIDENCE_TYPES,
};
