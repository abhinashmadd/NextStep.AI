const API_BASE = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "3000"))
  ? "http://127.0.0.1:3000"
  : "";
const stateUrl = `${API_BASE}/api/state`;
const symbols = {
  Project: "▣", Coursework: "▤", Assignment: "▧", Internship: "◷",
  "GitHub repository": "⌘", Certificate: "✳", Report: "▤", Portfolio: "◫", Other: "＋",
};
let currentState = null;
let toastTimeout = null;
let careerCatalog = [];
let currentSkillFilter = "all";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function relativeDate(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3400);
}

async function api(path, body) {
  const url = path.startsWith("http://") || path.startsWith("https://") ? path : `${API_BASE}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't connect to NextStep backend (http://127.0.0.1:3000). Check that the server is running and try again.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function renderProfile() {
  const user = currentState.currentUser;
  const profile = currentState.profile;
  const content = $("#profile-content");

  const initial = user
    ? user.name.trim().charAt(0).toUpperCase()
    : profile
      ? profile.name.trim().charAt(0).toUpperCase()
      : "N";
  const displayName = user ? user.name : (profile ? profile.name : "Your workspace");
  const badgeLabel = user ? (user.badgeId || "Verified student") : "Student account";

  $("#sidebar-name").textContent = displayName;
  $("#sidebar-avatar").textContent = initial;
  $("#top-avatar").textContent = initial;
  $("#top-avatar").title = user ? `${user.name} (${user.badgeId}) · NextStep Student Session Active` : "Student profile & NextStep security";
  const sublabel = document.querySelector("#sidebar-account-btn span");
  if (sublabel) sublabel.textContent = badgeLabel;

  const heroRole = $("#hero-role-name");
  if (heroRole) {
    heroRole.textContent = profile ? profile.targetRole : "Software Developer";
  }

  if (!profile) {
    content.innerHTML = `<div class="profile-empty"><p>Set a destination, and we'll make your career journey personal to you.</p><button class="empty-link" data-open-profile>Set up your profile →</button></div>`;
    $("#welcome-title").textContent = user ? `Welcome, ${user.name.split(/\s+/)[0]}.` : "Your next chapter starts here.";
    $("#welcome-subtitle").textContent = user ? `Signed in with Student ID ${user.badgeId}.` : "A little progress, backed by real work, goes a long way.";
    return;
  }
  $("#welcome-title").textContent = `Good to have you here, ${user ? user.name.split(/\s+/)[0] : profile.name.split(/\s+/)[0]}.`;
  $("#welcome-subtitle").textContent = `Small, evidence-backed steps toward becoming a ${profile.targetRole}.`;
  const tags = [
    profile.course,
    ...(profile.discipline ? [profile.discipline] : []),
    profile.year,
    ...(profile.semester ? [`Semester ${profile.semester}`] : []),
    profile.targetRole,
    ...(profile.availableHours ? [`${profile.availableHours} hrs/week`] : []),
    ...(profile.learningStyle ? [profile.learningStyle] : []),
    ...(profile.skills || []).map((skill) => `Learning: ${skill}`),
    ...(profile.interests ? profile.interests.split(/,\s*/).slice(0, 2) : []),
  ];
  content.innerHTML = `
    <div class="profile-summary"><div class="profile-avatar">${escapeHtml(initial)}</div><div><div class="profile-name">${escapeHtml(profile.name)}</div><div class="profile-meta">${escapeHtml(profile.bio || `Working toward a ${profile.targetRole} career.`)}</div></div></div>
    <div class="profile-details">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderReadiness() {
  const report = currentState.skillReport;
  const content = $("#readiness-content");
  if (!report) {
    content.innerHTML = `<div class="readiness-empty"><p>Add real work to get your first evidence-based readiness snapshot.</p><button class="empty-link" data-open-evidence>Add your first evidence →</button></div>`;
    return;
  }
  const percent = Math.max(0, Math.min(100, report.readiness));
  const qualityNote = report.evidenceQuality === "insufficient-role-relevance"
    ? "Your current work has not shown target-role keywords yet, so this coverage estimate is not reliable. Add a role-related work sample."
    : "Prototype estimate from evidence keywords, not a verified assessment or hiring score.";
  content.innerHTML = `
    <div class="readiness-meter"><div class="meter-ring" style="--progress:${percent * 3.6}deg"><span class="meter-value">${percent}%</span></div>
    <div class="readiness-copy"><strong>${percent}% of required skill levels covered</strong><p>${escapeHtml(report.career?.name || "Target career")} · version ${escapeHtml(report.career?.version || "1.0")}. ${escapeHtml(qualityNote)}</p><div class="mini-progress"><span style="width:${percent}%"></span></div></div></div>`;
}

function renderEvidence() {
  const evidence = currentState.evidence || [];
  $("#evidence-count").textContent = evidence.length;
  const container = $("#evidence-list");
  if (!evidence.length) {
    container.innerHTML = `<div class="evidence-empty"><div class="evidence-empty-copy"><strong>Your best work belongs here.</strong><p>Projects, assignments, GitHub repos, internships — start with anything you're proud of.</p></div><button class="empty-link" data-open-evidence>Add your first piece →</button></div>`;
    return;
  }
  container.innerHTML = evidence.slice(0, 4).map((item) => `
    <article class="evidence-item">
      <div class="evidence-icon">${escapeHtml(symbols[item.type] || symbols.Other)}</div>
      <div><div class="evidence-title">${escapeHtml(item.title)}</div><div class="evidence-meta">${escapeHtml(item.type)} · Added ${relativeDate(item.createdAt)}</div>${item.description ? `<div class="evidence-description">${escapeHtml(item.description.slice(0, 240))}${item.description.length > 240 ? "…" : ""}</div>` : ""}${item.link ? `<a class="resource-link evidence-url" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Open linked work ↗</a>` : ""}</div>
      ${item.fileName ? item.fileStored
        ? `<span class="evidence-controls"><a class="file-chip" href="${API_BASE}/api/evidence/${encodeURIComponent(item.id)}/file" title="Download ${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)} ↓</a><button class="delete-evidence" type="button" data-delete-evidence="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">×</button></span>`
        : `<span class="evidence-controls"><span class="file-chip" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</span><button class="delete-evidence" type="button" data-delete-evidence="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">×</button></span>`
        : `<button class="delete-evidence" type="button" data-delete-evidence="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}">×</button>`}</article>`).join("");
  if (evidence.length > 4) container.insertAdjacentHTML("beforeend", `<div class="activity-empty">And ${evidence.length - 4} more ${evidence.length - 4 === 1 ? "piece" : "pieces"} of evidence in your profile.</div>`);
}

function renderAction() {
  const action = currentState.recommendedAction;
  const container = $("#action-content");
  if (!action) {
    if (currentState.skillReport?.readiness === 100) {
      container.innerHTML = `<div class="action-empty"><div><strong>All skills in this role framework have evidence.</strong><p>This is not a hiring score or guarantee of readiness. Keep building relevant work, or choose another target career.</p></div><button class="button button-outline" data-open-profile>Review my career →</button></div>`;
      return;
    }
    container.innerHTML = `<div class="action-empty"><div><strong>${currentState.evidence.length ? "Your next step is one click away." : "No giant roadmap. Just your next right move."}</strong><p>${currentState.evidence.length ? "Connect your evidence to your target role to find the most useful skill to work on next." : "Start with your profile and a piece of real work. We'll help you choose one practical step from there."}</p></div><button class="button button-dark" ${currentState.evidence.length ? 'data-analyze' : 'data-open-profile'}>${currentState.evidence.length ? "Find my next action →" : "Get started →"}</button></div>`;
    return;
  }
  container.innerHTML = `
    <article class="action-card">
      <div>
        <div class="action-label">${action.completed ? "ACTION COMPLETED" : "RECOMMENDED FOR YOU"} · ${escapeHtml(action.skill).toUpperCase()}</div>
        <h3>${escapeHtml(action.title)}</h3>
        <p class="action-reason">${escapeHtml(action.reason)}</p>
        <div class="outcome-label">WHAT YOU'LL MAKE</div>
        <p class="outcome-copy">${escapeHtml(action.outcome)}</p>

        <div class="action-toolbox">
          <button class="button button-outline action-tool-btn" type="button" data-open-blueprint="true"><span>⚡</span> View Project Blueprint</button>
          <button class="button button-outline action-tool-btn" type="button" data-copy-action="true"><span>📋</span> Copy Steps</button>
          <button class="button button-outline action-tool-btn" type="button" data-proof-for-skill="${escapeHtml(action.skill)}"><span>＋</span> Submit Proof</button>
          <button class="button button-outline action-tool-btn" type="button" data-export-plan="true"><span>📄</span> Export Plan (.md)</button>
        </div>

        <div class="action-blueprint-card" id="action-blueprint" style="display: none;">
          <div class="blueprint-header">
            <div>
              <span class="blueprint-kicker">STEP-BY-STEP BLUEPRINT</span>
              <h4>${escapeHtml(action.title)}</h4>
            </div>
            <span class="blueprint-badge">${escapeHtml(action.skill)}</span>
          </div>
          <p class="blueprint-intro">${escapeHtml(action.outcome)}</p>
          <div class="blueprint-section">
            <strong>Execution Checklist:</strong>
            <ul class="blueprint-checklist">
              ${action.steps.map((s, idx) => `
                <li>
                  <label>
                    <input type="checkbox" data-step-check="${idx}">
                    <span><strong>Step ${idx + 1}:</strong> ${escapeHtml(s)}</span>
                  </label>
                </li>`).join("")}
            </ul>
          </div>
          <div class="blueprint-meta-grid">
            <div><strong>Estimated Time:</strong> ${escapeHtml(action.estimatedEffortHours || 8)} hours</div>
            <div><strong>Expected Proof:</strong> ${(action.expectedEvidence || []).join(", ")}</div>
          </div>
        </div>

        ${action.completed ? `<div class="completed-banner">✓ Completed ${relativeDate(action.completedAt)}. ${action.reflection ? escapeHtml(action.reflection) : "Add your new work as evidence, then refresh your skills for a personalized next step."}</div>` : `<div class="action-footer"><button class="button button-dark" data-complete>I've done this <span>✓</span></button><button class="button button-quiet" data-analyze>Refresh my action</button></div>`}
      </div>
      <div class="action-side">
        <div class="outcome-label">A FEW WAYS TO GET STARTED</div>
        <ol class="action-steps">${action.steps.map((step, index) => `<li><span>0${index + 1}</span>${escapeHtml(step)}</li>`).join("")}</ol>
        <div class="outcome-label">EVIDENCE TO SUBMIT</div>
        <ul class="expected-evidence">${(action.expectedEvidence || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <div class="effort-label">ESTIMATED EFFORT <strong>${escapeHtml(action.estimatedEffortHours || "—")} hours</strong> · ${action.feasibility?.fitsAvailableTime === null ? "add weekly availability to check fit" : action.feasibility?.fitsAvailableTime ? "fits your available time" : "may need to be split into smaller steps"}</div>
        <div class="outcome-label">HELPFUL RESOURCES</div>
        <div class="resource-links">${action.resources.map((resource) => `<a class="resource-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.label)} ↗</a>`).join("")}</div>
      </div>
    </article>`;
}

function renderSkills() {
  const report = currentState.skillReport;
  const container = $("#skills-list");
  if (!report) {
    container.innerHTML = `<div class="skill-empty">Your skill map will grow from your work, not just what you say you can do. Add evidence and analyze it to see capabilities you've demonstrated.</div>`;
    return;
  }

  let filteredSkills = report.skills || [];
  if (currentSkillFilter === "gaps") {
    filteredSkills = filteredSkills.filter((s) => s.status === "missing" || s.status === "claimed-unverified" || s.status === "partial");
  } else if (currentSkillFilter === "demonstrated") {
    filteredSkills = filteredSkills.filter((s) => s.status === "demonstrated");
  }

  if (filteredSkills.length === 0) {
    container.innerHTML = `<div class="skill-empty" style="text-align: center; padding: 24px;">No skills matching "${escapeHtml(currentSkillFilter)}" filter.</div>`;
    return;
  }

  container.innerHTML = filteredSkills.map((skill) => {
    const statusLabel = {
      demonstrated: "Demonstrated",
      partial: "Partially demonstrated",
      "claimed-unverified": "Claimed / unverified",
      missing: "Missing",
    }[skill.status] || "Not assessed";
    const evidence = skill.evidenceTitles?.length
      ? `Evidence: ${skill.evidenceTitles.join(", ")}`
      : skill.claim ? `Self-reported level ${skill.claim.level}/3 · ${skill.claim.confidenceLabel} confidence` : "No evidence yet";
    return `<div class="skill-row ${skill.status === "missing" || skill.status === "claimed-unverified" ? "gap" : ""}">
      <span class="skill-name">
        ${escapeHtml(skill.name)}
        <span class="skill-status">${escapeHtml(statusLabel)} · Level ${skill.level}/${skill.requiredLevel} required</span>
        <span class="skill-evidence" title="${escapeHtml(evidence)}">${escapeHtml(evidence)}</span>
        <button class="skill-action-link" type="button" data-proof-for-skill="${escapeHtml(skill.name)}">+ Add proof</button>
      </span>
      <div class="skill-track"><div class="skill-fill" style="width:${skill.score}%"></div></div>
      <span class="skill-score">${Math.round(skill.confidence * 100)}%<span class="confidence-caption">confidence</span></span>
    </div>`;
  }).join("");
}

function renderAssessment() {
  const summary = $("#assessment-summary");
  if (!currentState.assessment.length) {
    summary.innerHTML = `<p>No self-assessment yet. Your skill claims remain separate from evidence-backed capabilities.</p>`;
    return;
  }
  summary.innerHTML = currentState.assessment.map((item) =>
    `<span class="assessment-chip">${escapeHtml(item.skill)} · level ${item.level}/3 · ${escapeHtml(item.confidenceLabel)} confidence <span>Claimed / unverified unless supported by work</span></span>`,
  ).join("");
}

function renderChangeLog() {
  const container = $("#change-list");
  if (!currentState.changeLog?.length) {
    container.innerHTML = `<div class="activity-empty">When new evidence changes a skill estimate, the previous and updated states will appear here.</div>`;
    return;
  }
  container.innerHTML = currentState.changeLog.slice(0, 4).map((entry) =>
    `<article class="change-item"><div class="change-date">${relativeDate(entry.createdAt)}</div><div class="change-content">${entry.changes.map((change) => `<div><strong>${escapeHtml(change.skill)}</strong><span>${escapeHtml(change.previousStatus.replaceAll("-", " "))} · level ${change.previousLevel ?? "—"} → ${escapeHtml(change.newStatus.replaceAll("-", " "))} · level ${change.newLevel ?? "—"}</span><small>${Math.round(change.confidence * 100)}% estimate confidence</small></div>`).join("")}<p>Next priority: ${escapeHtml(entry.nextSkill)}</p></div></article>`,
  ).join("");
}

function renderActivity() {
  const container = $("#activity-list");
  if (!currentState.activity?.length) {
    container.innerHTML = `<div class="activity-empty">Your milestones will show up here as you make progress.</div>`;
    return;
  }
  container.innerHTML = currentState.activity.slice(0, 5).map((item) =>
    `<div class="activity-item"><span class="activity-dot"></span><span>${escapeHtml(item.message)}</span><time class="activity-time">${relativeDate(item.createdAt)}</time></div>`,
  ).join("");
}

function renderJourney() {
  const steps = {
    profile: Boolean(currentState.profile),
    evidence: currentState.evidence.length > 0,
    analysis: Boolean(currentState.skillReport),
    action: Boolean(currentState.recommendedAction),
    loop: Boolean(currentState.recommendedAction?.completed),
  };
  const completed = Object.values(steps).filter(Boolean).length;
  $("#journey-progress-label").textContent = `${completed} of 5 steps`;
  document.querySelectorAll(".journey-step").forEach((step) => {
    const key = step.dataset.step;
    step.classList.toggle("is-done", steps[key]);
    step.classList.toggle("is-active", !steps[key] && Object.keys(steps).slice(0, Object.keys(steps).indexOf(key)).every((previous) => steps[previous]));
  });
}

function render() {
  renderProfile();
  renderReadiness();
  renderEvidence();
  renderAction();
  renderSkills();
  renderAssessment();
  renderChangeLog();
  renderActivity();
  renderJourney();
  const firstActionDone = Boolean(currentState.recommendedAction?.completed);
  $("#quick-start").innerHTML = currentState.profile
    ? `<span>＋</span> Add evidence` : `<span>＋</span> Set up my profile`;
  $("#quick-start").dataset.open = currentState.profile ? "evidence" : "profile";
  $("#edit-profile").textContent = currentState.profile ? "Edit profile ↗" : "Set up ↗";
  document.querySelectorAll('[data-section="action"]').forEach((link) => link.classList.toggle("active", Boolean(currentState.recommendedAction && !firstActionDone)));
  const selectedSection = location.hash.slice(1) || "overview";
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.section === selectedSection));
}

const fallbackCareers = [
  { id: "software-developer", name: "Software Developer", domain: "Technology", version: "1.0", source: "NextStep prototype competency framework", reviewed: "2026-10-08", skillCount: 7 },
  { id: "embedded-systems", name: "Embedded Systems Engineer", domain: "Engineering", version: "1.0", source: "NextStep prototype competency framework", reviewed: "2026-10-08", skillCount: 7 },
  { id: "financial-analyst", name: "Financial Analyst", domain: "Business", version: "1.0", source: "NextStep prototype competency framework", reviewed: "2026-10-08", skillCount: 6 },
  { id: "ux-researcher", name: "UX Researcher", domain: "Arts & Design", version: "1.0", source: "NextStep prototype competency framework", reviewed: "2026-10-08", skillCount: 6 },
];

async function refresh() {
  try {
    const result = await api("/api/careers");
    careerCatalog = result.careers || fallbackCareers;
  } catch {
    careerCatalog = fallbackCareers;
  }
  populateCareerOptions();
  currentState = await api(stateUrl);
  render();
  if (!currentState.privacy?.consent?.accepted && !$("#consent-dialog").open) $("#consent-dialog").showModal();
}

function populateCareerOptions() {
  const select = $("#career-select");
  const selected = select.value;
  select.innerHTML = `<option value="">Choose your target career</option>${careerCatalog.map((career) => `<option value="${escapeHtml(career.id)}">${escapeHtml(career.name)} · ${escapeHtml(career.domain)}</option>`).join("")}`;
  if (selected && careerCatalog.some((career) => career.id === selected)) select.value = selected;
  updateCareerSource();
}

function updateCareerSource() {
  const career = careerCatalog.find((item) => item.id === $("#career-select").value);
  $("#career-source").textContent = career
    ? `Framework v${career.version} · ${career.domain} · ${career.skillCount} requirements · ${career.source} · reviewed ${career.reviewed}. Prototype knowledge, not live labor-market data.`
    : "Prototype frameworks support four roles and include source/version notes; unsupported careers aren't inferred.";
}

function renderAssessmentForm() {
  const definition = careerCatalog.find((item) => item.id === currentState.profile?.careerId);
  if (!definition) {
    showToast("Create a profile and choose a supported target career first.", true);
    return false;
  }
  const existing = new Map(currentState.assessment.map((item) => [item.skill, item]));
  const stateSkills = currentState.skillReport?.skills;
  $("#assessment-fields").innerHTML = `<p class="assessment-role">Self-assessing for <strong>${escapeHtml(definition.name)}</strong>. Self-reported skills do not change evidence status.</p>${definition.skills.map((skill, index) => {
    const claim = existing.get(skill.name);
    const status = stateSkills?.find((entry) => entry.name === skill.name)?.status;
    return `<div class="assessment-entry"><label for="assessment-level-${index}">${escapeHtml(skill.name)}<span>Evidence: ${escapeHtml(status ? ({ demonstrated: "demonstrated", partial: "partially demonstrated", "claimed-unverified": "claimed / unverified", missing: "not found yet" })[status] || "not assessed" : "not assessed yet")}</span></label><select id="assessment-level-${index}" data-assessment-skill="${escapeHtml(skill.name)}"><option value="0">No self-rating</option><option value="1" ${claim?.level === 1 ? "selected" : ""}>Beginner</option><option value="2" ${claim?.level === 2 ? "selected" : ""}>Intermediate</option><option value="3" ${claim?.level === 3 ? "selected" : ""}>Advanced</option></select><select aria-label="Confidence in ${escapeHtml(skill.name)}" data-assessment-confidence="${escapeHtml(skill.name)}"><option value="low" ${claim?.confidenceLabel === "low" ? "selected" : ""}>Low confidence</option><option value="medium" ${!claim || claim.confidenceLabel === "medium" ? "selected" : ""}>Medium confidence</option><option value="high" ${claim?.confidenceLabel === "high" ? "selected" : ""}>High confidence</option></select></div>`;
  }).join("")}`;
  return true;
}

async function showPrivacyCenter() {
  try {
    const privacy = await api("/api/privacy");
    $("#privacy-details").innerHTML = `
      <div><strong>Consent</strong><span>${privacy.consent?.accepted ? `Accepted ${relativeDate(privacy.consent.acceptedAt)}` : "Not accepted"}</span></div>
      <div><strong>Evidence</strong><span>${privacy.storedEvidence} items · ${privacy.storedFiles} attached files</span></div>
      <div><strong>Processing</strong><span>${escapeHtml(privacy.analysisMethod)}</span></div>
      <div><strong>External AI / model training</strong><span>Disabled</span></div>
      <div><strong>Retention</strong><span>${escapeHtml(privacy.retention)}</span></div>`;
    const exportLink = $("#privacy-dialog a[href*='export']");
    if (exportLink) exportLink.href = `${API_BASE}/api/privacy/export`;
    $("#privacy-dialog").showModal();
  } catch (error) {
    showToast(error.message, true);
  }
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (id === "profile-dialog") {
    const consentDlg = $("#consent-dialog");
    if (consentDlg && consentDlg.open) consentDlg.close();

    const form = $("#profile-form");
    const user = currentState?.currentUser || (() => {
      try { return JSON.parse(localStorage.getItem("nextstep_user")); } catch { return null; }
    })();

    if (currentState?.profile) {
      for (const key of ["name", "course", "discipline", "year", "semester", "careerId", "availableHours", "learningStyle", "interests", "bio"]) {
        if (form.elements[key]) form.elements[key].value = currentState.profile[key] || "";
      }
      if (form.elements["skills"]) {
        form.elements["skills"].value = (currentState.profile.skills || []).join(", ");
      }
    } else if (user) {
      if (form.elements["name"] && !form.elements["name"].value) {
        form.elements["name"].value = user.name || "";
      }
      if (form.elements["careerId"] && !form.elements["careerId"].value && user.role) {
        const roleMap = {
          "Software Developer": "software-developer",
          "Embedded Systems Engineer": "embedded-systems",
          "Financial Analyst": "financial-analyst",
          "UX Researcher": "ux-researcher",
        };
        if (roleMap[user.role]) form.elements["careerId"].value = roleMap[user.role];
      }
    }
  }
  if (id === "evidence-dialog") $("#evidence-form")?.reset();
  if (id === "complete-dialog") $("#complete-form")?.reset();
  if (!dialog.open) {
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }
}

async function submitForm(form, endpoint, payload, successMessage) {
  const submit = form.querySelector('[type="submit"]');
  const originalText = submit.innerHTML;
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    currentState = await api(endpoint, payload);
    form.closest("dialog").close();
    render();
    showToast(successMessage);
    return true;
  } catch (error) {
    showToast(error.message, true);
    return false;
  } finally {
    submit.disabled = false;
    submit.innerHTML = originalText;
  }
}

$("#consent-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    currentState = await api("/api/privacy/consent", { accepted: true });
    $("#consent-dialog").close();
    await refresh();
    showToast("Privacy notice accepted. Your data stays on this device.");
  } catch (error) {
    showToast(error.message, true);
  }
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const rawSkills = values.get("skills");
  const skillsList = rawSkills
    ? rawSkills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const ok = await submitForm(form, "/api/profile", {
    name: values.get("name").trim(),
    course: values.get("course").trim(),
    year: values.get("year"),
    discipline: (values.get("discipline") || "General Studies").trim(),
    semester: (values.get("semester") || "").trim(),
    careerId: values.get("careerId"),
    availableHours: values.get("availableHours") ? Number(values.get("availableHours")) : null,
    learningStyle: values.get("learningStyle") || "",
    skills: skillsList,
    interests: (values.get("interests") || "").trim(),
    bio: (values.get("bio") || "").trim(),
  }, currentState?.evidence?.length
    ? "Profile saved. Your skill map and next action are up to date."
    : "Profile saved! Your baseline skill map and Next Best Action are ready.");
});

$("#evidence-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const file = values.get("file");
  let content = "";
  let fileData = "";
  if (file?.size) {
    if (file.size > 1024 * 1024) {
      showToast("Files must be 1 MB or smaller in this demo.", true);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      fileData = btoa(binary);
      if (/\.(txt|md|csv|json|html|css|js|py|java|ts|tsx|jsx)$/i.test(file.name)) {
        content = (await file.text()).replace(/^\uFEFF/, "").slice(0, 20000);
      }
    } catch {
      showToast("Couldn't read that file. Try again or add its key details in the description.", true);
      return;
    }
  }
  const ok = await submitForm(form, "/api/evidence", {
    title: values.get("title").trim(),
    type: values.get("type"),
    description: values.get("description").trim(),
    link: values.get("link").trim(),
    fileName: file?.size ? file.name : "",
    fileData,
    content,
  }, currentState.profile
    ? "Evidence added. Your skill map and next action are up to date."
    : "Evidence added. Set up your profile to discover your next action.");
});

$("#assessment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const skills = [...form.querySelectorAll("[data-assessment-skill]")].map((field) => ({
    skill: field.dataset.assessmentSkill,
    level: Number(field.value),
    confidence: form.querySelector(`[data-assessment-confidence="${CSS.escape(field.dataset.assessmentSkill)}"]`).value,
  })).filter((item) => item.level > 0);
  await submitForm(form, "/api/assessment", { skills }, "Self-assessment saved separately from your demonstrated capabilities.");
});

$("#complete-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  await submitForm(form, "/api/complete-action", { reflection: values.get("reflection").trim() }, "Nice work. Add what you built as evidence to find your next action.");
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button,a,[data-open-profile],[data-step='profile']");
  if (!target) return;
  if (target.classList.contains("close-dialog") || target.classList.contains("cancel-dialog")) {
    target.closest("dialog")?.close();
    return;
  }
  if (target.id === "top-avatar" || target.closest("#top-avatar") || target.id === "sidebar-account-btn" || target.closest("#sidebar-account-btn")) {
    window.location.href = "./profile.html";
    return;
  }
  if (target.id === "quick-start") {
    if (currentState?.profile) {
      openDialog("evidence-dialog");
    } else {
      openDialog("profile-dialog");
    }
    return;
  }
  if (target.id === "hero-switch-role" || target.hasAttribute("data-open-profile") || target.dataset.step === "profile" || target.id === "edit-profile" || target.dataset.open === "profile") {
    openDialog("profile-dialog");
    return;
  }
  if (target.hasAttribute("data-open-evidence") || target.id === "add-evidence" || target.dataset.open === "evidence") {
    openDialog("evidence-dialog");
    return;
  }

  // 1-Click Load Sample Project Evidence
  if (target.id === "load-sample-evidence") {
    target.disabled = true;
    const oldText = target.innerHTML;
    target.innerHTML = "<span>⏳</span> Adding sample…";
    try {
      const careerId = currentState?.profile?.careerId || "software-developer";
      const sampleCatalog = {
        "software-developer": {
          title: "TaskFlow: Full-Stack Task Manager & REST API",
          type: "Project",
          description: "Developed a full-stack task management application using JavaScript, Node.js, Express, and PostgreSQL. Created REST API endpoints with robust error handling and JWT authentication. Implemented unit tests using Jest and containerized with Docker.",
          link: "https://github.com/student/taskflow-service",
          fileName: "server.js",
          content: "const express = require('express');\nconst app = express();\n// TaskFlow API Router\napp.get('/api/tasks', (req, res) => res.json({ tasks: [] }));\napp.post('/api/tasks', (req, res) => res.status(201).json({ success: true }));\nmodule.exports = app;",
        },
        "data-analyst": {
          title: "E-Commerce Customer Retention & Sales Analysis",
          type: "Project",
          description: "Analyzed 50,000+ transactional records using Python, Pandas, and SQL. Built interactive cohort retention heatmaps and Tableau dashboard tracking customer churn, CLV, and gross merchandise value.",
          link: "https://github.com/student/ecommerce-retention-analysis",
          fileName: "analysis.py",
          content: "import pandas as pd\nimport numpy as np\ndf = pd.read_csv('orders.csv')\nretention_rate = df.groupby('cohort')['customer_id'].nunique()\nprint(retention_rate)",
        },
        "data-scientist": {
          title: "Predictive House Price Regression Model & Feature Engineering",
          type: "Project",
          description: "Trained Random Forest and XGBoost regression models on real estate housing features with scikit-learn. Performed cross-validation, feature scaling, and deployed an inference REST API endpoint.",
          link: "https://github.com/student/house-price-prediction",
          fileName: "model.py",
          content: "from sklearn.ensemble import RandomForestRegressor\nfrom sklearn.model_selection import train_test_split\nmodel = RandomForestRegressor(n_estimators=100)\nmodel.fit(X_train, y_train)",
        },
        "product-manager": {
          title: "Campus Marketplace PRD & User Journey Mapping",
          type: "Coursework",
          description: "Authored comprehensive Product Requirement Document (PRD) for a peer-to-peer textbook marketplace. Conducted 15 user interviews, synthesized user personas, prioritized backlog using RICE matrix, and designed wireframes.",
          link: "https://www.figma.com/file/campus-marketplace-prd",
          fileName: "prd-spec.md",
          content: "# Product Requirement Document: Campus Marketplace\n## Problem Statement\nStudents struggle to resell course materials affordably.\n## Metrics & OKRs\n- MAU > 10,000\n- Trade completion rate > 80%",
        },
      };
      const sample = sampleCatalog[careerId] || sampleCatalog["software-developer"];
      currentState = await api("/api/evidence", sample);
      render();
      showToast("✨ Sample project evidence loaded! See how your readiness score and skill map updated.");
    } catch (err) {
      showToast(err.message, true);
    } finally {
      target.disabled = false;
      target.innerHTML = oldText;
    }
    return;
  }

  // Toggle Project Blueprint Drawer
  if (target.hasAttribute("data-open-blueprint")) {
    const blueprint = $("#action-blueprint");
    if (blueprint) {
      const isHidden = blueprint.style.display === "none";
      blueprint.style.display = isHidden ? "block" : "none";
      target.classList.toggle("active", isHidden);
    }
    return;
  }

  // Copy Action Steps
  if (target.hasAttribute("data-copy-action")) {
    const action = currentState?.recommendedAction;
    if (action) {
      const stepsText = action.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const text = `NextStep Action: ${action.title}\nOutcome: ${action.outcome}\n\nSteps:\n${stepsText}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast("📋 Action steps copied to clipboard!");
      } else {
        showToast("Action steps ready to execute!");
      }
    }
    return;
  }

  // Export Action Plan as Markdown
  if (target.hasAttribute("data-export-plan")) {
    const action = currentState?.recommendedAction;
    if (action) {
      const md = `# NextStep Action Plan: ${action.title}\n\n` +
        `**Target Career:** ${currentState.profile?.targetRole || "Career"}\n` +
        `**Skill Focus:** ${action.skill}\n` +
        `**Estimated Effort:** ${action.estimatedEffortHours || 8} hours\n\n` +
        `## Outcome / What You Will Build\n${action.outcome}\n\n` +
        `## Why This Matters\n${action.reason}\n\n` +
        `## Step-by-Step Implementation\n${action.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
        `## Evidence to Upload When Completed\n${(action.expectedEvidence || []).map((e) => `- ${e}`).join("\n")}\n\n` +
        `## Helpful Learning Resources\n${action.resources.map((r) => `- [${r.label}](${r.url})`).join("\n")}\n`;

      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const dlLink = document.createElement("a");
      dlLink.href = URL.createObjectURL(blob);
      dlLink.download = `NextStep-Action-${action.skill.replace(/[^a-zA-Z0-9]+/g, "-")}.md`;
      dlLink.click();
      showToast("📄 Action plan downloaded (.md)!");
    }
    return;
  }

  // Direct Evidence Proof shortcut for specific skill
  if (target.hasAttribute("data-proof-for-skill")) {
    const skillName = target.getAttribute("data-proof-for-skill");
    openDialog("evidence-dialog");
    const form = $("#evidence-form");
    if (form) {
      form.elements["title"].value = `${skillName} Implementation`;
      form.elements["description"].value = `Demonstrating hands-on competency in ${skillName} with real code or project artifact.`;
    }
    return;
  }

  // Skill Map Filter Tabs
  if (target.classList.contains("skill-filter-btn")) {
    document.querySelectorAll(".skill-filter-btn").forEach((btn) => btn.classList.remove("active"));
    target.classList.add("active");
    currentSkillFilter = target.dataset.filter || "all";
    renderSkills();
    return;
  }

  if (target.hasAttribute("data-complete")) {
    openDialog("complete-dialog");
    return;
  }
  if (target.hasAttribute("data-analyze")) {
    target.disabled = true;
    const originalText = target.textContent;
    target.textContent = "Finding your next step…";
    try {
      currentState = await api("/api/analyze", {});
      render();
      showToast("Your skill map and next best action are ready.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      if (target.isConnected) {
        target.disabled = false;
        target.textContent = originalText;
      }
    }
  }
});

$("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.querySelectorAll(".main-nav .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    $("#sidebar").classList.remove("open");
    if (link.dataset.section === "privacy") {
      showPrivacyCenter();
      return;
    }
    if (link.dataset.section === "profile") {
      if (!currentState?.profile) {
        openDialog("profile-dialog");
      }
      return;
    }
    if (link.dataset.section === "assessment") {
      if (!renderAssessmentForm()) return;
      openDialog("assessment-dialog");
    }
  });
});

$("#edit-assessment").addEventListener("click", () => {
  if (renderAssessmentForm()) openDialog("assessment-dialog");
});

$("#career-select").addEventListener("change", updateCareerSource);

$("#delete-account").addEventListener("click", async () => {
  if (!window.confirm("Withdraw consent and permanently delete all NextStep profile, assessment, evidence, uploaded files, analysis, and recommendation data from this device?")) return;
  try {
    await fetch(`${API_BASE}/api/privacy/account`, { method: "DELETE" }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Your data could not be deleted.");
      }
    });
    $("#privacy-dialog").close();
    currentState = await api(stateUrl);
    render();
    $("#consent-dialog").showModal();
    showToast("Your profile, files, and derived data have been deleted.");
  } catch (error) {
    showToast(error.message, true);
  }
});

$("#evidence-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-evidence]");
  if (!button || !window.confirm("Delete this evidence and its attached file? The skill analysis will be cleared until you analyze the remaining evidence.")) return;
  try {
    currentState = await fetch(`${API_BASE}/api/evidence/${encodeURIComponent(button.dataset.deleteEvidence)}`, { method: "DELETE" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Evidence could not be deleted.");
      return result;
    });
    render();
    showToast("Evidence and its derived analysis were deleted.");
  } catch (error) {
    showToast(error.message, true);
  }
});

const today = new Date();
$("#today-label").textContent = `${today.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase()} · YOUR CAREER JOURNEY`;
refresh().catch((error) => {
  showToast(error.message, true);
  $("#profile-content").innerHTML = `<div class="profile-empty"><p>NextStep couldn't load your workspace. Check that the app server is running, then refresh the page.</p></div>`;
});

// Integration with NextStep Student Auth Controller (auth.js)
window.onNextStepAuthSuccess = (user, newState) => {
  if (newState) currentState = newState;
  render();
};

window.onNextStepAuthLogout = async () => {
  currentState = await api(stateUrl);
  render();
};

