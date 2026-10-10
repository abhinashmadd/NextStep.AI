// NextStep Student Authentication & Profile Access Controller
(function () {
  const API_BASE = (() => {
    if (window.location.protocol === "file:") return "http://127.0.0.1:3000";
    if (window.location.port === "3000" || window.location.port === "10000" || window.location.port === "") return "";
    const host = window.location.hostname || "127.0.0.1";
    return `http://${host}:3000`;
  })();

  let toastTimeout = null;
  let pendingRegistration = null;
  let currentUser = null;

  const $ = (selector) => document.querySelector(selector);

  function isStandalonePage() {
    const path = window.location.pathname.toLowerCase();
    return path.endsWith("profile.html") || path.endsWith("auth.html");
  }

  function showToast(message, isError = false) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3500);
  }

  async function api(path, body) {
    const url = path.startsWith("http://") || path.startsWith("https://") ? path : `${API_BASE}${path}`;
    const token = localStorage.getItem("nextstep_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    let response;
    try {
      response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? (token ? { "Authorization": `Bearer ${token}` } : {}) : headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("Couldn't connect to NextStep backend (http://127.0.0.1:3000). Check that the server is running.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Authentication failed. Please try again.");
    return result;
  }

  function showAuthView(viewName) {
    document.querySelectorAll(".auth-form-view").forEach((view) => view.classList.remove("active"));
    const view = $(`#auth-${viewName}-view`) || $(`#auth-${viewName}-form`);
    if (view) view.classList.add("active");
  }

  function switchAuthTab(tabName) {
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      const isTarget = tab.dataset.tab === tabName;
      tab.classList.toggle("active", isTarget);
      tab.setAttribute("aria-selected", isTarget ? "true" : "false");
    });
    showAuthView(tabName);
  }

  function updateAccountView(user) {
    currentUser = user;
    if (user) {
      try {
        localStorage.setItem("nextstep_user", JSON.stringify(user));
      } catch {}

      const tabs = $("#auth-tabs");
      if (tabs) tabs.style.display = "none";
      showAuthView("account");

      const avatar = $("#auth-acc-avatar");
      if (avatar) avatar.textContent = user.name ? user.name.trim().charAt(0).toUpperCase() : "S";

      const name = $("#auth-acc-name");
      if (name) name.textContent = user.name || "Student";

      const badge = $("#auth-acc-badge-text");
      if (badge) badge.textContent = user.badgeId || "ST-2026-089";

      const role = $("#auth-acc-role");
      if (role) role.textContent = user.role || "Software Developer";

      const email = $("#auth-acc-email");
      if (email) email.textContent = user.email || "—";

      const mobile = $("#auth-acc-mobile");
      if (mobile) mobile.textContent = user.mobile || "—";
    } else {
      currentUser = null;
      try {
        localStorage.removeItem("nextstep_user");
        localStorage.removeItem("nextstep_token");
      } catch {}

      const tabs = $("#auth-tabs");
      if (tabs) tabs.style.display = "grid";
      switchAuthTab("signin");
    }
  }

  async function checkSession() {
    const token = localStorage.getItem("nextstep_token");
    if (!token) {
      currentUser = null;
      try {
        localStorage.removeItem("nextstep_user");
      } catch {}
      updateAccountView(null);
      return;
    }

    try {
      const result = await api("/api/auth/me");
      if (result.user) {
        updateAccountView(result.user);
      } else {
        try {
          localStorage.removeItem("nextstep_token");
          localStorage.removeItem("nextstep_user");
        } catch {}
        updateAccountView(null);
      }
    } catch {
      // Server restarting or network error: retain local cache only if token exists
      try {
        const cached = localStorage.getItem("nextstep_user");
        if (cached && token) {
          currentUser = JSON.parse(cached);
          updateAccountView(currentUser);
        } else {
          updateAccountView(null);
        }
      } catch {
        updateAccountView(null);
      }
    }
  }

  function handleAuthSuccess(user, state, successMsg, token) {
    if (token) {
      try {
        localStorage.setItem("nextstep_token", token);
      } catch {}
    }
    updateAccountView(user);
    showToast(successMsg);

    const dialog = $("#auth-dialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    }

    if (window.onNextStepAuthSuccess) {
      window.onNextStepAuthSuccess(user, state);
    }

    if (isStandalonePage()) {
      setTimeout(() => {
        window.location.href = "./index.html";
      }, 700);
    }
  }

  // Setup Event Listeners
  function initAuthEvents() {
    // Tab Clicks
    $("#tab-signin")?.addEventListener("click", () => switchAuthTab("signin"));
    $("#tab-register")?.addEventListener("click", () => switchAuthTab("register"));

    // Close Dialog (if inside dialog modal)
    $("#auth-close-link")?.addEventListener("click", (e) => {
      const dialog = $("#auth-dialog");
      if (dialog && typeof dialog.close === "function") {
        e.preventDefault();
        dialog.close();
      }
    });

    // Password Visibility Toggles
    document.querySelectorAll(".auth-toggle-pwd").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrapper = btn.closest(".auth-input-wrapper");
        const input = wrapper?.querySelector("input");
        if (!input) return;
        const isPwd = input.type === "password";
        input.type = isPwd ? "text" : "password";
        btn.style.color = isPwd ? "#38bdf8" : "#64748b";
      });
    });

    // Password Strength Meter
    const regPwd = $("#register-password");
    if (regPwd) {
      regPwd.addEventListener("input", () => {
        const val = regPwd.value;
        const bars = document.querySelectorAll(".auth-strength-bar");
        bars.forEach((b) => { b.className = "auth-strength-bar"; });
        if (!val) return;
        let score = 0;
        if (val.length >= 6) score++;
        if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        if (val.length >= 10) score++;
        bars.forEach((b, i) => {
          if (i < score) {
            b.classList.add(score <= 1 ? "weak" : score <= 2 ? "medium" : "strong");
          }
        });
      });
    }

    // Sign In Form Submission
    $("#auth-signin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Authenticating…";
      try {
        const values = new FormData(form);
        const identifier = (values.get("identifier") || values.get("email") || "").trim();
        const result = await api("/api/auth/login", {
          identifier,
          password: values.get("password"),
        });
        form.reset();
        handleAuthSuccess(result.user, result.state, `Welcome back, ${result.user.name}!`, result.token);
      } catch (err) {
        showToast(err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // Register Form Submission -> Triggers OTP step
    $("#auth-register-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const values = new FormData(form);
      const password = values.get("password");
      const confirmPassword = values.get("confirmPassword");
      if (password !== confirmPassword) {
        showToast("Passwords do not match.", true);
        return;
      }
      pendingRegistration = {
        name: values.get("name").trim(),
        username: values.get("username")?.trim() || "",
        badgeId: values.get("badgeId")?.trim() || "",
        email: values.get("email").trim(),
        mobile: values.get("mobile")?.trim() || "",
        role: values.get("role")?.trim() || "Software Developer",
        password,
      };
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking credentials & Dispatching OTP…";
      try {
        const res = await api("/api/auth/send-otp", {
          email: pendingRegistration.email,
          mobile: pendingRegistration.mobile,
          username: pendingRegistration.username,
        });
        const demoOtpEl = $("#auth-demo-otp");
        if (demoOtpEl) demoOtpEl.textContent = res.demoOtp || "849201";
        const tabs = $("#auth-tabs");
        if (tabs) tabs.style.display = "none";
        showAuthView("otp");
        showToast("Verification code dispatched to student email & mobile.");
        const firstDigit = document.querySelector(".auth-otp-digit");
        if (firstDigit) {
          firstDigit.value = "";
          firstDigit.focus();
        }
      } catch (err) {
        showToast(err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    // OTP Input Navigation
    const otpDigits = document.querySelectorAll(".auth-otp-digit");
    otpDigits.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        if (e.target.value.length === 1 && index < otpDigits.length - 1) {
          otpDigits[index + 1].focus();
        }
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && index > 0) {
          otpDigits[index - 1].focus();
        }
      });
    });

    // Verify OTP Button
    $("#btn-verify-otp")?.addEventListener("click", async () => {
      if (!pendingRegistration) {
        showToast("Registration session expired. Please fill the registration form again.", true);
        switchAuthTab("register");
        return;
      }
      const btn = $("#btn-verify-otp");
      btn.disabled = true;
      btn.textContent = "Verifying & Encrypting…";
      try {
        const result = await api("/api/auth/register", pendingRegistration);
        const form = $("#auth-register-form");
        if (form) form.reset();
        pendingRegistration = null;
        handleAuthSuccess(result.user, result.state, `Welcome to NextStep, ${result.user.name}!`, result.token);
      } catch (err) {
        showToast(err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Verify & Launch Workspace →";
      }
    });

    // Resend OTP
    $("#btn-resend-otp")?.addEventListener("click", async () => {
      try {
        await api("/api/auth/send-otp", { email: pendingRegistration?.email || "" });
        showToast("New OTP dispatched to registered email and mobile.");
      } catch (err) {
        showToast(err.message, true);
      }
    });

    // Forgot Password Button -> Open Forgot Password View
    $("#auth-forgot-btn")?.addEventListener("click", () => {
      const tabs = $("#auth-tabs");
      if (tabs) tabs.style.display = "none";
      const signinIdInput = document.querySelector("#auth-signin-form input[name='identifier']");
      const resetIdInput = $("#auth-reset-id");
      if (signinIdInput && resetIdInput && signinIdInput.value.trim()) {
        resetIdInput.value = signinIdInput.value.trim();
      }
      const stepFields = $("#auth-reset-step-fields");
      if (stepFields) stepFields.style.display = "none";
      const submitBtn = $("#btn-reset-submit");
      if (submitBtn) submitBtn.textContent = "Send Reset OTP";
      showAuthView("forgot");
    });

    // Back to Sign In from Forgot Password
    $("#btn-reset-cancel")?.addEventListener("click", () => {
      const tabs = $("#auth-tabs");
      if (tabs) tabs.style.display = "grid";
      switchAuthTab("signin");
    });

    // Forgot / Reset Password Form Submission
    $("#auth-forgot-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const submitBtn = $("#btn-reset-submit");
      const resetId = $("#auth-reset-id")?.value.trim();
      const stepFields = $("#auth-reset-step-fields");
      const otpInput = $("#auth-reset-otp");
      const newPassInput = $("#auth-reset-newpass");

      if (!stepFields || stepFields.style.display === "none") {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying Account & Sending OTP…";
        try {
          const res = await api("/api/auth/forgot-password", { identifier: resetId });
          const demoOtpEl = $("#auth-reset-demo-otp");
          if (demoOtpEl && res.demoOtp) demoOtpEl.textContent = res.demoOtp;
          stepFields.style.display = "block";
          if (otpInput) {
            otpInput.required = true;
            otpInput.focus();
          }
          if (newPassInput) newPassInput.required = true;
          submitBtn.textContent = "Reset Password & Sign In";
          showToast(res.message || "Reset OTP dispatched.");
        } catch (err) {
          showToast(err.message, true);
        } finally {
          submitBtn.disabled = false;
        }
      } else {
        const otp = otpInput?.value.trim();
        const newPassword = newPassInput?.value;
        if (!otp) {
          showToast("Please enter the 6-digit OTP code.", true);
          return;
        }
        if (!newPassword || newPassword.length < 6) {
          showToast("New password must be at least 6 characters long.", true);
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating Password…";
        try {
          const res = await api("/api/auth/reset-password", {
            identifier: resetId,
            otp,
            newPassword,
          });
          showToast(res.message || "Password updated successfully!");
          form.reset();
          stepFields.style.display = "none";
          submitBtn.textContent = "Send Reset OTP";
          const tabs = $("#auth-tabs");
          if (tabs) tabs.style.display = "grid";
          switchAuthTab("signin");
          const signinIdInput = document.querySelector("#auth-signin-form input[name='identifier']");
          if (signinIdInput) signinIdInput.value = resetId;
          const signinPwdInput = document.querySelector("#auth-signin-form input[name='password']");
          if (signinPwdInput) signinPwdInput.focus();
        } catch (err) {
          showToast(err.message, true);
        } finally {
          submitBtn.disabled = false;
        }
      }
    });

    // Account View Controls
    $("#auth-acc-switch")?.addEventListener("click", () => {
      const tabs = $("#auth-tabs");
      if (tabs) tabs.style.display = "grid";
      switchAuthTab("signin");
    });

    $("#auth-acc-continue")?.addEventListener("click", (e) => {
      const dialog = $("#auth-dialog");
      if (dialog && typeof dialog.close === "function") {
        e.preventDefault();
        dialog.close();
      } else if (isStandalonePage()) {
        window.location.href = "./index.html";
      }
    });

    $("#auth-acc-logout")?.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", {});
      } catch {}
      try {
        localStorage.removeItem("nextstep_token");
        localStorage.removeItem("nextstep_user");
      } catch {}
      updateAccountView(null);
      showToast("Signed out of NextStep session.");
      const dialog = $("#auth-dialog");
      if (dialog && typeof dialog.close === "function") {
        dialog.close();
      }
      if (window.onNextStepAuthLogout) {
        window.onNextStepAuthLogout();
      }
    });
  }

  // Expose global controller
  window.NextStepAuth = {
    open: function (tab = "signin") {
      const dialog = $("#auth-dialog");
      if (dialog && typeof dialog.showModal === "function") {
        if (currentUser) {
          updateAccountView(currentUser);
        } else {
          const tabs = $("#auth-tabs");
          if (tabs) tabs.style.display = "grid";
          switchAuthTab(tab);
        }
        dialog.showModal();
      } else {
        window.location.href = "./profile.html";
      }
    },
    getUser: function () {
      return currentUser;
    },
    checkSession,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initAuthEvents();
    checkSession();
  });
})();
