const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const title = (content.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const metaMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || content.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const meta = metaMatch ? metaMatch[1] : '';
  const hasFavicon = content.includes('favicon.svg');
  const hasMobileMenu = content.includes('policy-menu-toggle') || content.includes('mobile-menu');
  const hasPhone = content.includes('tel:');
  const hasCopyright = content.includes('2026 NextStep');
  
  console.log(`[${f}]`);
  console.log(`  Title: ${title.trim()}`);
  console.log(`  Meta desc (${meta.length} chars): ${meta.slice(0, 70)}...`);
  console.log(`  Favicon: ${hasFavicon} | MobileMenu: ${hasMobileMenu} | Phone: ${hasPhone} | Copyright2026: ${hasCopyright}\n`);
});
