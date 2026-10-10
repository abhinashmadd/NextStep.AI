const { validateProfile } = require("./profile.validation");
const { careers } = require("../careers/careers.data");
const { analyze } = require("../analysis/analysis.service");
const { addActivity, writeState, sanitizeState } = require("../../config/database");
const { getActiveWorkspace, requireConsent } = require("../../middleware/authMiddleware");
const { sendJson } = require("../../utils/apiResponse");

async function handleProfile(request, response, body, state) {
  const { user, workspace } = getActiveWorkspace(request, state);

  if (!workspace.privacy?.consent?.accepted) {
    workspace.privacy = {
      ...(workspace.privacy || {}),
      consent: {
        accepted: true,
        version: "1.0",
        acceptedAt: new Date().toISOString(),
        purpose: "Personalized evidence-to-action career guidance",
      },
    };
    addActivity(workspace, "Privacy notice accepted during profile setup.");
  }

  const error = validateProfile(body);
  if (error) {
    sendJson(response, 400, { error });
    return;
  }

  const previousCareerId = workspace.profile?.careerId;
  const sanitizeString = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  workspace.profile = {
    name: sanitizeString(body.name),
    course: sanitizeString(body.course),
    year: sanitizeString(body.year),
    discipline: (body.discipline || "General Studies").trim(),
    semester: typeof body.semester === "string" ? body.semester.trim() : "",
    careerId: body.careerId,
    targetRole: careers[body.careerId].name,
    availableHours: body.availableHours ? Number(body.availableHours) : null,
    learningStyle: typeof body.learningStyle === "string" ? body.learningStyle.slice(0, 40) : "",
    skills: Array.isArray(body.skills)
      ? body.skills.filter((skill) => typeof skill === "string").map((skill) => sanitizeString(skill).slice(0, 60)).filter(Boolean).slice(0, 20)
      : [],
    interests: typeof body.interests === "string" ? sanitizeString(body.interests).trim().slice(0, 500) : "",
    bio: typeof body.bio === "string" ? sanitizeString(body.bio).trim() : "",
    updatedAt: new Date().toISOString(),
  };

  if (previousCareerId && previousCareerId !== workspace.profile.careerId) {
    workspace.assessment = [];
    workspace.skillReport = null;
    workspace.recommendedAction = null;
    workspace.changeLog = [];
  }

  addActivity(workspace, `Student profile ${workspace.activity?.some((item) => item.message.includes("profile")) ? "updated" : "created"} for ${workspace.profile.targetRole}.`);
  analyze(workspace);

  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function handleAssessment(request, response, body, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  requireConsent(workspace);

  if (!workspace.profile) {
    sendJson(response, 400, { error: "Create your student profile and choose a career before self-assessment." });
    return;
  }
  if (!Array.isArray(body.skills) || body.skills.length > 30) {
    sendJson(response, 400, { error: "Submit up to 30 skill assessments." });
    return;
  }

  const framework = careers[workspace.profile.careerId].skills;
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

  workspace.assessment = assessment;
  addActivity(workspace, "Self-assessment updated. Claims remain separate from evidence.");
  analyze(workspace);

  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function handleCompleteAction(request, response, body, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  if (!workspace.recommendedAction) {
    sendJson(response, 400, { error: "Analyze your evidence to get a next action first." });
    return;
  }
  if (typeof body.reflection !== "string" || body.reflection.trim().length < 3 || body.reflection.length > 1000) {
    sendJson(response, 400, { error: "Add a short reflection (3–1,000 characters) before completing this action." });
    return;
  }
  workspace.recommendedAction.completed = true;
  workspace.recommendedAction.reflection = body.reflection.trim();
  workspace.recommendedAction.completedAt = new Date().toISOString();
  addActivity(workspace, `Completed: ${workspace.recommendedAction.title}. Add your new work as evidence to refresh your next action.`);

  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

async function handleAnalyze(request, response, state) {
  const { user, workspace } = getActiveWorkspace(request, state);
  analyze(workspace);
  await writeState(state);
  sendJson(response, 200, sanitizeState({ ...state, ...workspace, currentUser: user }));
}

module.exports = {
  handleProfile,
  handleAssessment,
  handleCompleteAction,
  handleAnalyze,
};
