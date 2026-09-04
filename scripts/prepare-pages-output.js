const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outDir, { recursive: true });
}

const indexHtml = path.join(outDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  fs.writeFileSync(
    indexHtml,
    '<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta http-equiv=\"refresh\" content=\"0; url=/festival/yangjae\"><title>PORTFOLIO VITAL</title></head><body><p>Redirecting to <a href=\"/festival/yangjae\">Yangjae Festival Dashboard</a>...</p></body></html>',
    'utf8'
  );
}

console.log('[OK] Prepared out directory for Cloudflare Pages deployment.');
