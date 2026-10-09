const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const { PORT, HOST, PUBLIC_DIR, MONGODB_DB_NAME } = require("./src/config/environment");
const { getMongoDb, readState, writeState, sanitizeState, emptyState } = require("./src/config/database");
const { handleCors } = require("./src/middleware/corsMiddleware");
const { getUserFromRequest } = require("./src/middleware/authMiddleware");
const { sendJson, readBody } = require("./src/utils/apiResponse");

// Modular Controllers
const authController = require("./src/modules/auth/auth.controller");
const careersController = require("./src/modules/careers/careers.controller");
const profileController = require("./src/modules/profile/profile.controller");
const evidenceController = require("./src/modules/evidence/evidence.controller");
const privacyController = require("./src/modules/privacy/privacy.controller");

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

const server = http.createServer(async (request, response) => {
  try {
    // 1. CORS Preflight
    if (handleCors(request, response)) {
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const { pathname } = url;

    // 2. Favicon
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

    // 3. Health & Database check
    if (pathname === "/api/health" && request.method === "GET") {
      const db = await getMongoDb();
      sendJson(response, 200, {
        status: "ok",
        database: {
          type: db ? "mongodb" : "local-file",
          connected: Boolean(db),
          databaseName: db ? MONGODB_DB_NAME : null,
        },
        maxUploadBytes: 10 * 1024 * 1024,
        uptime: process.uptime(),
      });
      return;
    }

    // 4. Careers framework list
    if (pathname === "/api/careers" && request.method === "GET") {
      careersController.getCareers(request, response);
      return;
    }

    // 5. Authentication Endpoints
    if (pathname === "/api/auth/me" && request.method === "GET") {
      const state = await readState();
      await authController.getMe(request, response, state);
      return;
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readBody(request);
      const state = await readState();
      await authController.login(request, response, body, state);
      return;
    }

    if (pathname === "/api/auth/register" && request.method === "POST") {
      const body = await readBody(request);
      const state = await readState();
      await authController.register(request, response, body, state);
      return;
    }

    if (pathname === "/api/auth/guest" && request.method === "POST") {
      const state = await readState();
      await authController.guest(request, response, state);
      return;
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const state = await readState();
      await authController.logout(request, response, state);
      return;
    }

    if (pathname === "/api/auth/send-otp" && request.method === "POST") {
      authController.sendOtp(request, response);
      return;
    }

    // 6. Privacy Endpoints
    if (pathname === "/api/privacy" && request.method === "GET") {
      const state = await readState();
      await privacyController.getPrivacy(request, response, state);
      return;
    }

    if (pathname === "/api/privacy/export" && request.method === "GET") {
      const state = await readState();
      await privacyController.exportData(request, response, state);
      return;
    }

    if (pathname === "/api/privacy/consent" && request.method === "POST") {
      const body = await readBody(request);
      const state = await readState();
      await privacyController.saveConsent(request, response, body, state);
      return;
    }

    if (pathname === "/api/privacy/account" && request.method === "DELETE") {
      const state = await readState();
      await privacyController.deleteAccount(request, response, state);
      return;
    }

    // 7. Workspace State Endpoint
    if (pathname === "/api/state" && request.method === "GET") {
      const state = await readState();
      const user = getUserFromRequest(request, state);
      if (user) {
        state.userWorkspaces = state.userWorkspaces || {};
        const ws = state.userWorkspaces[user.id] || emptyState();
        sendJson(response, 200, sanitizeState({
          ...state,
          ...ws,
          currentUser: user,
        }));
      } else {
        const guestWs = state.guestWorkspace || emptyState();
        // Multi-device isolation: unauthenticated visitors never see another device's logged-in session
        sendJson(response, 200, sanitizeState({
          ...state,
          privacy: state.privacy || guestWs.privacy || { consent: null },
          currentUser: null,
          profile: null,
          evidence: [],
          assessment: [],
          skillReport: null,
          recommendedAction: null,
          activity: [],
        }));
      }
      return;
    }

    // 8. Evidence Item Deletion & File Download
    const deleteMatch = pathname.match(/^\/api\/evidence\/([0-9a-f-]{36})$/);
    if (deleteMatch && request.method === "DELETE") {
      const state = await readState();
      await evidenceController.deleteEvidence(request, response, deleteMatch[1], state);
      return;
    }

    const fileMatch = pathname.match(/^\/api\/evidence\/([0-9a-f-]{36})\/file$/);
    if (fileMatch && request.method === "GET") {
      const state = await readState();
      await evidenceController.downloadEvidenceFile(request, response, fileMatch[1], state);
      return;
    }

    // 9. Mutating POST/PUT API Endpoints
    if (pathname.startsWith("/api/")) {
      if (request.method !== "POST" && request.method !== "PUT") {
        sendJson(response, 405, { error: "Use POST or PUT for this endpoint." });
        return;
      }

      const body = await readBody(request);
      const state = await readState();

      if (pathname === "/api/profile") {
        await profileController.handleProfile(request, response, body, state);
        return;
      }

      if (pathname === "/api/evidence") {
        await evidenceController.createEvidence(request, response, body, state);
        return;
      }

      if (pathname === "/api/assessment") {
        await profileController.handleAssessment(request, response, body, state);
        return;
      }

      if (pathname === "/api/analyze") {
        await profileController.handleAnalyze(request, response, state);
        return;
      }

      if (pathname === "/api/complete-action") {
        await profileController.handleCompleteAction(request, response, body, state);
        return;
      }

      sendJson(response, 404, { error: "API endpoint not found." });
      return;
    }

    // 10. Static files serving
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
