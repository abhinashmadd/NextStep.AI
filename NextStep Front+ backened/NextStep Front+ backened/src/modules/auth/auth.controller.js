const crypto = require("node:crypto");
const { emptyState, emptyUserState, sanitizeState, writeState, addActivity } = require("../../config/database");
const { getUserFromRequest, getSessionToken } = require("../../middleware/authMiddleware");
const { sendJson } = require("../../utils/apiResponse");
const { triggerAIAnalysis } = require("../analysis/analysis.service");

async function getMe(request, response, state) {
  const user = getUserFromRequest(request, state);
  sendJson(response, 200, { user: user || null });
}

async function login(request, response, body, state) {
  if (!body.email || !body.password) {
    sendJson(response, 400, { error: "Enter both your email and password." });
    return;
  }
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

  const token = crypto.randomBytes(32).toString("hex");
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };

  state.userWorkspaces = state.userWorkspaces || {};
  const ws = state.userWorkspaces[user.id] || emptyUserState();
  ws.currentUser = safeUser;
  addActivity(ws, `Signed in as ${user.name} (${user.badgeId}).`);
  state.userWorkspaces[user.id] = ws;

  await writeState(state);
  sendJson(
    response,
    200,
    {
      success: true,
      token,
      user: safeUser,
      state: sanitizeState({ ...state, ...ws, currentUser: safeUser }),
    },
    {
      "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    }
  );
}

async function register(request, response, body, state) {
  if (!body.name || !body.email || !body.password) {
    sendJson(response, 400, { error: "Name, email, and password are required." });
    return;
  }
  if (String(body.password).length < 6) {
    sendJson(response, 400, { error: "Password must be at least 6 characters." });
    return;
  }
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

  const token = crypto.randomBytes(32).toString("hex");
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: newUser.id, createdAt: new Date().toISOString() };

  const roleMap = {
    "Software Developer": { careerId: "software-developer", course: "Computer Science & Engineering", discipline: "Technology" },
    "Embedded Systems Engineer": { careerId: "embedded-systems", course: "Electronics & Electrical Engineering", discipline: "Engineering" },
    "Financial Analyst": { careerId: "financial-analyst", course: "Finance & Economics", discipline: "Business" },
    "UX Researcher": { careerId: "ux-researcher", course: "Design & Human-Computer Interaction", discipline: "Arts & Design" },
  };
  const mapped = roleMap[newUser.role] || { careerId: "software-developer", course: "Undergraduate Studies", discipline: "Technology" };

  state.userWorkspaces = state.userWorkspaces || {};
  const ws = {
    ...emptyUserState(),
    currentUser: safeUser,
    profile: {
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
    },
    privacy: {
      consent: {
        accepted: true,
        version: "1.0",
        acceptedAt: new Date().toISOString(),
        purpose: "Student registration and workspace access",
      },
    },
  };
  addActivity(ws, `Account registered for ${newUser.name} (${newUser.badgeId}).`);
  state.userWorkspaces[newUser.id] = ws;

  try { await triggerAIAnalysis(ws); } catch {}
  await writeState(state);

  sendJson(
    response,
    201,
    {
      success: true,
      token,
      user: safeUser,
      state: sanitizeState({ ...state, ...ws, currentUser: safeUser }),
    },
    {
      "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    }
  );
}

async function guest(request, response, state) {
  const guestUser = {
    id: "guest-" + crypto.randomUUID().slice(0, 8),
    name: "Guest Student",
    badgeId: "ST-GUEST-01",
    email: "guest.student@nextstep.edu",
    mobile: "+91 98765 43210",
    role: "Software Developer",
    isGuest: true,
  };

  const token = crypto.randomBytes(32).toString("hex");
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: guestUser.id, createdAt: new Date().toISOString() };

  state.userWorkspaces = state.userWorkspaces || {};
  const ws = {
    ...emptyUserState(),
    currentUser: guestUser,
    profile: {
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
    },
    privacy: {
      consent: {
        accepted: true,
        version: "1.0",
        acceptedAt: new Date().toISOString(),
        purpose: "Guest student exploration and workspace access",
      },
    },
  };
  addActivity(ws, "Accessed workspace as Guest Student.");
  state.userWorkspaces[guestUser.id] = ws;

  try { await triggerAIAnalysis(ws); } catch {}
  await writeState(state);

  sendJson(
    response,
    200,
    {
      success: true,
      token,
      user: guestUser,
      state: sanitizeState({ ...state, ...ws, currentUser: guestUser }),
    },
    {
      "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    }
  );
}

async function logout(request, response, state) {
  const token = getSessionToken(request);
  if (token && state.sessions) {
    delete state.sessions[token];
  }
  await writeState(state);
  sendJson(
    response,
    200,
    { success: true, state: sanitizeState(emptyState()) },
    {
      "Set-Cookie": "nextstep_session=; Path=/; HttpOnly; Max-Age=0",
    }
  );
}

function sendOtp(request, response) {
  sendJson(response, 200, {
    success: true,
    message: "One-Time Password (OTP) dispatched to Gmail and Mobile SMS.",
    demoOtp: "849201",
  });
}

module.exports = {
  getMe,
  login,
  register,
  guest,
  logout,
  sendOtp,
};
