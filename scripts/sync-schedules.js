/**
 * SCHEDULE.md <--> data/SCHEDULES.json 양방향 동기화 CLI 스크립트
 * 
 * 실행:
 *   node scripts/sync-schedules.js [--json-to-md | --md-to-json]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT_DIR, 'data', 'SCHEDULES.json');
const MD_PATH = path.join(ROOT_DIR, 'SCHEDULE.md');

function generateGoogleCalendarUrl(schedule) {
  const cleanDate = (d) => (d || '').replace(/-/g, '');
  const cleanTime = (t) => (t || '').replace(/:/g, '') + '00';

  const startDateStr = cleanDate(schedule.date);
  const targetEndDateStr = cleanDate(schedule.endDate || schedule.date);
  const startParam = `${startDateStr}T${cleanTime(schedule.startTime || '09:00')}`;
  const endParam = `${targetEndDateStr}T${cleanTime(schedule.endTime || '10:00')}`;

  const typeLabels = {
    security: '보안',
    meeting: '회의',
    education: '교육',
    other: '기타'
  };

  const detailsArray = [
    `[유형] ${typeLabels[schedule.type] || schedule.type || '기타'}`,
    `[담당자/참석자] ${schedule.person || '담당자'}`,
  ];
  if (schedule.notes && schedule.notes.trim()) {
    detailsArray.push(`[비고] ${schedule.notes.trim()}`);
  }
  detailsArray.push(`\n(바이탈 VITAL 스케줄러에서 자동 연동됨)`);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[VITAL] ${schedule.title}`,
    dates: `${startParam}/${endParam}`,
    details: detailsArray.join('\n'),
    ctz: 'Asia/Seoul'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function jsonToMd() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ ${JSON_PATH} 파일이 존재하지 않습니다.`);
    return;
  }

  const rawJson = fs.readFileSync(JSON_PATH, 'utf-8');
  let schedules = [];
  try {
    schedules = JSON.parse(rawJson);
  } catch (e) {
    console.error('JSON 파싱 오류:', e);
    return;
  }

  if (!Array.isArray(schedules)) schedules = [];

  // 날짜 오름차순 정렬
  schedules.sort((a, b) => {
    const dComp = (a.date || '').localeCompare(b.date || '');
    if (dComp !== 0) return dComp;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  // 일자별 그룹화
  const grouped = new Map();
  for (const s of schedules) {
    const d = s.date || '날짜 미정';
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d).push(s);
  }

  const typeBadges = {
    security: '🛡️ 보안',
    meeting: '👥 회의',
    education: '📚 교육',
    other: '📌 기타'
  };

  const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];

  let mdContent = `# 📅 바이탈(VITAL) 업무 스케줄 타임라인\n\n`;
  mdContent += `> 💡 **안티그라비티 자연어 등록 안내**: 채팅창에 *"내일 14시 보건소 회의"* 등 편하게 입력하면 이 파일과 웹 대시보드(\`SCHEDULES.json\`)에 자동 반영됩니다.\n`;
  mdContent += `> 🔗 **구글 캘린더 실시간 구독 iCal URL**: \`http://localhost:3001/api/calendar/feed.ics\`\n\n`;
  mdContent += `---\n\n`;

  let totalCount = 0;
  for (const [dateStr, list] of grouped.entries()) {
    let dayStr = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const dObj = new Date(dateStr);
      const dayName = dayOfWeekNames[dObj.getDay()] || '';
      dayStr = ` (${dayName})`;
    }

    mdContent += `### 🗓️ ${dateStr}${dayStr}\n\n`;
    for (const item of list) {
      totalCount++;
      const timeRange = `${item.startTime || '09:00'} ~ ${item.endTime || '10:00'}`;
      const badge = typeBadges[item.type] || `📌 ${item.type}`;
      const personStr = item.person ? `(담당: ${item.person})` : '';
      const notesStr = item.notes ? ` - *${item.notes}*` : '';
      const gcalUrl = generateGoogleCalendarUrl(item);

      mdContent += `- [ ] **${timeRange}** | \`[${badge}]\` **${item.title}** ${personStr}${notesStr} [📅 구글캘린더 등록](${gcalUrl})\n`;
    }
    mdContent += `\n`;
  }

  mdContent += `---\n`;
  mdContent += `### 📊 스케줄 통계\n`;
  mdContent += `- **총 등록 일정**: ${totalCount}건\n`;
  mdContent += `- **최근 동기화 일시**: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`;

  fs.writeFileSync(MD_PATH, mdContent, 'utf-8');
  console.log(`✅ [JSON -> MD] SCHEDULE.md 동기화 완료! (총 ${totalCount}건)`);
}

function mdToJson() {
  if (!fs.existsSync(MD_PATH)) {
    console.error(`❌ ${MD_PATH} 파일이 존재하지 않습니다.`);
    return;
  }

  const content = fs.readFileSync(MD_PATH, 'utf-8');
  const lines = content.split('\n');

  let currentDate = '';
  const parsedSchedules = [];

  for (const line of lines) {
    const dateMatch = line.match(/^###\s+🗓️\s+(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    // 예: - [ ] **11:30 ~ 13:00** | `[🛡️ 보안]` **보안** (담당: 오창선) [📅 구글캘린더 등록](...)
    const itemMatch = line.match(/^-\s+\[([ xX])\]\s+\*\*(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})\*\*\s+\|\s+`\[([^\]]+)\]`\s+\*\*([^*]+)\*\*(?:\s+\(담당:\s*([^)]+)\))?(?:\s+-\s+\*([^*]+)\*)?/);
    if (itemMatch && currentDate) {
      const [, checked, startTime, endTime, rawBadge, title, person, notes] = itemMatch;

      let type = 'other';
      if (rawBadge.includes('보안')) type = 'security';
      else if (rawBadge.includes('회의')) type = 'meeting';
      else if (rawBadge.includes('교육')) type = 'education';

      parsedSchedules.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        title: title.trim(),
        type,
        person: (person || '담당자').trim(),
        date: currentDate,
        startTime,
        endTime,
        notes: (notes || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  if (parsedSchedules.length > 0) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(parsedSchedules, null, 2), 'utf-8');
    console.log(`✅ [MD -> JSON] data/SCHEDULES.json 동기화 완료! (총 ${parsedSchedules.length}건)`);
  } else {
    console.log('⚠️ 파싱된 일정이 없습니다.');
  }
}

const arg = process.argv[2];
if (arg === '--md-to-json') {
  mdToJson();
} else {
  jsonToMd();
}
