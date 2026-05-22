const fs = require('fs');
const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\3ed65234-8b33-45f6-a702-32f8bc6664a7\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

let out = [];

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    
    // Check if it's user input
    if (obj.type === 'USER_INPUT') {
      out.push(`=== STEP ${obj.step_index} USER_INPUT ===`);
      out.push(obj.content);
      out.push('');
    }
    
    // Check if the step contains relevant terms
    const stringified = JSON.stringify(obj);
    if (stringified.includes('의료') || stringified.includes('회복') || stringified.includes('mnrcir0vpun1ops6x') || stringified.includes('mnsh0ldc9lua8ykfx')) {
      out.push(`=== STEP ${obj.step_index} (${obj.type}) [Match] ===`);
      if (obj.content) {
        out.push(`Content: ${obj.content.substring(0, 1000)}`);
      }
      if (obj.tool_calls) {
        out.push(`Tool Calls: ${JSON.stringify(obj.tool_calls, null, 2)}`);
      }
      if (obj.output) {
        let outStr = typeof obj.output === 'string' ? obj.output : JSON.stringify(obj.output);
        out.push(`Output: ${outStr.substring(0, 2000)}`);
      }
      out.push('');
    }
  } catch (err) {
    // Ignore parse errors
  }
}

fs.writeFileSync('scratch/dump_transcript_utf8.txt', out.join('\n'), 'utf8');
console.log('Dump completed successfully!');
