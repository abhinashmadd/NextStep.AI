const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

console.log(`Checking links across ${htmlFiles.length} HTML files...`);

const issues = [];

htmlFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Find all hrefs and srcs
  const linkRegex = /(?:href|src)=["']([^"']+)["']/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const rawLink = match[1];
    
    // Ignore external http/https, mailto, tel, data:
    if (rawLink.startsWith('http://') || rawLink.startsWith('https://') || rawLink.startsWith('mailto:') || rawLink.startsWith('tel:') || rawLink.startsWith('data:') || rawLink.startsWith('blob:')) {
      continue;
    }

    if (rawLink === '#' || rawLink.startsWith('#')) {
      // Anchor link on same page
      if (rawLink.length > 1) {
        const id = rawLink.slice(1);
        const hasId = content.includes(`id="${id}"`) || content.includes(`name="${id}"`);
        if (!hasId) {
          issues.push({ file, link: rawLink, error: `Anchor #${id} not found in ${file}` });
        }
      }
      continue;
    }

    // Relative file link
    let [targetPath, hash] = rawLink.split('#');
    // Strip leading ./
    let resolved = path.resolve(publicDir, targetPath);

    if (targetPath.startsWith('/api/') || targetPath.startsWith('./api/')) {
      // API endpoint link
      continue;
    }

    if (!fs.existsSync(resolved)) {
      issues.push({ file, link: rawLink, error: `File not found: ${resolved}` });
    } else if (hash) {
      const targetContent = fs.readFileSync(resolved, 'utf-8');
      const hasId = targetContent.includes(`id="${hash}"`) || targetContent.includes(`name="${hash}"`);
      if (!hasId) {
        issues.push({ file, link: rawLink, error: `Anchor #${hash} not found in ${resolved}` });
      }
    }
  }
});

console.log('Issues found:', issues.length);
issues.forEach(i => console.log(`[${i.file}] ${i.link} -> ${i.error}`));
