const crypto = require("node:crypto");
const bcrypt = require('bcrypt');
const { emptyState, emptyUserState, sanitizeState, writeState, addActivity } = require("../../config/database");
const { getUserFromRequest, getSessionToken } = require("../../middleware/authMiddleware");
const { sendJson } = require("../../utils/apiResponse");
const { triggerAIAnalysis } = require("../analysis/analysis.service");

async function getMe(request, response, state) {
  const user = getUserFromRequest(request, state);
  sendJson(response, 200, { user: user || null });
}

function normalizeMobile(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function checkExistingUser(users, { email, mobile, username }) {
  if (!Array.isArray(users) || users.length === 0) return null;

  const cleanEmail = email ? String(email).trim().toLowerCase() : "";
  const cleanMobile = mobile ? normalizeMobile(mobile) : "";
  const cleanUsername = username ? String(username).trim().toLowerCase() : "";

  const emailMatch = cleanEmail ? users.find((u) => u.email && u.email.toLowerCase() === cleanEmail) : null;
  const mobileMatch = cleanMobile && cleanMobile.length >= 7 ? users.find((u) => u.mobile && normalizeMobile(u.mobile) === cleanMobile) : null;
  const usernameMatch = cleanUsername ? users.find((u) => u.username && u.username.toLowerCase() === cleanUsername) : null;

  if (emailMatch && mobileMatch) {
    return "Already registered mobile no and gmail. Please sign in with your credentials.";
  }
  if (emailMatch) {
    return "This Gmail / Email is already registered. Please sign in or use another email.";
  }
  if (mobileMatch) {
    return "This Mobile number is already registered. Please sign in or use another mobile number.";
  }
  if (usernameMatch) {
    return "This Username is already registered. Please choose a different username.";
  }
  return null;
}

function findUserByIdentifier(users, identifier) {
  if (!identifier || !Array.isArray(users)) return null;
  const cleanId = String(identifier).trim();
  const lowerId = cleanId.toLowerCase();
  const normalizedPhone = normalizeMobile(cleanId);

  return users.find((u) => {
    // 1. Match Gmail / Email (case-insensitive)
    if (u.email && u.email.toLowerCase() === lowerId) return true;

    // 2. Match Username (case-insensitive)
    if (u.username && u.username.toLowerCase() === lowerId) return true;

    // 3. Match Mobile number (normalized last 10 digits or exact string)
    if (u.mobile) {
      if (u.mobile.trim() === cleanId) return true;
      if (normalizedPhone.length >= 7 && normalizeMobile(u.mobile) === normalizedPhone) return true;
    }

    // 4. Match Badge / Roll No. (case-insensitive)
    if (u.badgeId && u.badgeId.toLowerCase() === lowerId) return true;

    // 5. Match Full Name (case-insensitive)
    if (u.name && u.name.toLowerCase() === lowerId) return true;

    return false;
  });
}

async function login(request, response, body, state) {
  const identifier = String(body.identifier || body.email || body.username || body.mobile || "").trim();
  if (!identifier || !body.password) {
    sendJson(response, 400, { error: "Enter your username, gmail or mobile number and password." });
    return;
  }
  const user = findUserByIdentifier(state.users || [], identifier);
  if (!user) {
    sendJson(response, 401, { error: "No account found matching this username, gmail or mobile number." });
    return;
  }
  const passwordMatch = await bcrypt.compare(String(body.password), user.passwordHash);
  if (!passwordMatch) {
    sendJson(response, 401, { error: "Incorrect password. Please verify your credentials." });
    return;
  }
  const safeUser = {
    id: user.id,
    name: user.name,
    username: user.username || user.email.split("@")[0],
    badgeId: user.badgeId,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    lastLoginAt: new Date().toISOString(),
  };

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: user.id, createdAt: new Date().toISOString(), expiresAt };

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

  const existingError = checkExistingUser(state.users, {
    email: body.email,
    mobile: body.mobile,
    username: body.username,
  });
  if (existingError) {
    sendJson(response, 409, { error: existingError });
    return;
  }

  const cleanEmail = String(body.email).trim().toLowerCase();
  const cleanMobile = String(body.mobile || "").trim();
  const cleanName = String(body.name).trim();
  const cleanUsername = String(body.username || cleanEmail.split("@")[0] || cleanName.toLowerCase().replace(/\s+/g, "")).trim();
  const year = new Date().getFullYear();
  const badgeId = (body.badgeId && String(body.badgeId).trim()) || `ST-${year}-${Math.floor(100 + Math.random() * 900)}`;

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(body.password, saltRounds);

  const newUser = {
    id: crypto.randomUUID(),
    name: cleanName,
    username: cleanUsername,
    badgeId,
    email: cleanEmail,
    mobile: cleanMobile,
    role: String(body.role || "Software Developer").trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  state.users.push(newUser);

  const safeUser = {
    id: newUser.id,
    name: newUser.name,
    username: newUser.username,
    badgeId: newUser.badgeId,
    email: newUser.email,
    mobile: newUser.mobile,
    role: newUser.role,
  };

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000).toISOString(); // 30 days
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: newUser.id, createdAt: new Date().toISOString(), expiresAt };

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

function sendOtp(request, response, body, state) {
  if (body) {
    const existingError = checkExistingUser(state?.users || [], {
      email: body.email,
      mobile: body.mobile,
      username: body.username,
    });
    if (existingError) {
      sendJson(response, 409, { error: existingError });
      return;
    }
  }

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
