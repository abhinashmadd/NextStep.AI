const addSecurityHeaders = (response) => {
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
  // Content Security Policy – only allow resources from self
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https:; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self';"
  );
};

module.exports = { addSecurityHeaders };
