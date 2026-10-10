const { careers } = require("../careers/careers.data");

function validateProfile(value) {
  if (!value) return "Add your name, course, academic year, and target career.";
  if (!value.name || typeof value.name !== "string" || !value.name.trim()) return "Add your full name.";
  if (!value.course || typeof value.course !== "string" || !value.course.trim()) return "Add your course or degree.";
  if (!value.year || typeof value.year !== "string" || !value.year.trim()) return "Choose your academic year.";
  if (!value.careerId || typeof value.careerId !== "string" || !value.careerId.trim()) return "Choose your target career.";
  if (value.discipline !== undefined && typeof value.discipline !== "string") return "Discipline must be text.";
  if (!careers[value.careerId]) {
    return "Choose a target career from the supported career list.";
  }
  if (value.name.length > 100 || value.course.length > 120 || (value.discipline && value.discipline.length > 120)) {
    return "Profile fields must be 120 characters or fewer.";
  }
  if (value.bio && (typeof value.bio !== "string" || value.bio.length > 500)) {
    return "Your introduction must be 500 characters or fewer.";
  }
  if (value.interests && (typeof value.interests !== "string" || value.interests.length > 500)) {
    return "Interests must be 500 characters or fewer.";
  }
  if (value.semester !== undefined && (typeof value.semester !== "string" || value.semester.length > 40)) {
    return "Semester must be 40 characters or fewer.";
  }
  if (value.learningStyle !== undefined && (
    typeof value.learningStyle !== "string" || !["", "Hands-on projects", "Reading & documentation", "Videos & demonstrations", "Practice exercises"].includes(value.learningStyle)
  )) {
    return "Choose a supported learning style.";
  }
  if (value.skills !== undefined && (!Array.isArray(value.skills) || value.skills.length > 20 || value.skills.some((skill) => typeof skill !== "string" || skill.length > 60))) {
    return "Profile learning notes must contain up to 20 text items of 60 characters or fewer.";
  }
  if (value.availableHours !== undefined && value.availableHours !== "" && (
    !Number.isInteger(Number(value.availableHours)) || Number(value.availableHours) < 1 || Number(value.availableHours) > 80
  )) {
    return "Available study time must be between 1 and 80 hours per week.";
  }
  return null;
}

module.exports = {
  validateProfile,
};
