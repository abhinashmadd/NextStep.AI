const { careers } = require("../modules/careers/careers.data");

const ROLE_DEFINITIONS = {
  "software-developer": {
    careerId: "software-developer",
    targetRole: "Software Developer",
    course: "Computer Science & Engineering",
    discipline: "Technology",
    aliases: [
      "software developer",
      "software engineer",
      "software",
      "developer",
      "frontend developer",
      "backend developer",
      "full stack developer",
      "fullstack developer",
      "web developer",
      "programmer",
      "coding",
      "computer science",
      "technology",
      "data scientist",
      "data analyst",
      "machine learning",
      "machine learning engineer",
      "ai researcher",
      "ai engineer",
      "cloud architect",
      "cloud engineer",
      "cybersecurity analyst",
      "cybersecurity",
      "mobile app developer",
      "mobile developer",
      "devops",
      "devops engineer"
    ],
  },
  "embedded-systems": {
    careerId: "embedded-systems",
    targetRole: "Embedded Systems Engineer",
    course: "Electronics & Electrical Engineering",
    discipline: "Engineering",
    aliases: [
      "embedded systems engineer",
      "embedded systems",
      "embedded engineer",
      "hardware engineer",
      "iot engineer",
      "firmware engineer",
      "electrical engineering",
      "electronics & electrical engineering",
      "robotics engineer",
      "engineering",
      "electronics",
      "vlsi engineer",
      "mechatronics engineer"
    ],
  },
  "financial-analyst": {
    careerId: "financial-analyst",
    targetRole: "Financial Analyst",
    course: "Finance & Economics",
    discipline: "Business",
    aliases: [
      "financial analyst",
      "finance analyst",
      "finance & economics",
      "financial modeling",
      "investment analyst",
      "financial",
      "finance",
      "business",
      "economics",
      "accounting",
      "accountant",
      "finance manager",
      "product manager",
      "business analyst",
      "marketing manager",
      "sales representative",
      "human resources specialist",
      "management"
    ],
  },
  "ux-researcher": {
    careerId: "ux-researcher",
    targetRole: "UX Researcher",
    course: "Design & Human-Computer Interaction",
    discipline: "Arts & Design",
    aliases: [
      "ux researcher",
      "ui/ux designer",
      "ui designer",
      "ux designer",
      "product designer",
      "user researcher",
      "design & human-computer interaction",
      "arts & design",
      "interaction designer",
      "graphic designer",
      "visual designer",
      "content writer",
      "copywriter"
    ],
  },
};

function normalizeRoleString(str) {
  if (!str) return "";
  return String(str).toLowerCase().trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function mapRoleToCareer(roleOrCareerId) {
  if (!roleOrCareerId) {
    return {
      careerId: "software-developer",
      targetRole: "Software Developer",
      course: "Computer Science & Engineering",
      discipline: "Technology",
    };
  }

  const cleanInput = String(roleOrCareerId).trim();
  const lower = cleanInput.toLowerCase();
  const normalized = normalizeRoleString(cleanInput);

  // 1. Direct ID match (e.g. "software-developer")
  if (ROLE_DEFINITIONS[cleanInput]) {
    return { ...ROLE_DEFINITIONS[cleanInput] };
  }
  if (ROLE_DEFINITIONS[lower]) {
    return { ...ROLE_DEFINITIONS[lower] };
  }

  // 2. Exact match against targetRole
  for (const def of Object.values(ROLE_DEFINITIONS)) {
    if (def.targetRole.toLowerCase() === lower) {
      return { ...def };
    }
  }

  // 3. Alias / partial match
  for (const def of Object.values(ROLE_DEFINITIONS)) {
    if (def.aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized))) {
      return { ...def };
    }
  }

  // 4. Check if careers data has it directly
  if (careers && careers[cleanInput]) {
    return {
      careerId: cleanInput,
      targetRole: careers[cleanInput].name,
      course: "Undergraduate Studies",
      discipline: careers[cleanInput].domain || "Technology",
    };
  }

  // 5. Default fallback while preserving user's specified role name
  return {
    careerId: "software-developer",
    targetRole: cleanInput,
    course: "Computer Science & Engineering",
    discipline: "Technology",
  };
}

function normalizeRollOrBadge(identifier) {
  if (!identifier) return "";
  return String(identifier).toLowerCase().replace(/[^a-z0-9]/g, "");
}

module.exports = {
  ROLE_DEFINITIONS,
  mapRoleToCareer,
  normalizeRoleString,
  normalizeRollOrBadge,
};
