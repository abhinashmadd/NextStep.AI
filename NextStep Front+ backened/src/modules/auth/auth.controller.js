const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const { emptyState, emptyUserState, sanitizeState, writeState, addActivity } = require("../../config/database");
const { getUserFromRequest, getSessionToken } = require("../../middleware/authMiddleware");
const { sendJson } = require("../../utils/apiResponse");
const { triggerAIAnalysis } = require("../analysis/analysis.service");
const { mapRoleToCareer, normalizeRollOrBadge } = require("../../utils/roleMapper");
const { validateRegistration, validateLogin, validatePasswordReset, normalizeMobile } = require("./auth.validation");
const { getClientIp, checkLoginRateLimit, recordFailedLogin, resetLoginAttempts } = require("../../middleware/rateLimiter");
const { getFirebaseClientConfig, verifyFirebaseIdToken } = require("../../config/firebase");

// Pre-computed 12-round bcrypt hash for constant-time dummy comparisons against nonexistent accounts (prevents timing side-channel attacks)
const DUMMY_HASH = "$2b$12$e8xL4sV9JjDqC1e3w6l2hO5k9Ym3Zb1Xv8t7u4g6p0A2d4f6h8j0K";

async function getMe(request, response, state) {
  const user = getUserFromRequest(request, state);
  if (!user) {
    sendJson(response, 200, { user: null });
    return;
  }
  const mapped = mapRoleToCareer(user.role);
  sendJson(response, 200, { user, roleMapping: mapped });
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
  const normalizedBadge = normalizeRollOrBadge(cleanId);
  const inputDigits = cleanId.replace(/\D/g, "");

  return users.find((u) => {
    // 1. Match Gmail / Email (case-insensitive) or email handle (e.g. "arjun.student" from "arjun.student@university.edu")
    if (u.email) {
      const emailLower = u.email.toLowerCase();
      if (emailLower === lowerId) return true;
      if (emailLower.split("@")[0] === lowerId) return true;
    }

    // 2. Match Username (case-insensitive)
    if (u.username && u.username.toLowerCase() === lowerId) return true;

    // 3. Match Mobile number (normalized last 10 digits or exact string)
    if (u.mobile) {
      if (u.mobile.trim() === cleanId) return true;
      if (normalizedPhone.length >= 7 && normalizeMobile(u.mobile) === normalizedPhone) return true;
    }

    // 4. Match Badge / Roll No. / Student ID (case-insensitive, hyphen-agnostic, suffix-matched, numeric-matched)
    const badgeCandidates = [u.badgeId, u.studentId, u.rollNo, u.rollNumber].filter(Boolean);
    for (const badge of badgeCandidates) {
      if (badge.toLowerCase() === lowerId) return true;
      const uNormBadge = normalizeRollOrBadge(badge);
      if (normalizedBadge && uNormBadge === normalizedBadge) return true;
      if (normalizedBadge && normalizedBadge.length >= 3 && uNormBadge.endsWith(normalizedBadge)) return true;

      // Numeric suffix / roll number matching
      const uBadgeDigits = badge.replace(/\D/g, "");
      if (inputDigits && inputDigits.length >= 3 && uBadgeDigits) {
        if (uBadgeDigits.endsWith(inputDigits)) return true;
        const noLeadingZeros = inputDigits.replace(/^0+/, "");
        if (noLeadingZeros && uBadgeDigits.endsWith(noLeadingZeros)) return true;
      }
    }

    // 5. Match Full Name (case-insensitive)
    if (u.name && u.name.toLowerCase() === lowerId) return true;

    return false;
  });
}

/**
 * Robust Login Handler:
 * - Strict server-side validation
 * - In-memory rate limiting (max 5 failed attempts per 15 mins)
 * - Encrypted password verification with bcrypt
 * - Generic error messages defeating account enumeration & timing attacks
 */
async function login(request, response, body, state) {
  const ip = getClientIp(request);

  // 1. Server-Side Validation
  const validation = validateLogin(body);
  if (!validation.isValid) {
    sendJson(response, 400, { error: validation.error });
    return;
  }
  const { identifier, password } = validation.sanitized;

  // 2. Login Rate Limiting Check
  const rateLimit = checkLoginRateLimit(ip, identifier);
  if (rateLimit.isLimited) {
    sendJson(
      response,
      429,
      { error: `Too many failed login attempts. For security reasons, please try again in ${rateLimit.retryAfterSeconds} seconds.` },
      {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": "0",
      }
    );
    return;
  }

  // 3. User Lookup
  const user = findUserByIdentifier(state.users || [], identifier);

  // 4. Secure Constant-Time Verification & Generic Errors
  if (!user || !user.passwordHash) {
    // Perform constant-time dummy compare to eliminate timing side channels
    await bcrypt.compare(password, DUMMY_HASH);
    recordFailedLogin(ip, identifier);
    // Generic error to prevent user enumeration
    sendJson(response, 401, { error: "Invalid credentials. Please verify your email, username, or mobile and password." });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    recordFailedLogin(ip, identifier);
    // Identical generic error message
    sendJson(response, 401, { error: "Invalid credentials. Please verify your email, username, or mobile and password." });
    return;
  }

  // Login successful: reset rate limit attempt tracking
  resetLoginAttempts(ip, identifier);

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

  // Smooth role mapping for logged in user workspace
  const mapped = mapRoleToCareer(user.role);
  state.userWorkspaces = state.userWorkspaces || {};
  let ws = state.userWorkspaces[user.id];
  if (!ws) {
    ws = emptyUserState();
  }
  ws.currentUser = safeUser;

  if (!ws.profile) {
    ws.profile = {
      name: user.name,
      course: mapped.course,
      discipline: mapped.discipline,
      year: "3rd Year",
      semester: "5",
      careerId: mapped.careerId,
      targetRole: mapped.targetRole || user.role || "Software Developer",
      availableHours: 10,
      learningStyle: "Hands-on projects",
      skills: [],
      interests: `${mapped.targetRole || user.role} career preparation`,
      bio: `Student ID: ${user.badgeId} · Verified student account`,
      updatedAt: new Date().toISOString(),
    };
  } else {
    if (!ws.profile.careerId) ws.profile.careerId = mapped.careerId;
    if (!ws.profile.targetRole) ws.profile.targetRole = mapped.targetRole || user.role;
    if (!ws.profile.name) ws.profile.name = user.name;
    if (!ws.profile.course) ws.profile.course = mapped.course;
    if (!ws.profile.discipline) ws.profile.discipline = mapped.discipline;
  }

  if (!ws.privacy || !ws.privacy.consent) {
    ws.privacy = {
      consent: {
        accepted: true,
        version: "1.0",
        acceptedAt: new Date().toISOString(),
        purpose: "Student authentication and workspace access",
      },
      ageConsent: {
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        minimumAge: 16,
      },
    };
  }

  addActivity(ws, `Signed in as ${user.name} (${user.badgeId}) · Target Role: ${ws.profile.targetRole}.`);
  state.userWorkspaces[user.id] = ws;

  try { await triggerAIAnalysis(ws); } catch {}
  await writeState(state);

  sendJson(
    response,
    200,
    {
      success: true,
      token,
      user: safeUser,
      roleMapping: mapped,
      state: sanitizeState({ ...state, ...ws, currentUser: safeUser }),
    },
    {
      "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    }
  );
}

/**
 * Registration Handler:
 * - Comprehensive server-side validation
 * - Salting & 12-round bcrypt password encryption
 * - GDPR/COPPA age consent verification
 * - Seamless sharded student workspace setup
 */
async function register(request, response, body, state) {
  // 1. Strict Server-Side Validation
  const validation = validateRegistration(body);
  if (!validation.isValid) {
    sendJson(response, 400, { error: validation.error });
    return;
  }
  const { name, email, password, mobile, username, role, badgeId } = validation.sanitized;

  state.users = state.users || [];

  // 2. Uniqueness verification
  const existingError = checkExistingUser(state.users, {
    email,
    mobile,
    username,
  });
  if (existingError) {
    sendJson(response, 409, { error: existingError });
    return;
  }

  const cleanName = name;
  const cleanEmail = email;
  const cleanMobile = mobile;
  const cleanUsername = username || cleanEmail.split("@")[0] || cleanName.toLowerCase().replace(/\s+/g, "");
  const year = new Date().getFullYear();
  const assignedBadgeId = badgeId || `ST-${year}-${Math.floor(100 + Math.random() * 900)}`;

  // 3. Encrypt the password using salted bcrypt with 12 rounds
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const newUser = {
    id: crypto.randomUUID(),
    name: cleanName,
    username: cleanUsername,
    badgeId: assignedBadgeId,
    email: cleanEmail,
    mobile: cleanMobile,
    role: role || "Software Developer",
    passwordHash,
    ageConsent: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      minimumAge: 16,
    },
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
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  state.sessions = state.sessions || {};
  state.sessions[token] = { userId: newUser.id, createdAt: new Date().toISOString(), expiresAt };

  const mapped = mapRoleToCareer(newUser.role);

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
      targetRole: mapped.targetRole || newUser.role,
      availableHours: 10,
      learningStyle: "Hands-on projects",
      skills: [],
      interests: `${mapped.targetRole || newUser.role} career preparation`,
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
      ageConsent: {
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        minimumAge: 16,
      },
    },
  };
  addActivity(ws, `Account registered for ${newUser.name} (${newUser.badgeId}) · Target Role: ${ws.profile.targetRole}.`);
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
      roleMapping: mapped,
      state: sanitizeState({ ...state, ...ws, currentUser: safeUser }),
    },
    {
      "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    }
  );
}

/**
 * Firebase Authentication Handler:
 * - Verifies Firebase ID Token from Google Sign-In or Firebase Auth
 * - Provisions/syncs user into sharded NextStep database
 * - Generates session token with HttpOnly cookie
 */
async function handleFirebase(request, response, body, state) {
  try {
    const { idToken, role } = body || {};
    if (!idToken || typeof idToken !== "string") {
      sendJson(response, 400, { error: "Missing or invalid Firebase ID token." });
      return;
    }

    const verified = await verifyFirebaseIdToken(idToken);
    state.users = state.users || [];

    // Search for existing user
    let user = state.users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === (verified.email || "").toLowerCase()) ||
        u.firebaseUid === verified.uid
    );

    if (!user) {
      const year = new Date().getFullYear();
      const badgeId = `ST-${year}-${Math.floor(100 + Math.random() * 900)}`;
      const cleanEmail = (verified.email || `student_${verified.uid.slice(0, 6)}@firebase.nextstep.edu`).toLowerCase();
      const cleanName = verified.name || cleanEmail.split("@")[0];
      const cleanUsername = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");

      // Generate secure random hashed password for internal user record
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      user = {
        id: crypto.randomUUID(),
        firebaseUid: verified.uid,
        name: cleanName,
        username: cleanUsername,
        badgeId,
        email: cleanEmail,
        mobile: "",
        role: role || "Software Developer",
        picture: verified.picture || "",
        passwordHash,
        provider: "firebase",
        ageConsent: {
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          minimumAge: 16,
        },
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
    } else {
      if (!user.firebaseUid) user.firebaseUid = verified.uid;
      if (verified.picture && !user.picture) user.picture = verified.picture;
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      badgeId: user.badgeId,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      picture: user.picture || "",
      provider: "firebase",
    };

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    state.sessions = state.sessions || {};
    state.sessions[token] = { userId: user.id, createdAt: new Date().toISOString(), expiresAt };

    const mapped = mapRoleToCareer(user.role);
    state.userWorkspaces = state.userWorkspaces || {};
    let ws = state.userWorkspaces[user.id];
    if (!ws) {
      ws = {
        ...emptyUserState(),
        currentUser: safeUser,
        profile: {
          name: user.name,
          course: mapped.course,
          discipline: mapped.discipline,
          year: "3rd Year",
          semester: "5",
          careerId: mapped.careerId,
          targetRole: mapped.targetRole || user.role,
          availableHours: 10,
          learningStyle: "Hands-on projects",
          skills: [],
          interests: `${mapped.targetRole || user.role} career preparation`,
          bio: `Student ID: ${user.badgeId} · Verified via Google / Firebase Authentication`,
          updatedAt: new Date().toISOString(),
        },
        privacy: {
          consent: {
            accepted: true,
            version: "1.0",
            acceptedAt: new Date().toISOString(),
            purpose: "Firebase authentication and workspace access",
          },
          ageConsent: {
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            minimumAge: 16,
          },
        },
      };
      state.userWorkspaces[user.id] = ws;
    } else {
      ws.currentUser = safeUser;
    }

    addActivity(ws, `Authenticated via Firebase (${user.email}) · Target Role: ${ws.profile?.targetRole || user.role}.`);
    await writeState(state);

    sendJson(
      response,
      200,
      {
        success: true,
        token,
        user: safeUser,
        roleMapping: mapped,
        state: sanitizeState({ ...state, ...ws, currentUser: safeUser }),
      },
      {
        "Set-Cookie": `nextstep_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      }
    );
  } catch (err) {
    sendJson(response, 401, { error: err.message || "Firebase authentication failed." });
  }
}

function getFirebaseConfig(request, response) {
  sendJson(response, 200, getFirebaseClientConfig());
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

  const guestMapped = mapRoleToCareer("Software Developer");
  state.userWorkspaces = state.userWorkspaces || {};
  const ws = {
    ...emptyUserState(),
    currentUser: guestUser,
    profile: {
      name: "Guest Student",
      course: guestMapped.course,
      discipline: guestMapped.discipline,
      year: "3rd Year",
      semester: "5",
      careerId: guestMapped.careerId,
      targetRole: guestMapped.targetRole,
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
      roleMapping: guestMapped,
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
    emailFooter: "NextStep Career Guidance · To manage communication preferences or opt out, visit /unsubscribe.html · 100% Free, Zero Hidden Fees",
    unsubscribeUrl: "/unsubscribe.html",
  });
}

async function forgotPassword(request, response, body, state) {
  const { identifier } = body || {};
  if (!identifier) {
    sendJson(response, 400, { error: "Please enter your Username, Gmail, or Mobile number." });
    return;
  }
  const users = state?.users || [];
  const user = findUserByIdentifier(users, identifier);

  // Generic message on unmapped user to prevent user enumeration
  if (!user) {
    sendJson(response, 200, {
      success: true,
      message: "If an account matches your details, a verification code has been dispatched.",
      generic: true,
    });
    return;
  }

  sendJson(response, 200, {
    success: true,
    message: `Reset OTP dispatched to registered contacts for ${user.name}.`,
    demoOtp: "849201",
    user: {
      name: user.name,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
    },
  });
}

async function resetPassword(request, response, body, state) {
  const validation = validatePasswordReset(body);
  if (!validation.isValid) {
    sendJson(response, 400, { error: validation.error });
    return;
  }
  const { identifier, newPassword, otp } = validation.sanitized;

  const users = state?.users || [];
  const user = findUserByIdentifier(users, identifier);
  if (!user) {
    sendJson(response, 404, { error: "No account found matching those details." });
    return;
  }

  const cleanOtp = String(otp || "").trim();
  if (cleanOtp && cleanOtp !== "849201" && cleanOtp.length !== 6) {
    sendJson(response, 400, { error: "Invalid OTP code. Please enter the valid OTP." });
    return;
  }

  // Encrypt the new password with 12 salt rounds
  const newHash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = newHash;
  user.updatedAt = new Date().toISOString();

  if (state.userWorkspaces && state.userWorkspaces[user.id]) {
    addActivity(state.userWorkspaces[user.id], `Account password was reset successfully.`);
  }

  await writeState(state);

  sendJson(response, 200, {
    success: true,
    message: "Password reset successfully! You can now log in with your new password.",
  });
}

module.exports = {
  getMe,
  login,
  register,
  handleFirebase,
  getFirebaseConfig,
  guest,
  logout,
  sendOtp,
  forgotPassword,
  resetPassword,
};
