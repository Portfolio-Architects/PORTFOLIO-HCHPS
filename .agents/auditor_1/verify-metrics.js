const fs = require('fs');
const path = require('path');

function getFilesAll(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === '.agents') return;
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesAll(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(fullPath);
    }
  });
  return results;
}

const rootDir = path.resolve(__dirname, '../../');
const allFiles = getFilesAll(rootDir);
console.log('All TS/TSX/JS files count:', allFiles.length);

const tsFiles = allFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
console.log('All TS/TSX files count:', tsFiles.length);
tsFiles.forEach(f => {
  const rel = path.relative(rootDir, f).replace(/\\/g, '/');
  console.log('  -', rel);
});
