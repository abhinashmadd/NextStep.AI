const path = require("node:path");
const {
  MAX_FILE_BYTES,
  MAX_BASE64_LENGTH,
  ALLOWED_FILE_TYPES,
  SECRET_PATTERNS,
  ALL_EVIDENCE_TYPES,
} = require("../../config/environment");

function isSafeWebLink(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateEvidence(value) {
  if (!value || typeof value.title !== "string" || !value.title.trim()) {
    return "Give your evidence a title.";
  }
  if (value.title.length > 120) {
    return "Evidence titles must be 120 characters or fewer.";
  }

  if (typeof value.type !== "string" || !ALL_EVIDENCE_TYPES.has(value.type.trim())) {
    return "Choose a supported evidence type.";
  }

  const isPortfolio = value.type.trim() === "Portfolio";

  // Requirement 4: Portfolio Option Must Accept Links Only
  if (isPortfolio) {
    if (value.fileData) {
      return "Portfolio evidence accepts web links only. File uploads are not supported for portfolio links.";
    }
    if (!value.link || typeof value.link !== "string" || !value.link.trim()) {
      return "Provide a valid web URL for your portfolio link (e.g. https://your-portfolio.com).";
    }
    if (!isSafeWebLink(value.link)) {
      return "Portfolio links must be valid HTTP or HTTPS URLs (e.g. https://your-portfolio.com).";
    }
    if (value.link.length > 500) {
      return "Portfolio URL must be 500 characters or fewer.";
    }
  }

  if (value.description && (typeof value.description !== "string" || value.description.length > 5000)) {
    return "Evidence notes must be 5,000 characters or fewer.";
  }
  if (value.content && (typeof value.content !== "string" || value.content.length > 20000)) {
    return "Evidence text must be 20,000 characters or fewer.";
  }

  // Non-portfolio links validation
  if (value.link && !isPortfolio) {
    if (typeof value.link !== "string" || value.link.length > 500 || !isSafeWebLink(value.link)) {
      return "Links must be valid public HTTP or HTTPS URLs (e.g. GitHub repository or project link).";
    }
  }

  // Document upload validations (Requirement 2: 10 MB upload limit)
  if (value.fileName && (typeof value.fileName !== "string" || value.fileName.length > 180)) {
    return "File names must be 180 characters or fewer.";
  }

  if (value.fileName && !ALLOWED_FILE_TYPES.has(path.extname(value.fileName).toLowerCase())) {
    return "Allowed formats: PDF, TXT, Markdown, CSV, JSON, HTML, CSS, JavaScript, Python, Java, TypeScript, Word (.docx), or images (.png, .jpg).";
  }

  if (value.fileData) {
    if (
      typeof value.fileData !== "string"
      || value.fileData.length > MAX_BASE64_LENGTH
      || !/^[A-Za-z0-9+/=]+$/.test(value.fileData.replace(/\s+/g, ""))
    ) {
      return "The attached file is invalid or exceeds the 10 MB limit.";
    }

    const bytes = Buffer.from(value.fileData, "base64");
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      return "The attached file is empty or exceeds the 10 MB limit.";
    }

    const extension = path.extname(value.fileName || "").toLowerCase();
    if (extension === ".pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      return "That file does not have a valid PDF signature.";
    }

    // Text & code check for secrets and encoding
    if (/\.(txt|md|csv|json|html|css|js|py|java|ts|tsx|jsx)$/i.test(value.fileName)) {
      if (bytes.includes(0)) {
        return "Binary files aren't supported for code/text. Upload a plain text or source-code format.";
      }
      const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
      if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
        return "This file may contain a secret or credential. Remove it before adding your evidence.";
      }
      if (value.content) {
        const normalizedFile = text.replace(/\r\n/g, "\n").slice(0, 20000);
        const normalizedContent = value.content.replace(/\r\n/g, "\n");
        if (normalizedContent !== normalizedFile && normalizedContent.trim() !== normalizedFile.trim()) {
          return "The extracted evidence text did not match the uploaded file. Please upload it again.";
        }
      }
    }
  }

  if (value.fileData && !value.fileName) {
    return "Include the file name when attaching evidence.";
  }

  if (value.link && !value.fileData && !value.description && !isPortfolio) {
    return "Add a short description of the linked work so it can be assessed without fetching private files.";
  }

  if (SECRET_PATTERNS.some((pattern) => pattern.test(`${value.description || ""}\n${value.content || ""}`))) {
    return "Your evidence text may contain a secret or credential. Remove it before submitting.";
  }

  return null;
}

module.exports = {
  isSafeWebLink,
  validateEvidence,
};
