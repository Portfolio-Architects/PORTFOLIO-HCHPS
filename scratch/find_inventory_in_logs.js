const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain';

async function scanLogs() {
  try {
    const dirs = fs.readdirSync(brainDir);
    console.log(`Scanning ${dirs.length} conversation folders...`);
    
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
          const stringified = JSON.stringify(obj);
          
          // Look for inventory-related schemas or actions
          if (stringified.includes('INVENTORY') && (stringified.includes('currentStock') || stringified.includes('addRow') || stringified.includes('replaceAll') || stringified.includes('inventoryItems'))) {
            console.log(`Match found in dir: ${dir}, step: ${obj.step_index}, type: ${obj.type}`);
            
            // Extract the data if present in tool calls or tool output
            allMatches.push({
              conversationId: dir,
              stepIndex: obj.step_index,
              type: obj.type,
              object: obj
            });
          }
        } catch (e) {
          // ignore JSON parse errors
        }
      }
    }
    
    fs.writeFileSync('scratch/inventory_matches.json', JSON.stringify(allMatches, null, 2), 'utf8');
    console.log(`Scan completed. Found ${allMatches.length} matching events.`);
  } catch (err) {
    console.error('Error during scan:', err);
  }
}

scanLogs();
