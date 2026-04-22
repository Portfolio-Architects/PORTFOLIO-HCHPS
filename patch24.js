/* eslint-disable */
const fs = require('fs');
const path = require('path');

const engineFile = path.join(__dirname, 'src', 'lib', 'OntologyCanvasEngine.ts');
let engineContent = fs.readFileSync(engineFile, 'utf8');

// 1. Fix the crashing line (remove orbital.targetAngle from line 190-210)
const badLine = `orbital.targetAngle = N === 1 ? parent.orbitAngle : startAngle + (gIdx * angleStep);`;
// Only remove the FIRST occurrence (which is the broken one). 
// Or better, just remove ALL of them and cleanly put them back!
engineContent = engineContent.replace(new RegExp(badLine.replace(/[.*+?^$\{\}()|\[\]\\]/g, '\\$&'), 'g'), '');

// Clean any double lines or stray comments
engineContent = engineContent.replace(/\/\/ ?œìŠ¤?œì—??1ì°¨ì ?¼ë¡œ ë°°ì •???„ë²½???•ë ¬ ê°ë„ë¥?'ëª©í‘œì¹?(Anchor\)'ë¡?ê¸°ì–µ?˜ê²Œ ë§Œë“­?ˆë‹¤\./g, '');
engineContent = engineContent.replace(/\/\/ ?„ë¬´ë¦?ê°•ë ¥???¸ë ¥???¹ê²¨???˜ë™?¼ë¡œ ?•ë ¬?????œì„œë¥??°ì„ ?ìœ¼ë¡?ì§€?¤ë„ë¡?ë³´ì •?©ë‹ˆ??/g, '');

// Safely inject BACK into the exact specific loop (around line 260)
const correctTarget = `const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap);
          
          // ?ì‹ ?¸ë“œê°€ ê³ ìœ  ì§€???‰ìƒ???†ë‹¤ë©?;
const correctInjection = `const orbital = this.makeOrbitalNode(node, oIndex, angle, centerId, connectionMap);
          orbital.targetAngle = N === 1 ? parent.orbitAngle : startAngle + (gIdx * angleStep);
          // ?ì‹ ?¸ë“œê°€ ê³ ìœ  ì§€???‰ìƒ???†ë‹¤ë©?;

if (engineContent.includes(correctTarget)) {
  engineContent = engineContent.replace(correctTarget, correctInjection);
  console.log('Fixed anchor assignment');
}

// 2. Increase spacing by 1.5x (user request)

// A) Expand the fan spread (totalSpreadAngle)
// Old: Math.min(1.0, N * 0.15)
// New: Math.min(1.5, N * 0.22)
engineContent = engineContent.replace(/Math\.min\(1\.0,\s*N\s*\*\s*0\.15\)/g, 'Math.min(1.5, N * 0.225)');

// B) Expand Angular Repulsion bumper radius
// Old: if (absDiff < repulsionThreshold)
// Old bumper: if (absDiff < 0.15) { finalStrength += ... (0.15 - absDiff) * 15.0 ... }
// We want nodes to repel at 1.5x the distance -> 0.15 * 1.5 = 0.225
engineContent = engineContent.replace(/0\.16 - absDiff/g, '0.225 - absDiff');
engineContent = engineContent.replace(/absDiff < 0\.16/g, 'absDiff < 0.225');
engineContent = engineContent.replace(/absDiff < 0\.15/g, 'absDiff < 0.225');
engineContent = engineContent.replace(/0\.15 - absDiff/g, '0.225 - absDiff');

// Expand the orbit radii distance significantly
// Old: const baseRadius = Math.min(canvasW, canvasH) * 0.65;
// New: const baseRadius = Math.min(canvasW, canvasH) * 0.90; 
engineContent = engineContent.replace(/Math\.min\(canvasW, canvasH\) \* 0\.65/g, 'Math.min(canvasW, canvasH) * 0.90');

fs.writeFileSync(engineFile, engineContent, 'utf8');
console.log('Spacing multiplied by 1.5x successfully applied');

