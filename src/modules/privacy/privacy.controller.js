const { getActiveWorkspace, getUserFromRequest, getSessionToken } = require("../../middleware/authMiddleware");
const { addActivity, writeState, sanitizeState, deleteAllStoredData, deleteEvidenceFile, emptyUserState } = require("../../config/database");
const { sendJson } = require("../../utils/apiResponse");

async function getPrivacy(request, response, state) {
  const { workspace } = getActiveWorkspace(request, state);
  sendJson(response, 200, {
    ...(workspace.privacy || {}),
    consent: workspace.privacy?.consent || null,
    storedEvidence: (workspace.evidence || []).length,
    storedFiles: (workspace.evidence || []).filter((item) => item.fileStored).length,
    lastActivityAt: workspace.activity?.[0]?.createdAt || null,
    analysisMethod: "Local deterministic keyword matching. No AI provider receives your data.",
  });
}

async function exportData(request, response, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": 'attachment; filename="nextstep-data-export.json"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify({ ...emptyUserState(), ...workspace, currentUser: user }, null, 2));
}

async function saveConsent(request, response, body, state) {
  if (body?.accepted !== true) {
    sendJson(response, 400, { error: "Consent must be explicitly accepted before continuing." });
    return;
  }
  const { user, workspace } = getActiveWorkspace(request, state);
  const consentRecord = {
    accepted: true,
    version: "1.0",
    acceptedAt: new Date().toISOString(),
    purpose: "Personalized evidence-to-action career guidance",
  };
  workspace.privacy = {
    ...(workspace.privacy || {}),
    consent: consentRecord,
  };
  state.privacy = {
    ...(state.privacy || {}),
    consent: consentRecord,
  };
  addActivity(workspace, "Privacy notice reviewed and consent recorded.");
  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function deleteAccount(request, response, state) {
  const user = getUserFromRequest(request, state);
  if (user) {
    state.userWorkspaces = state.userWorkspaces || {};
    const ws = state.userWorkspaces[user.id];
    if (ws?.evidence) {
      for (const ev of ws.evidence) {
        if (ev.fileStored) await deleteEvidenceFile(ev.id);
      }
    }
    delete state.userWorkspaces[user.id];
    state.users = (state.users || []).filter((u) => u.id !== user.id);
    const token = getSessionToken(request);
    if (token && state.sessions) delete state.sessions[token];
  }
  await deleteAllStoredData();
  sendJson(response, 200, { deleted: true }, { "Set-Cookie": "nextstep_session=; Path=/; HttpOnly; Max-Age=0" });
}

module.exports = {
  getPrivacy,
  exportData,
  saveConsent,
  deleteAccount,
};
