const addSecurityHeaders = (response) => {
  if (response.headersSent) return;
  // Prevent MIME sniffing
  response.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking protection
  response.setHeader('X-Frame-Options', 'DENY');
  // Referrer policy
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disable Federated Learning of Cohorts (FLoC)
  response.setHeader('Permissions-Policy', 'interest-cohort=()');
  // Prevent caching of sensitive data
  response.setHeader('Cache-Control', 'private, no-store');
  // Content Security Policy – allow resources from self and Google fonts
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' https: data:; object-src 'none'; base-uri 'self';"
  );
};

module.exports = { addSecurityHeaders };
