const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '..', 'PORTFOLIO VITAL - Engineering Report.md');
const milestonesPath = path.join(__dirname, '..', 'PORTFOLIO VITAL - Engineering Milestones.md');

// 1. Update PORTFOLIO VITAL - Engineering Report.md
let report = fs.readFileSync(reportPath, 'utf8');

// Fix accidental insertion at line 628 if present
const badIdxStart = report.indexOf('  - 100ms 이내에 연쇄 발생하는 REST API- **Requirement R2');
if (badIdxStart !== -1) {
  const badIdxEnd = report.indexOf('  - REST API `syncDataSheets`');
  if (badIdxEnd !== -1) {
    const badSnippet = report.substring(badIdxStart, badIdxEnd);
    report = report.replace(badSnippet, '  - 100ms 이내에 연쇄 발생하는 REST API 요청이 메인 스레드를 블로킹하던 현상을 개선했습니다.\n');
    console.log('Fixed bad snippet in Engineering Report');
  }
}

const targetMarker = '*상세한 전체 마일스톤 패치 내역은 [PORTFOLIO VITAL - Engineering Report.md]';
const patchEntryText = `- [Localhost UX Optimization] R1 Data Hydration & Optimistic Hooks, R2 LocalhostStatusHUD component, R3 CommandPalette Ctrl+K modal, R4 Zero-Stall & Offline Reliability 패치 (2026-07-23)
  - **R1 (Data Hydration & Optimistic Hooks)**: \`useTasks\` 훅 낙관적 업데이트(Optimistic Update) 및 CRUD 수행 시 자동 UI 갱신 구현, React Query staleTime/gcTime 설정.
  - **R2 (LocalhostStatusHUD Component)**: Port 3001 응답 상태 및 핑 latency, 브라우저/노드 힙 메모리, 3계층 백업 수량, 데몬 상태를 프로빙하는 HUD 컴포넌트 탑재.
  - **R3 (CommandPalette Ctrl+K Modal)**: 전역 \`Ctrl+K\` / \`Cmd+K\` 키보드 숏컷 명령 팔레트 모달, 카테고리별 다중 토큰 시맨틱 검색 및 ARIA 포커스 트래핑 지원.
  - **R4 (Zero-Stall & Offline Reliability)**: 60ms+ 메인 스레드 프리징 감지기, 탭 이탈 시 물리 엔진 freeze 및 visibilitychange 0ms 복구, 오프라인 툼스톤 동기화 대기열 수립.

`;

const lastIdx = report.lastIndexOf(targetMarker);
if (lastIdx !== -1) {
  report = report.slice(0, lastIdx) + patchEntryText + report.slice(lastIdx);
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('Successfully updated PORTFOLIO VITAL - Engineering Report.md');
} else {
  console.error('Target marker not found in Engineering Report');
}

// 2. Update PORTFOLIO VITAL - Engineering Milestones.md
let milestones = fs.readFileSync(milestonesPath, 'utf8');
const milestoneHeader = '## 8. 최근 엔지니어링 마일스톤 (요약)\n\n';
const newMilestoneEntry = `### [Localhost UX Optimization] R1 Data Hydration & Optimistic Hooks, R2 LocalhostStatusHUD component, R3 CommandPalette Ctrl+K modal, R4 Zero-Stall & Offline Reliability 패치 (2026-07-23)
* **Localhost UX Optimization**:
  - **R1 (Data Hydration & Optimistic Hooks)**: \`useTasks\` optimistic updates, automatic state sync on task CRUD.
  - **R2 (LocalhostStatusHUD Component)**: Port 3001 health probing, 3-tier backup archive stats, process memory indicator.
  - **R3 (CommandPalette Ctrl+K Modal)**: Multi-token search, section-grouped quick navigation, focus trapping.
  - **R4 (Zero-Stall & Offline Reliability)**: Page freeze detector, offline tombstone sync, zero-stall guarantee.

`;

if (milestones.includes(milestoneHeader)) {
  milestones = milestones.replace(milestoneHeader, milestoneHeader + newMilestoneEntry);
  fs.writeFileSync(milestonesPath, milestones, 'utf8');
  console.log('Successfully updated PORTFOLIO VITAL - Engineering Milestones.md');
} else {
  console.error('Milestone header not found in Engineering Milestones');
}
