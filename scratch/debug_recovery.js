const fs = require('fs');
const logPath = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\33e0dc24-690c-4c37-9e57-57d9fe073ee4\\.system_generated\\logs\\transcript.jsonl';

const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const step = JSON.parse(line);
    if (step.step_index === 97) {
      const tc = step.tool_calls[0];
      console.log("tc.name:", tc.name);
      fs.writeFileSync('d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\scratch\\step97_target.txt', tc.args.TargetContent, 'utf8');
      fs.writeFileSync('d:\\Desktop\\PORTFOLIO\\PORTFOLIO - VITAL\\scratch\\step97_replacement.txt', tc.args.ReplacementContent, 'utf8');
      console.log("Successfully wrote step 97 target and replacement.");
    }
  } catch (e) {
    console.error(e);
  }
});
