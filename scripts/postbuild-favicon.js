// Minimal post-build script to enforce favicon tags after claat build overwrites <head>
// Usage: node scripts/postbuild-favicon.js

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', '1-glean-search', 'index.html'),
  path.join(__dirname, '..', '2-glean-assistant', 'index.html'),
  path.join(__dirname, '..', '3-glean-agents', 'index.html'),
];

const FAVICON_TAG = '  <link rel="icon" href="/assets/favicon.svg?v=2" type="image/svg+xml">\n';

function ensureFavicon(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('rel="icon"') || html.includes("rel='icon'")) {
    // Replace existing href to the canonical one
    html = html.replace(/<link[^>]*rel=["']icon["'][^>]*>/i, FAVICON_TAG.trim());
  } else {
    // Insert after <title> if present, otherwise right after <head>
    if (html.includes('</title>')) {
      html = html.replace('</title>\n', `</title>\n${FAVICON_TAG}`);
    } else if (html.includes('<head>')) {
      html = html.replace('<head>\n', `<head>\n${FAVICON_TAG}`);
    } else {
      // Fallback: prepend to file (should not happen with valid HTML)
      html = FAVICON_TAG + html;
    }
  }
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`[postbuild-favicon] ensured favicon in ${path.relative(path.join(__dirname, '..'), filePath)}`);
}

for (const f of TARGET_FILES) {
  if (fs.existsSync(f)) {
    ensureFavicon(f);
  }
}


