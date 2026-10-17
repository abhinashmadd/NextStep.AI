// NextStep Security Middleware: Authentication Rate Limiter
// Protects against credential stuffing, brute-force attacks, and denial of service.

const FAILED_LOGIN_LIMIT = 5; // Max 5 failed attempts per account or IP/account combo
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout
const IP_FLOOD_LIMIT = 30; // Max 30 failed attempts across all accounts for an IP
const GENERAL_IP_LIMIT = 60; // Max 60 requests per minute
const GENERAL_WINDOW_MS = 60 * 1000; // 1 minute

// In-memory tracking stores
const failedLogins = new Map(); // key: ip or identifier -> { count, firstFailedAt, lockedUntil }
const ipRequestCounts = new Map(); // key: ip -> { count, resetAt }

// Clean up expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failedLogins.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      failedLogins.delete(key);
    } else if (now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
      failedLogins.delete(key);
    }
  }
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (record.resetAt < now) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function getClientIp(request) {
  if (!request) return "127.0.0.1";
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers["x-real-ip"];
  if (realIp) return realIp.trim();
  return request.socket?.remoteAddress || "127.0.0.1";
}

function isLoopback(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
}

/**
 * Checks if an IP or login identifier is currently rate limited / locked out.
 * Returns { isLimited: boolean, retryAfterSeconds: number, remaining: number }
 */
function checkLoginRateLimit(ip, identifier) {
  const now = Date.now();
  const cleanId = identifier ? String(identifier).toLowerCase().trim() : "";
  const keysToCheck = [];

  // 1. Account & IP/account combo level protection (5 failed attempts)
  if (cleanId) {
    keysToCheck.push({ key: `id:${cleanId}`, limit: FAILED_LOGIN_LIMIT });
    keysToCheck.push({ key: `combo:${ip}:${cleanId}`, limit: FAILED_LOGIN_LIMIT });
  }

  // 2. IP flood protection for non-loopback addresses
  if (!isLoopback(ip)) {
    keysToCheck.push({ key: `ip:${ip}`, limit: IP_FLOOD_LIMIT });
  }

  for (const { key } of keysToCheck) {
    const record = failedLogins.get(key);
    if (!record) continue;

    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        isLimited: true,
        retryAfterSeconds: Math.max(1, retryAfter),
        remaining: 0,
      };
    }

    if (now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
      failedLogins.delete(key);
    }
  }

  const primaryKey = cleanId ? `combo:${ip}:${cleanId}` : `ip:${ip}`;
  const record = failedLogins.get(primaryKey);
  const remaining = record ? Math.max(0, FAILED_LOGIN_LIMIT - record.count) : FAILED_LOGIN_LIMIT;

  return {
    isLimited: false,
    retryAfterSeconds: 0,
    remaining,
  };
}

/**
 * Records a failed login attempt for identifier, combo, and IP
 */
function recordFailedLogin(ip, identifier) {
  const now = Date.now();
  const cleanId = identifier ? String(identifier).toLowerCase().trim() : "";
  const keysToUpdate = [];

  if (cleanId) {
    keysToUpdate.push({ key: `id:${cleanId}`, limit: FAILED_LOGIN_LIMIT });
    keysToUpdate.push({ key: `combo:${ip}:${cleanId}`, limit: FAILED_LOGIN_LIMIT });
  }

  if (!isLoopback(ip)) {
    keysToUpdate.push({ key: `ip:${ip}`, limit: IP_FLOOD_LIMIT });
  }

  for (const { key, limit } of keysToUpdate) {
    let record = failedLogins.get(key);
    if (!record || now - record.firstFailedAt > LOCKOUT_WINDOW_MS) {
      record = { count: 1, firstFailedAt: now, lockedUntil: null };
    } else {
      record.count += 1;
    }

    if (record.count >= limit) {
      record.lockedUntil = now + LOCKOUT_WINDOW_MS;
    }

    failedLogins.set(key, record);
  }
}

/**
 * Clears failed attempts upon a successful login
 */
function resetLoginAttempts(ip, identifier) {
  const cleanId = identifier ? String(identifier).toLowerCase().trim() : "";
  if (cleanId) {
    failedLogins.delete(`id:${cleanId}`);
    failedLogins.delete(`combo:${ip}:${cleanId}`);
  }
  failedLogins.delete(`ip:${ip}`);
}

/**
 * Checks general request flood rate limit for an IP
 */
function checkGeneralRateLimit(ip) {
  const now = Date.now();
  let record = ipRequestCounts.get(ip);
  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + GENERAL_WINDOW_MS };
    ipRequestCounts.set(ip, record);
    return { isLimited: false, remaining: GENERAL_IP_LIMIT - 1 };
  }

  record.count += 1;
  if (record.count > GENERAL_IP_LIMIT) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { isLimited: true, retryAfterSeconds: Math.max(1, retryAfter), remaining: 0 };
  }

  return { isLimited: false, remaining: GENERAL_IP_LIMIT - record.count };
}

module.exports = {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  checkGeneralRateLimit,
  FAILED_LOGIN_LIMIT,
  LOCKOUT_WINDOW_MS,
};
