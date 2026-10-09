const careers = {
  "software-developer": {
    name: "Software Developer", domain: "Technology", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "Programming fundamentals", importance: 0.95, requiredLevel: 3, keywords: ["python", "javascript", "typescript", "java", "c++", "algorithm", "data structure"], effort: 5, type: "build" },
      { name: "API development", importance: 0.88, requiredLevel: 2, keywords: ["api", "rest", "endpoint", "graphql", "http"], effort: 5, type: "build", prerequisites: ["Programming fundamentals"] },
      { name: "Database & SQL", importance: 0.82, requiredLevel: 2, keywords: ["sql", "postgres", "mysql", "database", "mongodb", "sqlite"], effort: 4, type: "build", prerequisites: ["Programming fundamentals"] },
      { name: "Automated testing", importance: 0.8, requiredLevel: 2, keywords: ["test", "testing", "jest", "pytest", "unit test", "playwright"], effort: 4, type: "practice", prerequisites: ["Programming fundamentals"] },
      { name: "Authentication & security", importance: 0.78, requiredLevel: 2, keywords: ["auth", "authentication", "jwt", "security", "oauth", "password hashing"], effort: 6, type: "integrate", prerequisites: ["API development"] },
      { name: "Deployment & cloud", importance: 0.66, requiredLevel: 2, keywords: ["cloud", "aws", "azure", "docker", "deploy", "deployment"], effort: 6, type: "build", prerequisites: ["API development"] },
      { name: "Git & collaboration", importance: 0.68, requiredLevel: 2, keywords: ["git", "github", "pull request", "collaboration", "version control"], effort: 3, type: "practice" },
    ],
  },
  "embedded-systems": {
    name: "Embedded Systems Engineer", domain: "Engineering", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "C programming", importance: 0.96, requiredLevel: 3, keywords: ["c programming", "embedded c", "c code", "c language", "firmware"], effort: 5, type: "build" },
      { name: "Microcontrollers", importance: 0.92, requiredLevel: 2, keywords: ["microcontroller", "arduino", "esp32", "stm32", "firmware"], effort: 5, type: "build", prerequisites: ["C programming"] },
      { name: "GPIO & sensors", importance: 0.86, requiredLevel: 2, keywords: ["gpio", "sensor", "sensors", "arduino", "input output"], effort: 4, type: "build", prerequisites: ["Microcontrollers"] },
      { name: "UART communication", importance: 0.85, requiredLevel: 2, keywords: ["uart", "serial communication", "serial monitor", "baud rate"], effort: 5, type: "build", prerequisites: ["Microcontrollers", "GPIO & sensors"] },
      { name: "SPI & I2C protocols", importance: 0.78, requiredLevel: 2, keywords: ["spi", "i2c", "serial peripheral interface"], effort: 6, type: "integrate", prerequisites: ["UART communication"] },
      { name: "Testing & debugging", importance: 0.72, requiredLevel: 2, keywords: ["debug", "debugging", "test", "oscilloscope", "logic analyzer"], effort: 4, type: "practice", prerequisites: ["C programming"] },
      { name: "Technical documentation", importance: 0.55, requiredLevel: 2, keywords: ["report", "documentation", "circuit diagram", "schematic"], effort: 3, type: "document" },
    ],
  },
  "financial-analyst": {
    name: "Financial Analyst", domain: "Business", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "Spreadsheet analysis", importance: 0.94, requiredLevel: 3, keywords: ["excel", "spreadsheet", "google sheets", "pivot table"], effort: 4, type: "build" },
      { name: "Financial statements", importance: 0.92, requiredLevel: 2, keywords: ["financial statement", "balance sheet", "income statement", "cash flow", "accounting"], effort: 4, type: "analyze" },
      { name: "Financial modeling", importance: 0.9, requiredLevel: 2, keywords: ["financial model", "valuation", "dcf", "modeling", "modelling"], effort: 6, type: "build", prerequisites: ["Spreadsheet analysis", "Financial statements"] },
      { name: "Forecasting", importance: 0.8, requiredLevel: 2, keywords: ["forecast", "forecasting", "budget", "projection"], effort: 5, type: "build", prerequisites: ["Financial modeling"] },
      { name: "Data visualization", importance: 0.72, requiredLevel: 2, keywords: ["visualization", "visualisation", "dashboard", "tableau", "power bi", "chart"], effort: 4, type: "build", prerequisites: ["Spreadsheet analysis"] },
      { name: "Business communication", importance: 0.65, requiredLevel: 2, keywords: ["presentation", "report", "recommendation", "executive summary"], effort: 3, type: "document" },
    ],
  },
  "ux-researcher": {
    name: "UX Researcher", domain: "Arts & Design", version: "1.0",
    source: "NextStep prototype competency framework", reviewed: "2026-10-08",
    skills: [
      { name: "User interviews", importance: 0.95, requiredLevel: 2, keywords: ["user interview", "interview", "interviews", "research participant"], effort: 4, type: "practice" },
      { name: "Survey & research planning", importance: 0.84, requiredLevel: 2, keywords: ["survey", "research plan", "research question", "methodology"], effort: 3, type: "build" },
      { name: "Research synthesis", importance: 0.92, requiredLevel: 2, keywords: ["synthesis", "affinity mapping", "themes", "research findings", "insights"], effort: 4, type: "analyze", prerequisites: ["User interviews"] },
      { name: "Usability testing", importance: 0.86, requiredLevel: 2, keywords: ["usability testing", "usability test", "task success", "think aloud"], effort: 5, type: "practice", prerequisites: ["User interviews"] },
      { name: "Case study documentation", importance: 0.72, requiredLevel: 2, keywords: ["case study", "portfolio", "design rationale", "research report"], effort: 4, type: "document", prerequisites: ["Research synthesis"] },
      { name: "Accessibility & inclusion", importance: 0.66, requiredLevel: 2, keywords: ["accessibility", "wcag", "inclusive", "screen reader"], effort: 3, type: "learn" },
    ],
  },
};

const careerList = Object.entries(careers).map(([id, career]) => ({
  id,
  name: career.name,
  domain: career.domain,
  version: career.version,
  source: career.source,
  reviewed: career.reviewed,
  skillCount: career.skills.length,
  skills: career.skills.map(({ name, requiredLevel, effort }) => ({ name, requiredLevel, effort })),
}));

function containsKeyword(text, keyword) {
  if (keyword.length > 4) return text.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = keyword === "test" ? "(?:s|ed|ing)?" : "";
  return new RegExp(`(^|[^a-z0-9])${escaped}${suffix}(?=$|[^a-z0-9])`, "i").test(text);
}

module.exports = {
  careers,
  careerList,
  containsKeyword,
};
