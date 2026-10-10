const { addSecurityHeaders } = require('../middleware/securityHeaders');
const { MAX_BODY_BYTES } = require('../config/environment');

function sendJson(response, status, data, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  // Apply security headers to all JSON responses
  addSecurityHeaders(response);
  response.end(JSON.stringify(data));
}

function readBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes && !tooLarge) {
        tooLarge = true;
        reject(Object.assign(new Error(`Request body exceeds the limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`), { status: 413 }));
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        const str = Buffer.concat(chunks).toString("utf8");
        resolve(str ? JSON.parse(str) : {});
      } catch {
        reject(Object.assign(new Error("Send a valid JSON request body."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

module.exports = {
  sendJson,
  readBody,
};
