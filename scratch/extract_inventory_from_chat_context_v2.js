const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain';

function scanTranscripts() {
  try {
    const dirs = fs.readdirSync(brainDir);
    console.log(`Scanning ${dirs.length} conversation folders...`);
    
    let foundCount = 0;

    for (const dir of dirs) {
      const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) continue;
      
      const fileContent = fs.readFileSync(logPath, 'utf8');
      const lines = fileContent.split('\n');
      
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!line.trim()) continue;
        
        try {
          const obj = JSON.parse(line);
          
          // Recursively search for target arrays in the parsed object
          searchObject(obj, dir, obj.step_index);
        } catch (e) {
          // ignore line parse error
        }
      }
    }
    console.log(`Scan completed. Found and extracted ${foundCount} inventory/stock datasets.`);
  } catch (err) {
    console.error('Scan failed:', err);
  }

  function searchObject(val, dir, step) {
    if (!val) return;
    
    if (Array.isArray(val)) {
      // Check if this array is an InventoryItem array or StockChange array
      if (val.length > 0) {
        const first = val[0];
        if (first && typeof first === 'object') {
          if (first.name !== undefined && first.currentStock !== undefined && first.unit !== undefined) {
            console.log(`\n🎉 SUCCESS! Found inventory items in dir: ${dir}, step: ${step}`);
            console.log(JSON.stringify(val, null, 2));
            fs.writeFileSync(`scratch/recovered_inventory_${dir}_step${step}.json`, JSON.stringify(val, null, 2), 'utf8');
            foundCount++;
          }
          if (first.itemId !== undefined && first.change !== undefined && first.reason !== undefined) {
            console.log(`\n🎉 SUCCESS! Found stock changes in dir: ${dir}, step: ${step}`);
            console.log(JSON.stringify(val, null, 2));
            fs.writeFileSync(`scratch/recovered_stock_changes_${dir}_step${step}.json`, JSON.stringify(val, null, 2), 'utf8');
            foundCount++;
          }
        }
      }
      
      // Recurse into array elements
      for (const item of val) {
        searchObject(item, dir, step);
      }
    } else if (typeof val === 'object') {
      for (const [key, value] of Object.entries(val)) {
        searchObject(value, dir, step);
      }
    } else if (typeof val === 'string') {
      // Try to parse string if it looks like JSON array/object
      if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          searchObject(parsed, dir, step);
        } catch (e) {
          // not valid JSON
        }
      }
    }
  }
}

scanTranscripts();
