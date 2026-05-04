const fs = require('fs');
let txt = fs.readFileSync('src/components/budget/BudgetDashboard.tsx', 'utf8');

const targetStr = `           if (reqAmount > subItemRemaining) {
             setEntryError(\`[\${subItemName}] 항목의 예산 한도가 부족합니다.\\n\\n해당 세부 항목 배정액: \${formatN(targetAmount)}원\\n세부 항목 가용 잔액: \${formatN(subItemRemaining)}원\\n\\n(참고: 통계목 전체 잔액이 남아있더라도 세부 항목 예산을 섞어 쓸 수 없습니다)\`.trim());
             return;
           }`;

// Wait, the string in the file probably has carriage returns. Let's just do an index based replace.
const lines = txt.split('\n');
let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (reqAmount > subItemRemaining) {') && lines[i+1].includes('setEntryError')) {
    newLines.push(lines[i]);
    newLines.push('             if (!window.confirm(`[${subItemName}] 항목의 배정 예산을 초과합니다.\\n\\n해당 세부 항목 배정액: ${formatN(targetAmount)}원\\n세부 항목 현재 잔액: ${formatN(subItemRemaining)}원\\n사용 예정액: ${formatN(reqAmount)}원\\n\\n(참고: 해당 비용은 통계목 내 공통 잔액에서 사용됩니다.)\\n\\n초과 지출 절차를 계속 진행하시겠습니까?`)) {');
    newLines.push('               return;');
    newLines.push('             }');
    newLines.push('           }');
    i += 3; // skip the next 3 lines
  } else {
    newLines.push(lines[i]);
  }
}

fs.writeFileSync('src/components/budget/BudgetDashboard.tsx', newLines.join('\n'));
