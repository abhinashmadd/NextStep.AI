// Test Suite: NextStep Auth Security, Validation, Rate Limiting & Firebase
const http = require("node:http");

const BASE = "http://localhost:3000";

function req(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...options.headers };
    let postData = options.body;

    const requestOptions = {
      method: options.method || "GET",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };

    const clientReq = http.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let body = data;
        try { body = JSON.parse(data); } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    clientReq.on("error", reject);
    if (postData) clientReq.write(postData);
    clientReq.end();
  });
}

let passed = 0;
let total = 0;
function assert(name, condition) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name}`);
    throw new Error(`Failed: ${name}`);
  }
}

async function runSecurityTests() {
  console.log("=================================================");
  console.log(" 🛡️ NextStep Authentication & Security Verification");
  console.log("=================================================");

  // SECTION 1: SERVER-SIDE VALIDATION
  console.log("\n[1] Testing Strict Server-Side Validation");

  // 1a. Invalid Email
  const badEmailRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Security Tester",
      email: "not-an-email",
      password: "ValidPassword123!",
      ageConsent: true,
    })
  });
  assert("Invalid email format rejected with 400", badEmailRes.status === 400);

  // 1b. Short Password (< 6 chars)
  const shortPwdRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Security Tester",
      email: `valid_${Date.now()}@test.edu`,
      password: "123",
      ageConsent: true,
    })
  });
  assert("Short password (< 6 chars) rejected with 400", shortPwdRes.status === 400);

  // 1c. Excessively long password (> 128 chars, prevents bcrypt DoS)
  const longPwdRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Security Tester",
      email: `valid_${Date.now()}@test.edu`,
      password: "A".repeat(150),
      ageConsent: true,
    })
  });
  assert("Password > 128 chars rejected with 400 (bcrypt DoS prevention)", longPwdRes.status === 400);

  // 1d. Missing Age Consent
  const noAgeRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Underage Tester",
      email: `underage_${Date.now()}@test.edu`,
      password: "ValidPassword123!",
      ageConsent: false,
    })
  });
  assert("Registration without age consent rejected with 400", noAgeRes.status === 400);

  // 1e. Malformed Mobile Number
  const badMobileRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Mobile Tester",
      email: `mob_${Date.now()}@test.edu`,
      password: "ValidPassword123!",
      mobile: "123", // invalid mobile
      ageConsent: true,
    })
  });
  assert("Malformed mobile number (< 10 digits) rejected with 400", badMobileRes.status === 400);

  // SECTION 2: PASSWORD ENCRYPTION & DATA SAFETY
  console.log("\n[2] Testing Password Encryption & Data Safety");

  const validTestEmail = `sec_student_${Date.now()}@university.edu`;
  const rawPassword = "StudentSecurePassword999!";
  const regRes = await req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Aditi Roy",
      email: validTestEmail,
      password: rawPassword,
      mobile: String(Math.floor(6000000000 + Math.random() * 3999999999)),
      ageConsent: true,
      role: "Software Developer",
    })
  });
  if (regRes.status !== 201) {
    console.error("Registration error:", regRes.status, regRes.body);
  }
  assert("Valid registration succeeds with 201 Created", regRes.status === 201);
  assert("Response user object NEVER leaks password", regRes.body.user.password === undefined);
  assert("Response user object NEVER leaks passwordHash", regRes.body.user.passwordHash === undefined);

  // SECTION 3: GENERIC ERROR MESSAGES (NO ACCOUNT ENUMERATION)
  console.log("\n[3] Testing Generic Error Messages (Anti-Account Enumeration)");

  // 3a. Login with nonexistent account
  const nonExistentLogin = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "definitely_non_existent_account_9999@random.com",
      password: "AnyPassword123!",
    })
  });
  assert("Non-existent user login returns 401 Unauthorized", nonExistentLogin.status === 401);
  assert("Non-existent user returns generic error message", nonExistentLogin.body.error === "Invalid credentials. Please verify your email, username, or mobile and password.");

  // 3b. Login with existing account but wrong password
  const wrongPasswordLogin = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: validTestEmail,
      password: "WrongPassword999!",
    })
  });
  assert("Existing user with wrong password returns 401 Unauthorized", wrongPasswordLogin.status === 401);
  assert("Existing user returns exact same generic error message", wrongPasswordLogin.body.error === "Invalid credentials. Please verify your email, username, or mobile and password.");
  assert("Errors are completely identical (zero account enumeration)", nonExistentLogin.body.error === wrongPasswordLogin.body.error);

  // SECTION 4: RATE LIMITING ON LOGIN
  console.log("\n[4] Testing Login Rate Limiting (Brute-Force & Credential Stuffing Protection)");

  const bruteForceTarget = `brute_target_${Date.now()}@university.edu`;
  const customIp = "192.168.100." + Math.floor(10 + Math.random() * 200);

  console.log(`     Simulating 5 consecutive failed login attempts from ${customIp}...`);
  for (let i = 1; i <= 5; i++) {
    const attempt = await req("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": customIp,
      },
      body: JSON.stringify({ identifier: bruteForceTarget, password: "WrongPassword!" })
    });
    assert(`Attempt ${i} rejected with 401`, attempt.status === 401);
  }

  // 6th attempt must trigger Rate Limiter
  const lockedAttempt = await req("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": customIp,
    },
    body: JSON.stringify({ identifier: bruteForceTarget, password: "WrongPassword!" })
  });

  assert("6th failed login is locked with HTTP 429 (Too Many Requests)", lockedAttempt.status === 429);
  assert("HTTP 429 response includes Retry-After header", Boolean(lockedAttempt.headers["retry-after"]));
  assert("Rate limit message is returned", lockedAttempt.body.error.includes("Too many failed login attempts"));

  // SECTION 5: FIREBASE AUTHENTICATION INTEGRATION
  console.log("\n[5] Testing Firebase Authentication Integration");

  // 5a. GET /api/auth/firebase-config
  const fbConfig = await req("/api/auth/firebase-config");
  assert("GET /api/auth/firebase-config returns 200", fbConfig.status === 200);
  assert("Firebase config provides projectId", Boolean(fbConfig.body.projectId));
  assert("Firebase config provides apiKey", Boolean(fbConfig.body.apiKey));
  assert("Firebase config provides authDomain", Boolean(fbConfig.body.authDomain));

  // 5b. POST /api/auth/firebase with valid JWT token payload
  const firebaseUid = "google-uid-" + Date.now();
  const firebaseEmail = `firebase_student_${Date.now()}@gmail.com`;
  
  // Construct a standard Firebase JWT payload
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const mockJwt = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${fbConfig.body.projectId}`,
    aud: fbConfig.body.projectId,
    auth_time: Math.floor(Date.now() / 1000),
    user_id: firebaseUid,
    sub: firebaseUid,
    email: firebaseEmail,
    email_verified: true,
    name: "Firebase Google Student",
    picture: "https://lh3.googleusercontent.com/a/default-avatar",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.mock_signature`;

  const fbLoginRes = await req("/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: mockJwt,
      role: "Software Developer",
    })
  });

  assert("POST /api/auth/firebase authenticates successfully (200 OK)", fbLoginRes.status === 200);
  assert("Firebase user account created with email", fbLoginRes.body.user.email === firebaseEmail);
  assert("Firebase user has badgeId assigned", Boolean(fbLoginRes.body.user.badgeId));
  assert("Firebase user has token issued", Boolean(fbLoginRes.body.token));
  assert("Firebase user profile mapped to careerId", fbLoginRes.body.roleMapping?.careerId === "software-developer");
  assert("Set-Cookie header includes nextstep_session", Boolean(fbLoginRes.headers["set-cookie"]));

  console.log("\n=================================================");
  console.log(` 🎉 ALL SECURITY & AUTH TESTS PASSED: ${passed}/${total} (100%)`);
  console.log("=================================================");
}

runSecurityTests().catch((err) => {
  console.error("\n❌ Security test failed:", err);
  process.exit(1);
});
