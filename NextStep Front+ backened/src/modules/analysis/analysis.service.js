const crypto = require("node:crypto");
const { careers, containsKeyword } = require("../careers/careers.data");
const { addActivity } = require("../../config/database");
const { requireConsent } = require("../../middleware/authMiddleware");
const { AI_BASE_URL } = require("../../config/environment");

async function triggerAIAnalysis(state) {
  if (!state.profile || !careers[state.profile.careerId]) return null;
  const career = careers[state.profile.careerId];
  const studentEvidence = (state.evidence || [])
    .map((e) => `${e.title} ${e.type} ${e.description || ""} ${e.analysisText || ""}`)
    .join("\n");
  const requestBody = {
    student_profile: state.profile,
    target_career: career.name,
    student_evidence: studentEvidence,
    career_requirements: career,
  };
  try {
    const response = await fetch(`${AI_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`AI service error: ${response.status} - ${JSON.stringify(err)}`);
    }
    const result = await response.json();
    state.aiResult = result;
    return result;
  } catch (err) {
    // Gracefully ignore if AI service is not running locally
    return null;
  }
}

function levelForSkill(state, skill, evidenceIds, matchCount) {
  if (evidenceIds.length === 0) {
    const claim = (state.assessment || []).find((item) => item.skill.toLowerCase() === skill.name.toLowerCase());
    return {
      level: 0,
      score: 0,
      status: claim ? "claimed-unverified" : "missing",
      confidence: claim ? Math.min(0.35, 0.12 + claim.confidence * 0.2) : 0.05,
      evidenceIds: [],
      claim: claim ? { level: claim.level, confidence: claim.confidence } : null,
      observations: [],
    };
  }
  const score = Math.min(100, 25 + matchCount * 18 + Math.max(0, evidenceIds.length - 1) * 12);
  const level = score >= 75 ? 3 : score >= 50 ? 2 : 1;
  return {
    level,
    score,
    status: score >= 75 && (matchCount >= 3 || evidenceIds.length >= 2) ? "demonstrated" : "partial",
    confidence: Math.min(0.92, 0.35 + matchCount * 0.09 + Math.max(0, evidenceIds.length - 1) * 0.1),
    evidenceIds,
    claim: null,
    observations: [],
  };
}

function analyze(state) {
  requireConsent(state);
  if (!state.profile) throw Object.assign(new Error("Create your student profile before analyzing your skills."), { status: 400 });

  const career = careers[state.profile.careerId];
  if (!career) throw Object.assign(new Error("Selected career framework not found."), { status: 400 });

  const oldReport = state.skillReport;
  const framework = career.skills;

  const skills = framework.map((skill, index) => {
    const evidenceMatches = (state.evidence || []).map((item) => {
      const text = `${item.title} ${item.type} ${item.description || ""} ${item.analysisText || ""}`.toLowerCase();
      const detectedKeywords = new Set(item.detectedKeywords || []);
      const matchedKeywords = skill.keywords.filter((keyword) =>
        detectedKeywords.has(keyword.toLowerCase()) || containsKeyword(text, keyword.toLowerCase()),
      );
      return matchedKeywords.length ? { item, matchedKeywords } : null;
    }).filter(Boolean);
    const evidenceIds = evidenceMatches.map(({ item }) => item.id);
    const matches = evidenceMatches.flatMap(({ matchedKeywords }) => matchedKeywords);
    const capability = levelForSkill(state, skill, evidenceIds, matches.length);
    return {
      name: skill.name,
      importance: skill.importance,
      requiredLevel: skill.requiredLevel,
      ...capability,
      matchedKeywords: matches,
      prerequisites: skill.prerequisites || [],
      evidenceTitles: evidenceMatches.map(({ item }) => item.title),
    };
  });

  skills.forEach((skill) => {
    skill.dependencyReady = !skill.prerequisites.length || skill.prerequisites.every((prerequisite) =>
      (skills.find((existing) => existing.name === prerequisite)?.level || 0) > 0,
    );
  });

  // Calculate gaps and prioritization
  const allGapCandidates = framework.map((skill, index) => {
    const current = skills[index];
    const gapSeverity = Math.max(0, skill.requiredLevel - current.level) / skill.requiredLevel;
    const fit = state.profile.availableHours ? Math.max(0.25, Math.min(1, state.profile.availableHours / skill.effort)) : 1;
    const prereqsMet = !skill.prerequisites?.length || skill.prerequisites.every((prerequisite) => {
      const parent = skills.find((item) => item.name === prerequisite);
      return parent && parent.level > 0;
    });
    const prerequisiteScore = prereqsMet ? 1.0 : 0.65;
    const uncertainty = current.status === "claimed-unverified" || current.confidence < 0.5 ? 1.15 : 1.0;
    return {
      skill, current, index, gapSeverity, fit, prerequisiteScore, prereqsMet,
      priority: skill.importance * gapSeverity * prerequisiteScore * fit * uncertainty,
    };
  }).filter((candidate) => candidate.gapSeverity > 0);

  // First select from skills whose prerequisites are satisfied, ordered by priority
  const readyCandidates = allGapCandidates.filter((c) => c.prereqsMet).sort((a, b) => b.priority - a.priority);
  let selected = readyCandidates[0];

  // If no ready candidates (e.g. strict prerequisites), pick the highest priority gap overall
  if (!selected && allGapCandidates.length) {
    selected = allGapCandidates.sort((a, b) => b.priority - a.priority)[0];
  }

  const hasRoleRelevantEvidence = skills.some((skill) => skill.evidenceIds && skill.evidenceIds.length > 0);

  if (!selected) {
    // 100% readiness across all skills
    state.skillReport = {
      skills,
      readiness: 100,
      demonstratedCount: skills.filter((skill) => skill.status === "demonstrated" || skill.level > 0).length,
      totalSkills: skills.length,
      gaps: [],
      analyzedAt: new Date().toISOString(),
      evidenceCount: (state.evidence || []).length,
      evidenceQuality: hasRoleRelevantEvidence ? "role-relevant-signals-found" : "insufficient-role-relevance",
      career: { name: career.name, version: career.version, source: career.source, reviewed: career.reviewed },
      method: "deterministic-prototype",
    };
    state.recommendedAction = null;
    addActivity(state, `Career requirements reviewed for ${career.name}; all framework competencies demonstrated.`);
    return state;
  }

  const { skill: prioritySkill, current } = selected;
  const actionTitle = {
    build: `Build a small ${prioritySkill.name} project`,
    learn: `Learn the foundations of ${prioritySkill.name}`,
    practice: `Practice ${prioritySkill.name} with a focused exercise`,
    improve: `Improve your ${prioritySkill.name} evidence`,
    integrate: `Add ${prioritySkill.name} to an existing project`,
    document: `Document your work in ${prioritySkill.name}`,
    analyze: `Create an analysis demonstrating ${prioritySkill.name}`,
  }[prioritySkill.type] || `Build a practical ${prioritySkill.name} project`;

  const reason = current.status === "claimed-unverified"
    ? `You self-reported ${prioritySkill.name}, but your submitted work does not demonstrate it yet. This action turns your claim into verifiable portfolio evidence.`
    : `${prioritySkill.name} is an essential ${career.name} requirement (${Math.round(prioritySkill.importance * 100)}% framework importance) and your profile shows a ${current.status === "missing" ? "gap" : "partial capability"}. ${state.profile.availableHours && prioritySkill.effort > state.profile.availableHours ? `Plan the ${prioritySkill.effort}-hour task across multiple weeks to fit your ${state.profile.availableHours} available hours per week.` : state.profile.availableHours ? `The ${prioritySkill.effort}-hour task fits your available weekly study time.` : `Plan for about ${prioritySkill.effort} hours of focused work.`}`;

  const action = {
    id: crypto.randomUUID(),
    title: actionTitle,
    skill: prioritySkill.name,
    type: prioritySkill.type,
    reason,
    priorityScore: Math.round(selected.priority * 100) / 100,
    careerRequirement: { role: career.name, version: career.version, importance: prioritySkill.importance, requiredLevel: prioritySkill.requiredLevel },
    currentCapability: { status: current.status, level: current.level, confidence: current.confidence, evidenceIds: current.evidenceIds },
    outcome: `A portfolio-ready deliverable demonstrating ${prioritySkill.name.toLowerCase()}, with a short explanation of your design decisions.`,
    expectedEvidence: ["Working project, script, or practice artifact", "README or short report explaining your approach", "Code repository link or uploaded source file"],
    estimatedEffortHours: prioritySkill.effort,
    feasibility: {
      weeklyHoursAvailable: state.profile.availableHours,
      fitsAvailableTime: state.profile.availableHours ? prioritySkill.effort <= state.profile.availableHours : null,
    },
    steps: [
      `Choose one small, practical problem in ${career.name} that exercises ${prioritySkill.name.toLowerCase()}.`,
      `Build a working solution demonstrating correct patterns and principles.`,
      `Document what you built, what you learned, and upload the source or link as new evidence.`,
    ],
    resources: [
      { label: `Search ${prioritySkill.name} tutorial & docs`, url: `https://www.google.com/search?q=${encodeURIComponent(`${prioritySkill.name} beginner project tutorial`)}` },
      { label: "Browse project ideas on GitHub", url: "https://github.com/topics/beginner-project" },
    ],
    createdAt: new Date().toISOString(),
    completed: false,
  };

  if (!hasRoleRelevantEvidence) {
    action.title = `Create a starter project demonstrating ${prioritySkill.name}`;
    action.type = "build";
    action.reason = `To begin your evidence-backed preparation toward ${career.name}, your first step is demonstrating ${prioritySkill.name} (${Math.round(prioritySkill.importance * 100)}% framework weight). Real work counts as proof; claims alone remain unverified.`;
    action.outcome = `A working starter project or code sample demonstrating ${prioritySkill.name.toLowerCase()} for your ${career.name} portfolio.`;
    action.expectedEvidence = [
      `A small project or code file demonstrating ${prioritySkill.name}`,
      "A short description explaining what you built and how it works",
      "Screenshot, repository link, or uploaded source file",
    ];
    action.steps = [
      `Pick a beginner-friendly project focused on ${prioritySkill.name.toLowerCase()}.`,
      `Implement the core functionality using standard tools and best practices.`,
      `Add your completed project to NextStep evidence to verify your capability.`,
    ];
  }

  const demonstratedCount = skills.filter((skill) => skill.status === "demonstrated" || skill.level > 0).length;
  const readiness = Math.round(skills.reduce((sum, item, idx) => sum + Math.min(1, item.level / framework[idx].requiredLevel) * 100, 0) / skills.length);

  state.skillReport = {
    skills,
    readiness,
    demonstratedCount,
    totalSkills: skills.length,
    gaps: skills.filter((skill) => skill.level < skill.requiredLevel).map((skill) => skill.name),
    analyzedAt: new Date().toISOString(),
    evidenceCount: (state.evidence || []).length,
    evidenceQuality: hasRoleRelevantEvidence ? "role-relevant-signals-found" : "insufficient-role-relevance",
    career: { name: career.name, version: career.version, source: career.source, reviewed: career.reviewed },
    method: "deterministic-prototype",
  };
  state.recommendedAction = action;

  if (oldReport) {
    const previous = new Map(oldReport.skills.map((skill) => [skill.name, skill]));
    const changes = skills.filter((skill) => previous.has(skill.name) && (
      previous.get(skill.name).status !== skill.status || previous.get(skill.name).level !== skill.level
    ))
    .map((skill) => ({
      skill: skill.name,
      previousStatus: previous.get(skill.name).status,
      newStatus: skill.status,
      previousLevel: previous.get(skill.name).level,
      newLevel: skill.level,
      confidence: skill.confidence,
    }));
    if (changes.length) {
      state.changeLog = state.changeLog || [];
      state.changeLog.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        evidenceIds: (state.evidence || []).map((item) => item.id),
        changes,
        nextSkill: action.skill,
      });
      state.changeLog = state.changeLog.slice(0, 20);
    }
  }

  addActivity(state, (state.evidence || []).length
    ? `Skills analyzed from ${state.evidence.length} ${state.evidence.length === 1 ? "piece" : "pieces"} of evidence.`
    : `Career readiness mapped for ${career.name}. Next action prioritized.`);
  return state;
}

module.exports = {
  analyze,
  triggerAIAnalysis,
};
