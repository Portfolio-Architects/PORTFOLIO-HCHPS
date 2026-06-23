const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'dashboard', 'PortfolioDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. "Lightweight Accordion: Detailed Asset Portfolio" 주석 위치 찾기
const startIndex = content.indexOf('{/* Lightweight Accordion: Detailed Asset Portfolio */}');
if (startIndex === -1) {
  console.error('Cannot find start comment');
  process.exit(1);
}

// 2. 파일 끝에서 "    </div>\n  );\n}" 혹은 "    </div>\r\n  );\r\n}" 부분을 찾는다.
// index를 찾기 위해 정규표현식을 사용할 수 없으므로, 줄바꿈을 통일하고 찾자.
const normalizedContent = content.replace(/\r\n/g, '\n');
const startIndexNormalized = normalizedContent.indexOf('{/* Lightweight Accordion: Detailed Asset Portfolio */}');
const endPattern = '    </div>\n  );\n}';
const endIndexNormalized = normalizedContent.lastIndexOf(endPattern);

if (endIndexNormalized === -1) {
  console.error('Cannot find end template block');
  process.exit(1);
}

// 3. 자르기
const beforeBreakdown = normalizedContent.substring(0, startIndexNormalized);
const afterBreakdown = normalizedContent.substring(endIndexNormalized);

// 4. WeeklyScheduler와 ContactsBox 마운트
const replacement = `      <div className="mt-8 mb-8 flex flex-col gap-8">
        <WeeklyScheduler />
        <ContactsBox />
      </div>
  `;

let newContent = beforeBreakdown + replacement + afterBreakdown;

// 5. 상단 임포트문에 WeeklyScheduler, ContactsBox 추가하기
if (!newContent.includes("import { WeeklyScheduler }")) {
  const importAnchor = "import { format } from 'date-fns';";
  const importAnchorIndex = newContent.indexOf(importAnchor);
  if (importAnchorIndex !== -1) {
    const beforeImport = newContent.substring(0, importAnchorIndex + importAnchor.length);
    const afterImport = newContent.substring(importAnchorIndex + importAnchor.length);
    newContent = beforeImport + "\nimport { WeeklyScheduler } from './WeeklyScheduler';\nimport { ContactsBox } from './ContactsBox';" + afterImport;
  } else {
    console.error("Cannot find import anchor");
    process.exit(1);
  }
}

// Windows의 원래 개행 문자로 복원
const finalContent = newContent.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('PortfolioDashboardView.tsx updated successfully with normalized line endings!');
