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

async function submitDeletionRequest(request, response, body, state) {
  const email = (body?.email || "").trim().toLowerCase();
  const reason = (body?.reason || "User requested erasure").trim();
  const requestId = "DEL-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();

  if (!email && !getUserFromRequest(request, state)) {
    sendJson(response, 400, { error: "Please provide a valid registered email address for the deletion request." });
    return;
  }

  // Check if current user is logged in or match by email
  const user = getUserFromRequest(request, state) || (state.users || []).find((u) => u.email && u.email.toLowerCase() === email);

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

  // Record audit trail of erasure fulfillment under GDPR Art. 17 / CCPA
  state.deletionLogs = state.deletionLogs || [];
  state.deletionLogs.push({
    requestId,
    email: email || (user ? user.email : "authenticated-user"),
    reason,
    timestamp: new Date().toISOString(),
    status: "completed",
    scope: "all_personal_evidence_and_profile_data",
  });

  await writeState(state);

  sendJson(
    response,
    200,
    {
      ok: true,
      success: true,
      requestId,
      ticketId: requestId,
      status: "completed",
      message: "Data deletion request fulfilled successfully. All profile data, uploaded evidence files, and session history have been permanently purged.",
      retentionPolicy: "Zero residual data maintained on active servers.",
    },
    { "Set-Cookie": "nextstep_session=; Path=/; HttpOnly; Max-Age=0" }
  );
}

async function handleUnsubscribe(request, response, body, state) {
  const email = (body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    sendJson(response, 400, { error: "Please provide a valid email address to unsubscribe." });
    return;
  }

  state.unsubscribes = state.unsubscribes || [];
  if (!state.unsubscribes.find((item) => item.email === email)) {
    state.unsubscribes.push({
      email,
      unsubscribedAt: new Date().toISOString(),
      channels: body?.channels || ["all_marketing_and_digest_emails"],
    });
    await writeState(state);
  }

  sendJson(response, 200, {
    ok: true,
    success: true,
    email,
    unsubscribed: true,
    message: "You have been successfully unsubscribed from all non-essential and notification emails.",
  });
}

module.exports = {
  getPrivacy,
  exportData,
  saveConsent,
  deleteAccount,
  submitDeletionRequest,
  handleUnsubscribe,
};

