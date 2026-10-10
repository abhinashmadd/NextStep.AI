function handleCors(request, response) {
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  const origin = request.headers.origin || '';
  const isAllowed = allowed.length === 0 || allowed.includes(origin);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": isAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    });
    response.end();
    return true;
  }
  // For normal requests, set the header if allowed
  if (isAllowed) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  return false;
}

module.exports = { handleCors };
