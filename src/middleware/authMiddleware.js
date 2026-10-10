const { emptyUserState } = require("../config/database");

function getSessionToken(request) {
  const authHeader = request.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (request.headers["x-session-token"]) {
    return String(request.headers["x-session-token"]).trim();
  }
  const cookieHeader = request.headers["cookie"] || "";
  const match = cookieHeader.match(/(?:^|;\s*)nextstep_session=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

function getUserFromRequest(request, state) {
  const token = getSessionToken(request);
  if (!token || !state.sessions || !state.sessions[token]) {
    return null;
  }
  const session = state.sessions[token];
  // Reject expired sessions
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    // Optionally clean up expired session
    delete state.sessions[token];
    return null;
  }
  const user = (state.users || []).find((u) => u.id === session.userId);
  if (!user) {
    return null;
  }
  const { passwordHash, salt, ...safeUser } = user;
  return safeUser;
}

function getActiveWorkspace(request, state) {
  const user = getUserFromRequest(request, state);
  state.userWorkspaces = state.userWorkspaces || {};
  if (user) {
    if (!state.userWorkspaces[user.id]) {
      state.userWorkspaces[user.id] = {
        ...emptyUserState(),
        currentUser: user,
      };
      if (user.role) {
        const roleMap = {
          "Software Developer": { careerId: "software-developer", course: "Computer Science & Engineering", discipline: "Technology" },
          "Embedded Systems Engineer": { careerId: "embedded-systems", course: "Electronics & Electrical Engineering", discipline: "Engineering" },
          "Financial Analyst": { careerId: "financial-analyst", course: "Finance & Economics", discipline: "Business" },
          "UX Researcher": { careerId: "ux-researcher", course: "Design & Human-Computer Interaction", discipline: "Arts & Design" },
        };
        const mapped = roleMap[user.role] || { careerId: "software-developer", course: "Undergraduate Studies", discipline: "Technology" };
        state.userWorkspaces[user.id].profile = {
          name: user.name,
          course: mapped.course,
          discipline: mapped.discipline,
          year: "3rd Year",
          semester: "5",
          careerId: mapped.careerId,
          targetRole: user.role,
          availableHours: 10,
          learningStyle: "Hands-on projects",
          skills: [],
          interests: `${user.role} career preparation`,
          bio: `Student ID: ${user.badgeId} · Verified student account`,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    return { user, workspace: state.userWorkspaces[user.id] };
  }
  state.guestWorkspace = state.guestWorkspace || emptyUserState();
  return { user: null, workspace: state.guestWorkspace };
}

function requireConsent(state) {
  if (!state.privacy?.consent?.accepted) {
    const error = new Error("Review and accept the privacy notice before adding personal information or evidence.");
    error.status = 403;
    throw error;
  }
}

module.exports = {
  getSessionToken,
  getUserFromRequest,
  getActiveWorkspace,
  requireConsent,
  requireAdmin,
};

// Helper to ensure the current user has admin privileges
function requireAdmin(request, state) {
  const user = getUserFromRequest(request, state);
  if (!user || user.role !== 'admin') {
    const err = new Error('Admin privileges required.');
    err.status = 403;
    throw err;
  }
  return true;
}
