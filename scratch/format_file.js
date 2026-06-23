const fs = require('fs');

function formatFile(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  
  // Parse as JSON to resolve escapes
  try {
    const parsed = JSON.parse(content);
    fs.writeFileSync(filename.replace('.txt', '_formatted.txt'), parsed, 'utf8');
    console.log(`Formatted ${filename} -> ${filename.replace('.txt', '_formatted.txt')}`);
  } catch (e) {
    // If it's not valid JSON, it might be already raw but escaped, let's do a manual decode
    const decoded = content
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\t/g, '\t');
    fs.writeFileSync(filename.replace('.txt', '_formatted.txt'), decoded, 'utf8');
    console.log(`Manually decoded ${filename}`);
  }
}

formatFile('scratch/rolled_back_code_step253.txt');
formatFile('scratch/rolled_back_target_step253.txt');
