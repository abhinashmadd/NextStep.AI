const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");

const TEST_PORT = 3999;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let authToken = "";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...options.headers };
  if (authToken && !headers["authorization"] && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  let body;
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  if (body && typeof body === "object" && body.token) {
    authToken = body.token;
  }
  if (path === "/api/auth/logout" && response.status === 200) {
    authToken = "";
  }
  return { status: response.status, headers: response.headers, body };
}

async function runTests() {
  console.log("Starting backend test suite on port", TEST_PORT);

  // Clean data folder for test
  const dataDir = path.join(__dirname, "data");
  try {
    await fs.rm(dataDir, { recursive: true, force: true });
  } catch {}

  const serverProc = spawn("node", ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT), HOST: "127.0.0.1" },
    stdio: "inherit",
  });

  // Wait for server to start
  let started = false;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const res = await request("/api/careers");
      if (res.status === 200) {
        started = true;
        break;
      }
    } catch {}
  }

  if (!started) {
    serverProc.kill();
    throw new Error("Server failed to start within timeout");
  }

  const passed = [];
  const failed = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed.push(message);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed.push(message);
    }
  }

  try {
    // 1. CORS Preflight
    console.log("\n[1] Testing CORS Preflight & Headers");
    const preflight = await request("/api/profile", {
      method: "OPTIONS",
      headers: {
        "Origin": "http://127.0.0.1:5500",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    assert(preflight.status === 204, "OPTIONS returns 204 No Content");
    assert(preflight.headers.get("access-control-allow-origin") === "*", "OPTIONS has Access-Control-Allow-Origin: *");
    assert(preflight.headers.get("access-control-allow-methods")?.includes("POST"), "OPTIONS allows POST");

    // 2. Favicon
    console.log("\n[2] Testing Favicon");
    const favicon = await request("/favicon.ico");
    assert(favicon.status === 200, "Favicon returns 200 OK");
    assert(favicon.headers.get("content-type")?.includes("image/svg+xml"), "Favicon returns SVG content type");

    // 3. Static assets
    console.log("\n[3] Testing Static File Serving");
    const index = await request("/");
    assert(index.status === 200, "Root returns 200 OK");
    assert(index.headers.get("access-control-allow-origin") === "*", "Static files have CORS header");
    assert(typeof index.body === "string" && index.body.includes("NextStep"), "Root serves HTML");

    // 4. Careers API
    console.log("\n[4] Testing Careers Endpoint");
    const careers = await request("/api/careers");
    assert(careers.status === 200, "Careers endpoint returns 200 OK");
    assert(Array.isArray(careers.body.careers) && careers.body.careers.length === 4, "Returns 4 career frameworks");

    // 5. Privacy Consent
    console.log("\n[5] Testing Privacy Consent");
    const consent = await request("/api/privacy/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    });
    assert(consent.status === 200, "Privacy consent accepted");
    assert(consent.body.privacy.consent.accepted === true, "State has consent recorded");

    // 6. Profile Creation
    console.log("\n[6] Testing Profile Creation");
    const profile = await request("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        course: "Computer Science",
        discipline: "Software Engineering",
        year: "3rd year",
        careerId: "software-developer",
        availableHours: 10,
      }),
    });
    assert(profile.status === 200, "Profile created successfully");
    assert(profile.body.profile.name === "Test Student", "Profile student name matches");
    assert(profile.body.recommendedAction !== null, "Profile creation returns recommended action immediately with 0 evidence");
    assert(profile.body.skillReport !== null, "Profile creation returns baseline skillReport immediately");
    assert(typeof profile.body.recommendedAction?.skill === "string", "Recommended action targets a concrete skill");

    // 7. Evidence with file (testing CRLF Windows line endings and without explicit content)
    console.log("\n[7] Testing Evidence Submission with Code Upload (< 1 MB)");
    const codeSnippet = "const express = require('express');\r\nconst app = express();\r\n// api endpoint\r\napp.get('/api', (req, res) => res.json({ status: 'ok' }));\r\n";
    const base64Code = Buffer.from(codeSnippet).toString("base64");
    const evidenceRes = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "REST API Service",
        type: "Project",
        description: "Built a REST API service using JavaScript, unit test, and postgres database.",
        link: "https://github.com/student/api-service",
        fileName: "server.js",
        fileData: base64Code,
      }),
    });
    assert(evidenceRes.status === 200, "Evidence submitted successfully with auto-extracted text");
    assert(evidenceRes.body.evidence.length === 1, "Evidence list has 1 item");
    const createdEvidence = evidenceRes.body.evidence[0];
    assert(createdEvidence.detectedKeywords.includes("api"), "Keywords detected from code & description");

    // 7b. Testing 1 MB - 10 MB file upload support (e.g. 2.5 MB file)
    console.log("\n[7b] Testing Document Upload Between 1 MB and 10 MB (2.5 MB)");
    const mediumFileContent = "A".repeat(2.5 * 1024 * 1024); // 2.5 MB of text
    const base64Medium = Buffer.from(mediumFileContent).toString("base64");
    const mediumUploadRes = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Large Architecture Spec",
        type: "System Architecture / Design",
        description: "System design specifications for distributed microservices.",
        fileName: "architecture.txt",
        fileData: base64Medium,
      }),
    });
    assert(mediumUploadRes.status === 200, "2.5 MB document uploads successfully");
    assert(mediumUploadRes.body.evidence.length === 2, "Second upload succeeded without page reload, now 2 items");

    // 7c. Testing Rejecting Files Exceeding 10 MB limit
    console.log("\n[7c] Testing Rejection of Document Exceeding 10 MB");
    const overLimitContent = "B".repeat(11 * 1024 * 1024); // 11 MB
    const base64OverLimit = Buffer.from(overLimitContent).toString("base64");
    const overLimitRes = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Giant File Over 10 MB",
        type: "Technical Report",
        fileName: "huge.txt",
        fileData: base64OverLimit,
      }),
    });
    assert(overLimitRes.status === 400 || overLimitRes.status === 413, "Files > 10 MB are rejected with clear error");

    // 7d. Testing Repeated Uploads: Uploading a 3rd document without overwriting
    console.log("\n[7d] Testing Repeated Separate Uploads");
    const doc3Snippet = "print('Machine learning data pipeline')\n";
    const doc3Res = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "ML Training Pipeline",
        type: "Research Paper",
        description: "Data analysis and machine learning scripts.",
        fileName: "train.py",
        fileData: Buffer.from(doc3Snippet).toString("base64"),
      }),
    });
    assert(doc3Res.status === 200, "Third upload succeeded independently");
    assert(doc3Res.body.evidence.length === 3, "Evidence count is now 3 with unique IDs");
    const ids = doc3Res.body.evidence.map((e) => e.id);
    const uniqueIds = new Set(ids);
    assert(uniqueIds.size === 3, "Each upload saved as separate database record with unique ID (no overwrites)");

    // 7e. Testing Portfolio: Accepts Links Only
    console.log("\n[7e] Testing Portfolio Option: Links Only");
    // Invalid: Portfolio with file attached must be rejected
    const portfolioWithFile = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My Portfolio",
        type: "Portfolio",
        link: "https://john-doe-portfolio.dev",
        fileName: "portfolio.pdf",
        fileData: Buffer.from("%PDF-mock").toString("base64"),
      }),
    });
    assert(portfolioWithFile.status === 400, "Portfolio with file attachment is rejected (links only)");

    // Invalid: Portfolio with invalid or missing URL must be rejected
    const portfolioBadUrl = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My Portfolio",
        type: "Portfolio",
        link: "not-a-valid-url",
      }),
    });
    assert(portfolioBadUrl.status === 400, "Portfolio with invalid URL is rejected");

    // Valid: Portfolio with valid HTTPS URL succeeds without file
    const portfolioGood = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Personal Engineering Portfolio",
        type: "Portfolio",
        link: "https://john-doe-portfolio.dev",
        description: "Public personal portfolio website showcasing full stack applications.",
      }),
    });
    assert(portfolioGood.status === 200, "Valid portfolio URL saved successfully without any file");
    assert(portfolioGood.body.evidence.some((e) => e.type === "Portfolio" && e.link === "https://john-doe-portfolio.dev"), "Portfolio item persisted in evidence list");

    // 7f. Testing Expanded Evidence Types
    console.log("\n[7f] Testing Expanded Evidence Categories");
    const hackathonRes = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "National Hackathon 1st Place",
        type: "Competition / Hackathon",
        description: "Won 1st place building real-time collaboration tool.",
        link: "https://devpost.com/software/hackathon-winner",
      }),
    });
    assert(hackathonRes.status === 200, "Competition / Hackathon evidence type accepted");

    const certRes = await request("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "AWS Certified Cloud Practitioner",
        type: "Certificate",
        description: "Cloud fundamentals and architecture certification.",
      }),
    });
    assert(certRes.status === 200, "Certificate evidence type accepted");

    // 8. File Download
    console.log("\n[8] Testing Evidence File Download");
    const download = await request(`/api/evidence/${createdEvidence.id}/file`);
    assert(download.status === 200, "File download returns 200 OK");
    assert(download.body.includes("express"), "Downloaded content matches original uploaded file");
    assert(download.headers.get("access-control-allow-origin") === "*", "File download has CORS headers");

    // 9. Analysis and Recommendations
    console.log("\n[9] Testing Skill Analysis & Next Action");
    assert(evidenceRes.body.skillReport !== null, "Skill report was generated");
    assert(evidenceRes.body.recommendedAction !== null, "Next Best Action was prioritized");
    console.log(`    Recommended action: "${evidenceRes.body.recommendedAction.title}"`);

    // 10. Complete Action
    console.log("\n[10] Testing Complete Action");
    const complete = await request("/api/complete-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reflection: "Learned how to set up GitHub Actions and write unit tests." }),
    });
    assert(complete.status === 200, "Action marked as completed");
    assert(complete.body.recommendedAction.completed === true, "Recommended action marked completed in state");

    // 11. Self Assessment
    console.log("\n[11] Testing Self-Assessment");
    const assessment = await request("/api/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skills: [
          { skill: "Programming fundamentals", level: 2, confidence: "high" },
        ],
      }),
    });
    assert(assessment.status === 200, "Self assessment saved");
    assert(assessment.body.assessment.length === 1, "Self assessment recorded in state");

    // 12. Data Export
    console.log("\n[12] Testing Data Export");
    const exportRes = await request("/api/privacy/export");
    assert(exportRes.status === 200, "Data export returns 200 OK");
    assert(exportRes.body.profile.name === "Test Student", "Exported JSON contains student profile");

    // 13. Evidence Deletion
    console.log("\n[13] Testing Evidence Deletion");
    const delEvidence = await request(`/api/evidence/${createdEvidence.id}`, { method: "DELETE" });
    assert(delEvidence.status === 200, "Evidence deleted");
    assert(!delEvidence.body.evidence.some((e) => e.id === createdEvidence.id), "Evidence removed from state");

    // 14. NextStep Student Authentication Suite
    console.log("\n[14] Testing NextStep Student Authentication Suite");
    // Register
    const regRes = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Arjun Student",
        badgeId: "ST-2026-001",
        email: "arjun.student@university.edu",
        mobile: "+91 98765 43210",
        role: "Software Developer",
        password: "SecretPassword123!",
      }),
    });
    assert(regRes.status === 201, "Auth Register returns 201 Created");
    assert(regRes.body.user.email === "arjun.student@university.edu", "User email registered");
    assert(regRes.body.user.badgeId === "ST-2026-001", "User badgeId recorded");

    // Me
    const meRes = await request("/api/auth/me");
    assert(meRes.status === 200 && meRes.body.user.name === "Arjun Student", "GET /api/auth/me returns active session");

    // Logout
    const logoutRes = await request("/api/auth/logout", { method: "POST" });
    assert(logoutRes.status === 200, "POST /api/auth/logout succeeds");
    const meAfterLogout = await request("/api/auth/me");
    assert(meAfterLogout.body.user === null, "Session cleared after logout");

    // Invalid Login
    const badLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "arjun.student@university.edu", password: "wrongpassword" }),
    });
    assert(badLogin.status === 401, "Invalid password returns 401 Unauthorized");

    // Valid Login (Device A)
    const goodLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "arjun.student@university.edu", password: "SecretPassword123!" }),
    });
    assert(goodLogin.status === 200, "Valid login returns 200 OK");
    assert(goodLogin.body.user.name === "Arjun Student", "Logged in user matches");

    // Multi-Device / Device B Simulation: A new device/visitor without auth token
    const deviceBRes = await fetch(`${BASE_URL}/api/auth/me`);
    const deviceBMe = await deviceBRes.json();
    assert(deviceBMe.user === null, "Device B without token receives user: null (no cross-device leak)");

    const deviceBStateRes = await fetch(`${BASE_URL}/api/state`);
    const deviceBState = await deviceBStateRes.json();
    assert(deviceBState.currentUser === null, "Device B state has currentUser: null");
    assert(deviceBState.profile === null, "Device B state does NOT show Device A profile");

    // Guest Auth
    const guestRes = await request("/api/auth/guest", { method: "POST" });
    assert(guestRes.status === 200 && guestRes.body.user.name === "Guest Student", "Guest access granted");

    // 15. Account Deletion (Withdraw Consent)
    console.log("\n[15] Testing Account Deletion (Withdraw Consent)");
    const delAccount = await request("/api/privacy/account", { method: "DELETE" });
    assert(delAccount.status === 200 && delAccount.body.deleted === true, "Account deleted");

    const finalState = await request("/api/state");
    assert(finalState.status === 200 && finalState.body.profile === null, "State reset to empty after deletion");

    // 16. Health & Database Status
    console.log("\n[16] Testing Health & Database Status");
    const health = await request("/api/health");
    assert(health.status === 200 && health.body.status === "ok", "Health endpoint returns 200 OK");
    assert(Boolean(health.body.database), "Database status reported in health check");

  } finally {
    serverProc.kill();
  }

  console.log("\n=================================");
  console.log(`TEST SUMMARY: ${passed.length} passed, ${failed.length} failed`);
  console.log("=================================\n");

  if (failed.length > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test run error:", err);
  process.exit(1);
});
