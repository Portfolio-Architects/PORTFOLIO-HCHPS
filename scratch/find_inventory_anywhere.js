const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain';

async function scanLogs() {
  try {
    const dirs = fs.readdirSync(brainDir);
    console.log(`Scanning ${dirs.length} conversation folders for any 'inventory' or '재고'...`);
    
    let allMatches = [];

    for (const dir of dirs) {
      const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) continue;
      
      const fileContent = fs.readFileSync(logPath, 'utf8');
      const lines = fileContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        try {
          const obj = JSON.parse(line);
          const stringified = JSON.stringify(obj).toLowerCase();
          
          if (stringified.includes('inventory') || stringified.includes('재고') || stringified.includes('비품') || stringified.includes('stock_changes') || stringified.includes('stockchange')) {
            console.log(`[MATCH] Dir: ${dir}, step: ${obj.step_index}, type: ${obj.type}`);
            
            // Print a snippet of the match
            const matchIndex = stringified.indexOf('inventory');
            const startIdx = Math.max(0, matchIndex - 100);
            const endIdx = Math.min(stringified.length, matchIndex + 200);
            console.log(`  Snippet: ...${stringified.substring(startIdx, endIdx)}...`);

            allMatches.push({
              conversationId: dir,
              stepIndex: obj.step_index,
              type: obj.type,
              snippet: stringified.substring(startIdx, endIdx)
            });
          }
        } catch (e) {
          // ignore JSON parse errors
        }
      }
    }
    
    console.log(`Scan completed. Found ${allMatches.length} matching events.`);
  } catch (err) {
    console.error('Error during scan:', err);
  }
}

scanLogs();
