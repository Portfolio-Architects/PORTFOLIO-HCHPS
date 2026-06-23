const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\dbbcf3b5-5dff-4f67-94b8-29398591f073\\.system_generated\\logs\\transcript.jsonl';
const targetFilePath = 'd:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\src\\components\\dashboard\\PortfolioDashboardView.tsx';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found");
  process.exit(1);
}

// 1. Read clean 424-line original file content and normalize line endings to LF
let currentContent = fs.readFileSync(targetFilePath, 'utf8').replace(/\r\n/g, '\n');
console.log(`Original content length: ${currentContent.length} chars`);

// 2. Parse transcript to extract tool calls
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');
const patches = [];

// Helper function to decode double/triple-encoded values recursively
function decodeVal(val) {
  if (typeof val !== 'string') return val;
  let current = val.trim();
  let prev = null;
  
  while (current !== prev && current.startsWith('"') && current.endsWith('"')) {
    prev = current;
    try {
      // Escape real control characters to make it valid JSON string literal
      let escaped = current
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      let decoded = JSON.parse(escaped);
      if (typeof decoded === 'string') {
        current = decoded.trim();
      } else {
        return decoded;
      }
    } catch (e) {
      let inner = current.slice(1, -1);
      current = inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
    }
  }
  return current;
}

lines.forEach((line) => {
  if (!line.trim()) return;
  try {
    const step = JSON.parse(line);
    if (step.tool_calls) {
      step.tool_calls.forEach(tc => {
        const isTarget = tc.args && tc.args.TargetFile && tc.args.TargetFile.toLowerCase().includes('portfoliodashboardview.tsx');
        if (isTarget && (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content')) {
          // Decode args
          const decodedArgs = {};
          for (let k in tc.args) {
            decodedArgs[k] = decodeVal(tc.args[k]);
          }
          patches.push({
            step_index: step.step_index,
            name: tc.name,
            args: decodedArgs
          });
        }
      });
    }
  } catch (e) {}
});

// Sort patches by step_index ascending to apply sequentially
patches.sort((a, b) => a.step_index - b.step_index);
console.log(`Found ${patches.length} patches to apply.`);

// Helper function to normalize strings
function norm(str) {
  if (!str) return '';
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// 3. Sequentially apply patches
patches.forEach(patch => {
  console.log(`\nApplying Step [${patch.step_index}] - ${patch.name}...`);
  if (patch.name === 'replace_file_content') {
    const target = norm(patch.args.TargetContent);
    const replacement = norm(patch.args.ReplacementContent);
    if (!target || !replacement) {
      console.warn(`  Missing target or replacement content for step ${patch.step_index}`);
      return;
    }
    
    // Exact match test
    let index = currentContent.indexOf(target);
    if (index !== -1) {
      currentContent = currentContent.substring(0, index) + replacement + currentContent.substring(index + target.length);
      console.log(`  Successfully applied exact replace_file_content!`);
      return;
    }

    // Try normalized match
    let normContent = currentContent.replace(/\s+/g, '');
    let normTarget = target.replace(/\s+/g, '');
    if (normContent.includes(normTarget)) {
      console.log(`  Normalized match found, but exact match failed (whitespace discrepancy).`);
    } else {
      console.error(`  [ERROR] Target content not found in file for step ${patch.step_index}`);
      console.error(`  Target (first 150 chars): [${target.substring(0, 150)}]`);
    }
  } else if (patch.name === 'multi_replace_file_content') {
    let chunks = patch.args.ReplacementChunks;
    if (typeof chunks === 'string') {
      try {
        let escapedChunks = chunks
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        chunks = JSON.parse(escapedChunks);
      } catch (err) {
        try {
          chunks = Function("return " + chunks)();
        } catch (e2) {
          console.error(`  Failed to parse chunks string:`, err.message);
        }
      }
    }
    if (!chunks || !Array.isArray(chunks)) {
      console.warn(`  No chunks found for step ${patch.step_index}`);
      return;
    }
    chunks.forEach((chunk, cIdx) => {
      // Decode chunk properties as well
      const target = norm(decodeVal(chunk.TargetContent));
      const replacement = norm(decodeVal(chunk.ReplacementContent));
      
      let index = currentContent.indexOf(target);
      if (index !== -1) {
        currentContent = currentContent.substring(0, index) + replacement + currentContent.substring(index + target.length);
        console.log(`    Chunk ${cIdx} applied successfully via exact match!`);
      } else {
        console.error(`    [ERROR] Chunk ${cIdx} target content not found for step ${patch.step_index}`);
        console.error(`    Chunk Target (first 150 chars): [${target.substring(0, 150)}]`);
      }
    });
  }
});

// 4. Overwrite file with reconstructed content
fs.writeFileSync(targetFilePath, currentContent.replace(/\n/g, '\r\n'), 'utf8');
console.log(`\nReconstructed content written. Length: ${currentContent.length} chars`);



