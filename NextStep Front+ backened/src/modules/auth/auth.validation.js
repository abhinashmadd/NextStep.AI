// NextStep Server-Side Authentication Validation Module
// Enforces strict input validation, type safety, sanitization, and attack prevention.

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;
const SCRIPT_TAG_REGEX = /<[^>]*script[^>]*>|javascript:|data:/i;

function cleanString(str) {
  if (typeof str !== "string") return "";
  return str.trim();
}

function normalizeMobile(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Validates registration payload
 */
function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isValid: false, error: "Invalid request payload format." };
  }

  // 1. Name validation
  const name = cleanString(body.name);
  if (!name || typeof body.name !== "string") {
    return { isValid: false, error: "Full name is required." };
  }
  if (name.length < 2 || name.length > 80) {
    return { isValid: false, error: "Name must be between 2 and 80 characters." };
  }
  if (SCRIPT_TAG_REGEX.test(name)) {
    return { isValid: false, error: "Name contains invalid characters." };
  }

  // 2. Email validation
  const email = cleanString(body.email).toLowerCase();
  if (!email || typeof body.email !== "string") {
    return { isValid: false, error: "Email address is required." };
  }
  if (email.length > 254 || !EMAIL_REGEX.test(email)) {
    return { isValid: false, error: "Please provide a valid email address (e.g., student@university.edu)." };
  }

  // 3. Password validation
  if (!body.password || typeof body.password !== "string") {
    return { isValid: false, error: "Password is required." };
  }
  const password = String(body.password);
  if (password.length < 6) {
    return { isValid: false, error: "Password must be at least 6 characters long." };
  }
  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters." };
  }
  if (!password.trim()) {
    return { isValid: false, error: "Password cannot be entirely whitespace." };
  }

  // 4. Age & Terms Consent (Strict GDPR / COPPA compliance)
  const ageConsent = body.ageConsent === true || body.ageConsent === "true";
  if (!ageConsent) {
    return {
      isValid: false,
      error: "You must confirm you are at least 16 years of age (or have verified parental/guardian permission) to register on NextStep."
    };
  }

  // 5. Mobile validation (optional or 10 digits)
  let mobile = "";
  if (body.mobile !== undefined && body.mobile !== null && body.mobile !== "") {
    if (typeof body.mobile !== "string" && typeof body.mobile !== "number") {
      return { isValid: false, error: "Invalid mobile number format." };
    }
    const cleanMob = normalizeMobile(body.mobile);
    if (cleanMob.length !== 10) {
      return { isValid: false, error: "Please enter a valid 10-digit mobile number." };
    }
    mobile = cleanMob;
  }

  // 6. Username validation
  let username = "";
  if (body.username) {
    if (typeof body.username !== "string") {
      return { isValid: false, error: "Username must be a valid text string." };
    }
    const cleanUser = cleanString(body.username).toLowerCase();
    if (cleanUser.length < 3 || cleanUser.length > 30) {
      return { isValid: false, error: "Username must be between 3 and 30 characters." };
    }
    if (!USERNAME_REGEX.test(cleanUser)) {
      return { isValid: false, error: "Username can only contain letters, numbers, periods, underscores, and hyphens." };
    }
    username = cleanUser;
  }

  // 7. Role validation
  let role = "Software Developer";
  if (body.role) {
    if (typeof body.role !== "string") {
      return { isValid: false, error: "Career role must be a text string." };
    }
    const cleanRole = cleanString(body.role);
    if (cleanRole.length > 100) {
      return { isValid: false, error: "Career role length cannot exceed 100 characters." };
    }
    role = cleanRole;
  }

  // 8. BadgeId validation
  let badgeId = "";
  if (body.badgeId) {
    if (typeof body.badgeId === "string") {
      badgeId = cleanString(body.badgeId).slice(0, 50);
    }
  }

  return {
    isValid: true,
    sanitized: {
      name,
      email,
      password,
      mobile,
      username,
      role,
      badgeId,
      ageConsent: true,
    }
  };
}

/**
 * Validates login payload
 */
function validateLogin(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isValid: false, error: "Invalid request payload format." };
  }

  const rawId = body.identifier || body.email || body.username || body.mobile || "";
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return { isValid: false, error: "Invalid login identifier." };
  }
  const identifier = cleanString(String(rawId));
  if (!identifier) {
    return { isValid: false, error: "Enter your username, gmail or mobile number and password." };
  }
  if (identifier.length > 255) {
    return { isValid: false, error: "Login identifier is too long." };
  }

  if (!body.password || typeof body.password !== "string") {
    return { isValid: false, error: "Enter your username, gmail or mobile number and password." };
  }
  const password = String(body.password);
  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters." };
  }

  return {
    isValid: true,
    sanitized: {
      identifier,
      password,
    }
  };
}

/**
 * Validates password reset payload
 */
function validatePasswordReset(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isValid: false, error: "Invalid request payload format." };
  }

  const identifier = cleanString(String(body.identifier || ""));
  if (!identifier) {
    return { isValid: false, error: "Identifier and new password are required." };
  }

  if (!body.newPassword || typeof body.newPassword !== "string") {
    return { isValid: false, error: "Identifier and new password are required." };
  }
  const newPassword = String(body.newPassword);
  if (newPassword.length < 6) {
    return { isValid: false, error: "Password must be at least 6 characters long." };
  }
  if (newPassword.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters." };
  }

  const otp = cleanString(String(body.otp || ""));

  return {
    isValid: true,
    sanitized: {
      identifier,
      newPassword,
      otp,
    }
  };
}

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  normalizeMobile,
};
