const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

const policyFiles = [
  'compliance.html',
  'cookie-policy.html',
  'data-deletion.html',
  'licenses.html',
  'privacy-policy.html',
  'refund-policy.html',
  'terms-of-service.html',
  'unsubscribe.html'
];

const standardHeader = `  <header class="policy-header" role="banner">
    <div class="policy-header-inner">
      <a href="./index.html" class="policy-brand" aria-label="NextStep Home">
        <img src="./nextstep-logo-transparent.png" alt="NextStep Logo - Evidence-to-Action Career Readiness Platform">
        <span>NextStep</span>
      </a>
      <button class="policy-menu-toggle" id="policy-menu-toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
      <nav class="policy-nav-links" id="policy-nav-links" aria-label="Policy Navigation">
        <a href="./index.html" class="policy-nav-link">← Return to Workspace</a>
        <a href="./privacy-policy.html" class="policy-nav-link">Privacy</a>
        <a href="./terms-of-service.html" class="policy-nav-link">Terms</a>
        <a href="./refund-policy.html" class="policy-nav-link">Refund Policy</a>
        <a href="./cookie-policy.html" class="policy-nav-link">Cookie Policy</a>
        <a href="./compliance.html" class="policy-nav-btn">Compliance Center 🛡️</a>
      </nav>
    </div>
  </header>`;

const standardFooter = `  <footer class="policy-footer" role="contentinfo">
    <div class="policy-footer-inner">
      <div class="policy-footer-grid">
        <div class="policy-footer-col">
          <h4>NextStep Career Guidance</h4>
          <p style="font-size: 13.5px; color: #4c5d50; line-height: 1.6;">
            A student career-readiness platform that turns real work and verified evidence into one clear next action. Free core access, zero hidden fees, zero deceptive patterns.
          </p>
        </div>
        <div class="policy-footer-col">
          <h4>Legal &amp; Trust</h4>
          <ul>
            <li><a href="./privacy-policy.html">Privacy Policy</a></li>
            <li><a href="./terms-of-service.html">Terms of Service</a></li>
            <li><a href="./refund-policy.html">Refund Policy</a></li>
            <li><a href="./cookie-policy.html">Cookie Policy</a></li>
            <li><a href="./licenses.html">Asset Licenses</a></li>
          </ul>
        </div>
        <div class="policy-footer-col">
          <h4>Privacy Controls</h4>
          <ul>
            <li><a href="#" data-open-cookie-settings>Cookie Settings</a></li>
            <li><a href="./data-deletion.html">Delete My Data</a></li>
            <li><a href="./unsubscribe.html">Email Unsubscribe</a></li>
            <li><a href="./compliance.html">Compliance Audit</a></li>
          </ul>
        </div>
        <div class="policy-footer-col">
          <h4>Contact &amp; Support</h4>
          <ul>
            <li><a href="mailto:support@nextstep.edu" class="policy-contact-link">support@nextstep.edu</a></li>
            <li><a href="mailto:dpo@nextstep.edu" class="policy-contact-link">dpo@nextstep.edu</a></li>
            <li><a href="tel:+18005557837" class="policy-contact-link">+1 (800) 555-STEP</a></li>
            <li><a href="tel:+918049201000" class="policy-contact-link">+91 (80) 4920-1000</a></li>
            <li><a href="./index.html">Student Workspace</a></li>
            <li><a href="./auth.html">Account Sign In</a></li>
          </ul>
        </div>
      </div>
      <div class="policy-footer-bottom">
        <span>&copy; 2026 NextStep Career Technologies Inc. All rights reserved.</span>
        <span>100% Free Core Platform · Zero Fees · Zero Data Selling</span>
      </div>
    </div>
  </footer>`;

const menuScript = `  <script>
    (function() {
      const menuToggle = document.getElementById('policy-menu-toggle');
      const navLinks = document.getElementById('policy-nav-links');
      if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function() {
          const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
          menuToggle.setAttribute('aria-expanded', !expanded);
          navLinks.classList.toggle('open');
        });
      }
    })();
  </script>`;

policyFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Ensure Favicon
  if (!content.includes('favicon.svg')) {
    content = content.replace(
      /(<meta\s+name=["']viewport["'][^>]*>)/i,
      `$1\n  <link rel="icon" type="image/svg+xml" href="./favicon.svg">`
    );
  }

  // 2. Fix page titles with &amp;
  content = content.replace(/<title>([^<]*)<\/title>/gi, (match, title) => {
    const cleanTitle = title.replace(/&amp;/g, '&');
    return `<title>${cleanTitle}</title>`;
  });

  // 3. Fix meta descriptions with &amp;
  content = content.replace(
    /(<meta\s+name=["']description["']\s+content=["'])([^"']*)(["']>)/gi,
    (match, prefix, desc, suffix) => {
      const cleanDesc = desc.replace(/&amp;/g, '&');
      return `${prefix}${cleanDesc}${suffix}`;
    }
  );

  // 4. Update Header
  content = content.replace(/<header class="policy-header"[\s\S]*?<\/header>/i, standardHeader);

  // 5. Update Footer
  content = content.replace(/<footer class="policy-footer"[\s\S]*?<\/footer>/i, standardFooter);

  // 6. Ensure Mobile Menu Script
  if (!content.includes("document.getElementById('policy-menu-toggle')") && !content.includes('policy-menu-toggle')) {
    // handled by replace
  }
  if (!content.includes("document.getElementById('policy-menu-toggle')") && !content.includes("policy-menu-toggle")) {
    // will be added
  }
  if (!content.includes("menuToggle.addEventListener")) {
    // Add before </body>
    content = content.replace('</body>', `${menuScript}\n</body>`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
