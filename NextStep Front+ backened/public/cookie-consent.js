/**
 * NextStep Cookie Consent & Privacy Manager
 * Accessible, WCAG 2.1 AA Compliant, GDPR / CCPA / DPDP Aligned
 * Zero dark patterns: Equal prominence for Accept and Reject, no pre-ticked non-essential boxes.
 */

(function () {
  const STORAGE_KEY = "nextstep_cookie_consent";

  function getConsent() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveConsent(preferences) {
    const record = {
      essential: true, // Always true
      analytics: Boolean(preferences.analytics),
      personalization: Boolean(preferences.personalization),
      timestamp: new Date().toISOString(),
      version: "1.0",
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      // Set a persistent cookie for 180 days
      const maxAge = 180 * 24 * 60 * 60;
      document.cookie = `nextstep_cookie_pref=${encodeURIComponent(JSON.stringify(record))}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    } catch (e) {
      console.warn("Could not save cookie preferences to storage:", e);
    }

    // Dispatch event for other modules
    document.dispatchEvent(new CustomEvent("nextstep-cookie-consent", { detail: record }));
    hideBanner();
    hideModal();
  }

  function injectStyles() {
    if (document.getElementById("nextstep-cookie-styles")) return;
    const style = document.createElement("style");
    style.id = "nextstep-cookie-styles";
    style.textContent = `
      .ns-cookie-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 960px;
        margin: 0 auto;
        background: #19241b;
        color: #f5f8f4;
        border: 1px solid #334436;
        border-radius: 14px;
        padding: 22px 26px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 99999;
        font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: nsCookieSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes nsCookieSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .ns-cookie-banner-header {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .ns-cookie-icon {
        font-size: 20px;
        color: #63b37d;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .ns-cookie-title {
        font-family: "Manrope", sans-serif;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.3px;
        color: #ffffff;
        margin: 0;
      }

      .ns-cookie-text {
        font-size: 13.5px;
        line-height: 1.55;
        color: #c9d4c7;
        margin: 0;
      }

      .ns-cookie-text a {
        color: #8ed6a5;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .ns-cookie-text a:hover,
      .ns-cookie-text a:focus {
        color: #bbf0cc;
        outline: 2px solid transparent;
      }

      .ns-cookie-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .ns-cookie-btn {
        padding: 9px 18px;
        font-size: 13px;
        font-weight: 700;
        font-family: inherit;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid transparent;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .ns-cookie-btn:focus-visible {
        outline: 3px solid #8ed6a5;
        outline-offset: 2px;
      }

      .ns-cookie-btn-primary {
        background: #2e6945;
        color: #ffffff;
        border-color: #3b8256;
      }

      .ns-cookie-btn-primary:hover {
        background: #397f54;
      }

      .ns-cookie-btn-secondary {
        background: #253328;
        color: #e2ede0;
        border-color: #405744;
      }

      .ns-cookie-btn-secondary:hover {
        background: #2f4233;
        color: #ffffff;
      }

      .ns-cookie-btn-ghost {
        background: transparent;
        color: #adc2b0;
        border-color: transparent;
        margin-left: auto;
      }

      .ns-cookie-btn-ghost:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      /* Modal Dialog */
      .ns-cookie-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(13, 20, 15, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 100000;
        animation: nsFadeIn 0.2s ease;
      }

      @keyframes nsFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .ns-cookie-modal {
        background: #ffffff;
        color: #1b261e;
        border-radius: 14px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        padding: 30px;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.25);
        border: 1px solid #d4ded1;
        font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .ns-cookie-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid #e7eee5;
      }

      .ns-cookie-modal-title {
        font-family: "Manrope", sans-serif;
        font-size: 20px;
        font-weight: 800;
        color: #1b261e;
        margin: 0 0 6px 0;
      }

      .ns-cookie-modal-close {
        background: transparent;
        border: 1px solid #d4ded1;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        color: #556658;
        padding: 6px 12px;
        transition: background 0.15s ease;
      }

      .ns-cookie-modal-close:hover {
        background: #eef4ed;
        color: #1b261e;
      }

      .ns-cookie-category {
        border: 1px solid #e1e9de;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 14px;
        background: #fbfdfa;
      }

      .ns-cookie-cat-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .ns-cookie-cat-name {
        font-family: "Manrope", sans-serif;
        font-weight: 700;
        font-size: 15px;
        color: #1b261e;
      }

      .ns-cookie-status-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        background: #e7f2e5;
        color: #215433;
      }

      .ns-cookie-cat-desc {
        font-size: 13px;
        color: #4c5d50;
        line-height: 1.5;
        margin: 0;
      }

      .ns-cookie-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .ns-cookie-toggle input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #2e6945;
      }

      .ns-cookie-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #e7eee5;
      }
    `;
    document.head.appendChild(style);
  }

  function showBanner() {
    if (document.getElementById("ns-cookie-banner")) return;
    injectStyles();

    const banner = document.createElement("aside");
    banner.id = "ns-cookie-banner";
    banner.className = "ns-cookie-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie consent and privacy options");

    banner.innerHTML = `
      <div class="ns-cookie-banner-header">
        <span class="ns-cookie-icon" aria-hidden="true">🍪</span>
        <h2 class="ns-cookie-title">Your Privacy &amp; Cookie Choices</h2>
      </div>
      <p class="ns-cookie-text">
        NextStep uses strictly necessary cookies to keep your student session authenticated and secure. We do <strong>not</strong> sell personal data, profile info, or use third-party advertising tracking. Optional performance cookies help us improve the platform and require your consent. Learn more in our <a href="./cookie-policy.html">Cookie Policy</a> and <a href="./privacy-policy.html">Privacy Policy</a>.
      </p>
      <div class="ns-cookie-actions">
        <button type="button" class="ns-cookie-btn ns-cookie-btn-primary" id="ns-cookie-accept-all">Accept All</button>
        <button type="button" class="ns-cookie-btn ns-cookie-btn-secondary" id="ns-cookie-reject-optional">Reject Non-Essential</button>
        <button type="button" class="ns-cookie-btn ns-cookie-btn-ghost" id="ns-cookie-customize">Manage Preferences</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("ns-cookie-accept-all")?.addEventListener("click", () => {
      saveConsent({ analytics: true, personalization: true });
    });

    document.getElementById("ns-cookie-reject-optional")?.addEventListener("click", () => {
      saveConsent({ analytics: false, personalization: false });
    });

    document.getElementById("ns-cookie-customize")?.addEventListener("click", () => {
      showModal();
    });
  }

  function hideBanner() {
    const banner = document.getElementById("ns-cookie-banner");
    if (banner) banner.remove();
  }

  function showModal() {
    if (document.getElementById("ns-cookie-modal-backdrop")) return;
    injectStyles();

    const existing = getConsent() || { analytics: false, personalization: false };

    const backdrop = document.createElement("div");
    backdrop.id = "ns-cookie-modal-backdrop";
    backdrop.className = "ns-cookie-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Customize cookie preferences");

    backdrop.innerHTML = `
      <div class="ns-cookie-modal">
        <div class="ns-cookie-modal-header">
          <div>
            <h3 class="ns-cookie-modal-title">Cookie &amp; Tracking Preferences</h3>
            <p style="margin:0;font-size:13px;color:#4c5d50;">Manage how cookies and local storage are utilized across NextStep.</p>
          </div>
          <button type="button" class="ns-cookie-modal-close" id="ns-cookie-modal-close-btn" aria-label="Close preferences modal">✕</button>
        </div>

        <div class="ns-cookie-category">
          <div class="ns-cookie-cat-top">
            <span class="ns-cookie-cat-name">1. Strictly Necessary &amp; Security Cookies</span>
            <span class="ns-cookie-status-badge">Always Active</span>
          </div>
          <p class="ns-cookie-cat-desc">
            Essential for account authentication (<code>nextstep_session</code>), CSRF defense, and secure evidence storage. Cannot be switched off in our systems.
          </p>
        </div>

        <div class="ns-cookie-category">
          <div class="ns-cookie-cat-top">
            <span class="ns-cookie-cat-name">2. Performance &amp; Local Analytics</span>
            <label class="ns-cookie-toggle">
              <input type="checkbox" id="ns-pref-analytics" ${existing.analytics ? "checked" : ""}>
              <span>Enable</span>
            </label>
          </div>
          <p class="ns-cookie-cat-desc">
            Allows anonymous performance metrics to measure response times and AI inference health. Never linked to your student identity or sold to third parties.
          </p>
        </div>

        <div class="ns-cookie-category">
          <div class="ns-cookie-cat-top">
            <span class="ns-cookie-cat-name">3. Personalization &amp; Interface State</span>
            <label class="ns-cookie-toggle">
              <input type="checkbox" id="ns-pref-personalization" ${existing.personalization ? "checked" : ""}>
              <span>Enable</span>
            </label>
          </div>
          <p class="ns-cookie-cat-desc">
            Remembers your chosen career path filters, UI theme preferences, and collapsed sidebar preferences across visits on this device.
          </p>
        </div>

        <div class="ns-cookie-modal-footer">
          <button type="button" class="ns-cookie-btn ns-cookie-btn-secondary" id="ns-modal-reject-all">Reject Optional</button>
          <button type="button" class="ns-cookie-btn ns-cookie-btn-primary" id="ns-modal-save">Save Preferences</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const closeBtn = document.getElementById("ns-cookie-modal-close-btn");
    closeBtn?.focus();

    closeBtn?.addEventListener("click", hideModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) hideModal();
    });

    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        hideModal();
        document.removeEventListener("keydown", onKey);
      }
    });

    document.getElementById("ns-modal-reject-all")?.addEventListener("click", () => {
      saveConsent({ analytics: false, personalization: false });
    });

    document.getElementById("ns-modal-save")?.addEventListener("click", () => {
      const analytics = document.getElementById("ns-pref-analytics")?.checked || false;
      const personalization = document.getElementById("ns-pref-personalization")?.checked || false;
      saveConsent({ analytics, personalization });
    });
  }

  function hideModal() {
    const backdrop = document.getElementById("ns-cookie-modal-backdrop");
    if (backdrop) backdrop.remove();
  }

  // Expose global open handler for footer links
  window.openCookieSettings = showModal;

  // Listen for click on elements with data-open-cookie-settings
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-open-cookie-settings]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showModal();
      });
    });

    // Check if consent already recorded
    const existing = getConsent();
    if (!existing) {
      // Small timeout for smooth experience
      setTimeout(showBanner, 600);
    }
  });
})();
