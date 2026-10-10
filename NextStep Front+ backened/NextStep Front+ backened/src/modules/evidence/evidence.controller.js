const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { UPLOADS_DIR, MAX_FILE_BYTES } = require("../../config/environment");
const { validateEvidence } = require("./evidence.validation");
const { careers, containsKeyword } = require("../careers/careers.data");
const { analyze } = require("../analysis/analysis.service");
const { addActivity, writeState, sanitizeState, deleteEvidenceFile } = require("../../config/database");
const { getActiveWorkspace, requireConsent } = require("../../middleware/authMiddleware");
const { sendJson } = require("../../utils/apiResponse");

async function createEvidence(request, response, body, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  requireConsent(workspace);

  const error = validateEvidence(body);
  if (error) {
    sendJson(response, 400, { error });
    return;
  }

  let fileText = "";
  let fileBuffer = null;
  let fileSize = 0;

  if (body.fileData) {
    fileBuffer = Buffer.from(body.fileData, "base64");
    fileSize = fileBuffer.length;
    if (!fileSize || fileSize > MAX_FILE_BYTES) {
      sendJson(response, 400, { error: "The attached file is empty or exceeds the 10 MB limit." });
      return;
    }
    const ext = path.extname(body.fileName || "").toLowerCase();
    if (ext !== ".pdf") {
      fileText = fileBuffer.toString("utf8").replace(/^\uFEFF/, "").slice(0, 20000);
    }
  }

  const evidence = {
    id: crypto.randomUUID(),
    userId: user ? user.id : "guest",
    title: body.title.trim(),
    type: body.type.trim(),
    description: (body.description || "").trim(),
    link: body.link ? body.link.trim() : "",
    analysisText: (body.content || fileText || "").trim(),
    fileName: typeof body.fileName === "string" ? body.fileName.trim() : "",
    fileSize: fileSize,
    fileType: body.fileName ? path.extname(body.fileName).toLowerCase() : "",
    fileStored: Boolean(fileBuffer),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const evidenceText = `${evidence.title} ${evidence.type} ${evidence.description} ${evidence.analysisText}`.toLowerCase();
  evidence.detectedKeywords = [...new Set(Object.values(careers).flatMap((career) =>
    career.skills.flatMap((skill) => skill.keywords)
      .filter((keyword) => containsKeyword(evidenceText, keyword.toLowerCase()))
      .map((keyword) => keyword.toLowerCase()),
  ))];

  if (fileBuffer) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, `${evidence.id}.upload`), fileBuffer, { flag: "wx" });
  }

  workspace.evidence = workspace.evidence || [];
  workspace.evidence.unshift(evidence);
  addActivity(workspace, `Evidence added: ${evidence.title}.`);

  if (workspace.profile) {
    analyze(workspace);
  }
  evidence.analysisText = "";

  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function deleteEvidence(request, response, evidenceId, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  requireConsent(workspace);

  const index = (workspace.evidence || []).findIndex((item) => item.id === evidenceId);
  if (index === -1) {
    sendJson(response, 404, { error: "That evidence was not found." });
    return;
  }

  const [deleted] = workspace.evidence.splice(index, 1);
  if (deleted.fileStored) {
    await deleteEvidenceFile(deleted.id);
  }

  workspace.skillReport = null;
  workspace.recommendedAction = null;
  workspace.changeLog = (workspace.changeLog || []).filter((entry) => !entry.evidenceIds.includes(deleted.id));
  workspace.activity = (workspace.activity || []).filter((item) => item.message !== `Evidence added: ${deleted.title}.`);
  addActivity(workspace, `Evidence deleted: ${deleted.title}. Refresh your skill map to recalculate recommendations.`);

  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function downloadEvidenceFile(request, response, evidenceId, state) {
  const { workspace } = getActiveWorkspace(request, state);
  const item = (workspace.evidence || []).find((evidence) => evidence.id === evidenceId && evidence.fileStored);

  if (!item) {
    sendJson(response, 404, { error: "That evidence file was not found." });
    return;
  }

  try {
    const content = await fs.readFile(path.join(UPLOADS_DIR, `${item.id}.upload`));
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
}

module.exports = {
  createEvidence,
  deleteEvidence,
  downloadEvidenceFile,
};
