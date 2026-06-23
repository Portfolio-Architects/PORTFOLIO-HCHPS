const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain';

function scanTranscripts() {
  try {
    const dirs = fs.readdirSync(brainDir);
    console.log(`Scanning ${dirs.length} conversation folders for contextData...`);
    
    for (const dir of dirs) {
      const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) continue;
      
      const fileContent = fs.readFileSync(logPath, 'utf8');
      const lines = fileContent.split('\n');
      
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!line.trim()) continue;
        
        try {
          // Since some tool calls or contents might be large, we search string first
          if (line.includes('inventoryItems') || line.includes('hchps-inventory') || line.includes('INVENTORY')) {
            const obj = JSON.parse(line);
            
            // Search inside tool calls (like write_to_file, run_command, or fetch calls)
            const stringified = JSON.stringify(obj);
            
            // Look for JSON patterns of Inventory items: e.g. "name", "category", "currentStock", "unit"
            // We want to find an array of objects that has currentStock or quantity
            const regex = /\[\s*\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"name"\s*:\s*"[^"]+"[^\]]*\}/g;
            const matches = stringified.match(regex);
            
            if (matches) {
              for (const match of matches) {
                try {
                  const parsed = JSON.parse(match);
                  if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].currentStock !== undefined) {
                    console.log(`\n🎉 SUCCESS! Found inventory items in dir: ${dir}, step: ${obj.step_index}`);
                    console.log(JSON.stringify(parsed, null, 2));
                    fs.writeFileSync(`scratch/recovered_inventory_${dir}_step${obj.step_index}.json`, JSON.stringify(parsed, null, 2), 'utf8');
                  }
                } catch (e) {
                  // inner parse failed, maybe partial match
                }
              }
            }
            
            // Alternative search: look for any JSON array that contains both "currentStock" and "unit"
            // Let's scan for any array pattern
            const jsonArrays = findArraysInText(stringified);
            for (const arrStr of jsonArrays) {
              try {
                const parsed = JSON.parse(arrStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const first = parsed[0];
                  if (first && typeof first === 'object' && first.name && first.currentStock !== undefined) {
                    console.log(`\n🎉 SUCCESS (Alt)! Found inventory items in dir: ${dir}, step: ${obj.step_index}`);
                    console.log(JSON.stringify(parsed, null, 2));
                    fs.writeFileSync(`scratch/recovered_inventory_alt_${dir}_step${obj.step_index}.json`, JSON.stringify(parsed, null, 2), 'utf8');
                  }
                  if (first && typeof first === 'object' && first.itemId && first.change !== undefined) {
                    console.log(`\n🎉 SUCCESS (StockChange)! Found stock changes in dir: ${dir}, step: ${obj.step_index}`);
                    console.log(JSON.stringify(parsed, null, 2));
                    fs.writeFileSync(`scratch/recovered_stock_changes_${dir}_step${obj.step_index}.json`, JSON.stringify(parsed, null, 2), 'utf8');
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e) {
          // ignore line parse error
        }
      }
    }
    console.log('Scan completed.');
  } catch (err) {
    console.error('Scan failed:', err);
  }
}

// Helper function to extract potential JSON arrays from a stringified object
function findArraysInText(text) {
  const arrays = [];
  let bracketCount = 0;
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') {
      if (bracketCount === 0) {
        startIdx = i;
      }
      bracketCount++;
    } else if (char === ']') {
      if (bracketCount > 0) {
        bracketCount--;
        if (bracketCount === 0 && startIdx !== -1) {
          arrays.push(text.substring(startIdx, i + 1));
        }
      }
    }
  }
  return arrays;
}

scanTranscripts();
