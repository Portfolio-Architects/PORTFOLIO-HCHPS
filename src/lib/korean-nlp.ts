/**
 * Korean Natural Language Parser
 * 정제되지 않은 한국어 텍스트에서 날짜, 시간, 금액, 사람, 장소, 우선순위를 추출하고
 * 업무(Task) / 미팅(Meeting) / 예산(Budget) 중 하나로 자동 분류합니다.
 */

// ============ Types ============

export type ParsedType = 'task' | 'meeting' | 'budget';

export interface ParsedResult {
  type: ParsedType;
  confidence: number; // 0-1
  title: string;
  date?: string;        // YYYY-MM-DD
  time?: string;        // HH:MM
  amount?: number;      // 금액 (원)
  people: string[];     // 참석자
  location?: string;    // 장소
  priority: 'low' | 'medium' | 'high';
  category?: string;    // 추출된 카테고리
  tags: string[];
  rawText: string;
}

// ============ Date Extraction ============

function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAY_MAP: Record<string, number> = {
  '일': 0, '일요일': 0,
  '월': 1, '월요일': 1,
  '화': 2, '화요일': 2,
  '수': 3, '수요일': 3,
  '목': 4, '목요일': 4,
  '금': 5, '금요일': 5,
  '토': 6, '토요일': 6,
};

function getNextWeekday(targetDay: number, weeksAhead: number = 0): Date {
  const today = getToday();
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  today.setDate(today.getDate() + diff + (weeksAhead * 7));
  return today;
}

export function extractDate(text: string): { date: string; matched: string } | null {
  const today = getToday();

  // 오늘, 내일, 모레
  if (/오늘/.test(text)) return { date: formatDate(today), matched: '오늘' };
  if (/내일/.test(text)) {
    const d = getToday(); d.setDate(d.getDate() + 1);
    return { date: formatDate(d), matched: '내일' };
  }
  if (/모레|모래/.test(text)) {
    const d = getToday(); d.setDate(d.getDate() + 2);
    return { date: formatDate(d), matched: '모레' };
  }
  if (/글피/.test(text)) {
    const d = getToday(); d.setDate(d.getDate() + 3);
    return { date: formatDate(d), matched: '글피' };
  }

  // 이번 주 / 다음 주 / 다다음 주 + 요일
  const weekPattern = /(이번\s*주|금주|이번주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)/;
  const thisWeekMatch = text.match(weekPattern);
  if (thisWeekMatch) {
    const dayName = thisWeekMatch[2];
    const targetDay = WEEKDAY_MAP[dayName];
    if (targetDay !== undefined) {
      const d = getToday();
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return { date: formatDate(d), matched: thisWeekMatch[0] };
    }
  }

  const nextWeekPattern = /(다음\s*주|다음주|차주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)/;
  const nextWeekMatch = text.match(nextWeekPattern);
  if (nextWeekMatch) {
    const dayName = nextWeekMatch[2];
    const targetDay = WEEKDAY_MAP[dayName];
    if (targetDay !== undefined) {
      return { date: formatDate(getNextWeekday(targetDay, 1)), matched: nextWeekMatch[0] };
    }
  }

  // 단독 요일 (이번 주 기준)
  const soloWeekday = text.match(/(월요일|화요일|수요일|목요일|금요일|토요일|일요일)까지|까지.*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/);
  if (soloWeekday) {
    const dayName = soloWeekday[1] || soloWeekday[2];
    const targetDay = WEEKDAY_MAP[dayName];
    if (targetDay !== undefined) {
      const d = getToday();
      const currentDay = d.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return { date: formatDate(d), matched: soloWeekday[0] };
    }
  }

  // M/D or M월 D일
  const mdPattern = /(\d{1,2})[\/\-월][\s]*(\d{1,2})일?/;
  const mdMatch = text.match(mdPattern);
  if (mdMatch) {
    const month = parseInt(mdMatch[1]);
    const day = parseInt(mdMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      const d = new Date(year, month - 1, day);
      if (d < today) d.setFullYear(year + 1);
      return { date: formatDate(d), matched: mdMatch[0] };
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const fullDatePattern = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
  const fullMatch = text.match(fullDatePattern);
  if (fullMatch) {
    return { date: `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`, matched: fullMatch[0] };
  }

  // N일 후, N일 뒤
  const daysLater = text.match(/(\d+)\s*일\s*(후|뒤|이?내)/);
  if (daysLater) {
    const d = getToday();
    d.setDate(d.getDate() + parseInt(daysLater[1]));
    return { date: formatDate(d), matched: daysLater[0] };
  }

  // N일 (까지) — day-only, meaning Nth of current/next month
  // e.g. "20일", "20일까지", "20일 까지"
  const dayOnly = text.match(/(\d{1,2})\s*일\s*(?:까지)?/);
  if (dayOnly) {
    const day = parseInt(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      // If that day already passed this month, use next month
      if (d < today) {
        d.setMonth(d.getMonth() + 1);
      }
      return { date: formatDate(d), matched: dayOnly[0] };
    }
  }

  return null;
}

// ============ Time Extraction ============

export function extractTime(text: string): { time: string; matched: string } | null {
  // 오전/오후 N시 (M분)
  const ampmPattern = /(오전|오후|아침|저녁)\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/;
  const ampmMatch = text.match(ampmPattern);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[2]);
    const minutes = ampmMatch[3] ? parseInt(ampmMatch[3]) : 0;
    const period = ampmMatch[1];
    if ((period === '오후' || period === '저녁') && hours < 12) hours += 12;
    if ((period === '오전' || period === '아침') && hours === 12) hours = 0;
    return { time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, matched: ampmMatch[0] };
  }

  // N시 (M분) - without AM/PM indicator, assume based on hour
  const timePattern = /(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/;
  const timeMatch = text.match(timePattern);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    // If hour <= 6, likely PM (업무시간 기준)
    if (hours >= 1 && hours <= 6) hours += 12;
    if (hours > 23) hours = hours % 24;
    return { time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, matched: timeMatch[0] };
  }

  // HH:MM format
  const colonTime = text.match(/(\d{1,2}):(\d{2})/);
  if (colonTime) {
    const h = parseInt(colonTime[1]);
    const m = parseInt(colonTime[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, matched: colonTime[0] };
    }
  }

  return null;
}

// ============ Amount Extraction ============

export function extractAmount(text: string): { amount: number; matched: string } | null {
  // N만원, N만 원
  const manwon = text.match(/(\d+(?:\.\d+)?)\s*만\s*원?/);
  if (manwon) {
    return { amount: parseFloat(manwon[1]) * 10000, matched: manwon[0] };
  }

  // N천원
  const cheonwon = text.match(/(\d+(?:\.\d+)?)\s*천\s*원?/);
  if (cheonwon) {
    return { amount: parseFloat(cheonwon[1]) * 1000, matched: cheonwon[0] };
  }

  // N,NNN원 or NNNN원
  const won = text.match(/([\d,]+)\s*원/);
  if (won) {
    const num = parseInt(won[1].replace(/,/g, ''));
    if (num > 0) return { amount: num, matched: won[0] };
  }

  // N억
  const eok = text.match(/(\d+(?:\.\d+)?)\s*억/);
  if (eok) {
    return { amount: parseFloat(eok[1]) * 100000000, matched: eok[0] };
  }

  return null;
}

// ============ Person Extraction ============

const TITLES = ['부장', '과장', '대리', '사원', '차장', '팀장', '실장', '본부장', '센터장', '이사', '상무', '전무', '부사장', '사장', '회장', '국장', '주임', '계장', '선생', '교수', '박사', '원장', '소장', '관장', '처장', '장관'];

export function extractPeople(text: string): string[] {
  const people: string[] = [];

  // 성 + 직급(님) pattern: 김부장, 이과장님
  const titlePattern = new RegExp(`([가-힣])\\s*(${TITLES.join('|')})(님)?`, 'g');
  let match;
  while ((match = titlePattern.exec(text)) !== null) {
    people.push(`${match[1]}${match[2]}`);
  }

  // Full name + 님: 홍길동님, 김철수 님
  const fullNamePattern = /([가-힣]{2,4})\s*님/g;
  while ((match = fullNamePattern.exec(text)) !== null) {
    // Skip if it's a common word, not a name
    const name = match[1];
    const skipWords = ['부장', '과장', '대리', '사원', '여러분', '선생', '담당자', '관계자', '참석자', '관련자'];
    if (!skipWords.includes(name) && !people.some(p => p.includes(name))) {
      people.push(name);
    }
  }

  return [...new Set(people)];
}

// ============ Location Extraction ============

const LOCATION_KEYWORDS = ['회의실', '사무실', '본사', '지사', '지점', '사옥', '센터', '카페', '식당', '레스토랑', '호텔', '강당', '세미나실', '교육장', '연수원', '컨벤션', 'zoom', 'teams', '온라인', '화상'];

export function extractLocation(text: string): string | null {
  // Pattern: N층 회의실, 본사 3층, etc.
  const floorRoom = text.match(/(\S*\d+\s*층\s*\S*(?:회의실|사무실|강당|세미나실)?|\S*(?:회의실|사무실|강당|세미나실)\s*\S*)/);
  if (floorRoom) return floorRoom[0].trim();

  for (const keyword of LOCATION_KEYWORDS) {
    const idx = text.indexOf(keyword);
    if (idx !== -1) {
      // Grab surrounding context
      const start = Math.max(0, idx - 6);
      const end = Math.min(text.length, idx + keyword.length + 4);
      return text.slice(start, end).trim();
    }
  }

  // ~에서 pattern
  const atPattern = text.match(/(\S{2,10})에서/);
  if (atPattern) {
    const loc = atPattern[1];
    if (LOCATION_KEYWORDS.some(k => loc.includes(k))) return loc;
  }

  return null;
}

// ============ Priority Extraction ============

export function extractPriority(text: string): 'low' | 'medium' | 'high' {
  if (/긴급|급한|급히|시급|ASAP|asap|중요|최우선|꼭|반드시|필수/.test(text)) return 'high';
  if (/천천히|여유|나중에|시간.?되면|가능하면/.test(text)) return 'low';
  if (/해야\s*함|해야\s*해|해야\s*됨|해야\s*된다/.test(text)) return 'high';
  return 'medium';
}

// ============ Extract ALL dates ============

function extractAllDates(text: string): { date: string; matched: string }[] {
  const today = getToday();
  const results: { date: string; matched: string; pos: number }[] = [];

  // 오늘, 내일, 모레, 글피
  const relDays: [RegExp, number][] = [[/오늘/, 0], [/내일/, 1], [/모레|모래/, 2], [/글피/, 3]];
  for (const [re, offset] of relDays) {
    const m = text.match(re);
    if (m) {
      const d = getToday(); d.setDate(d.getDate() + offset);
      results.push({ date: formatDate(d), matched: m[0], pos: m.index! });
    }
  }

  // M/D or M월 D일
  const mdRe = /(\d{1,2})[\/\-월]\s*(\d{1,2})일?/g;
  let mdM;
  while ((mdM = mdRe.exec(text)) !== null) {
    const month = parseInt(mdM[1]), day = parseInt(mdM[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), month - 1, day);
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      results.push({ date: formatDate(d), matched: mdM[0], pos: mdM.index! });
    }
  }

  // N일 후/뒤/내
  const laterRe = /(\d+)\s*일\s*(후|뒤|이?내)/g;
  let laterM;
  while ((laterM = laterRe.exec(text)) !== null) {
    const d = getToday(); d.setDate(d.getDate() + parseInt(laterM[1]));
    results.push({ date: formatDate(d), matched: laterM[0], pos: laterM.index! });
  }

  // N일 (까지) — day-only, e.g. "20일", "19일까지"
  const dayRe = /(\d{1,2})\s*일\s*(?:까지)?/g;
  let dayM;
  while ((dayM = dayRe.exec(text)) !== null) {
    // Skip if already matched by M월D일 or N일 후 patterns
    const alreadyMatched = results.some(r => r.pos <= dayM!.index! && r.pos + r.matched.length > dayM!.index!);
    if (alreadyMatched) continue;
    const day = parseInt(dayM[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d < today) d.setMonth(d.getMonth() + 1);
      results.push({ date: formatDate(d), matched: dayM[0], pos: dayM.index! });
    }
  }

  return results.sort((a, b) => a.pos - b.pos);
}

// ============ Title Cleaning ============

function cleanTitle(raw: string, removals: string[]): string {
  let title = raw;

  // Remove extracted segments (dates, times, amounts)
  for (const r of removals) {
    title = title.replace(r, ' ');
  }

  // Remove meta-action phrases (the act of registering, not the task)
  title = title.replace(/\s*(일정\s*(등록|잡기|추가)|업무\s*(등록|추가)|등록해\s*줘|등록해\s*주세요|추가해\s*줘|추가해\s*주세요|등록\s*부탁|메모해\s*줘|기록해\s*줘)\s*/g, ' ');
  // Trailing standalone "등록", "추가" that are meta-actions
  title = title.replace(/\s+(등록|추가|메모|기록)\s*$/, '');

  // Remove action-ending phrases
  title = title.replace(/\s*(해야\s*함|해야\s*해|해야\s*됨|해야\s*된다|해야\s*합니다|해\s*줘|해\s*주세요)\s*$/g, '');

  // Remove filler/connector words that don't add meaning
  title = title.replace(/\s*(있을|있는|없는|할\s*수?\s*있(게|도록)|할\s*수?\s*없|하게|되게|되도록)\s*/g, ' ');

  // Remove orphaned particles (에, 에서, 으로, 를, 을, 은, 는, 이, 가, 의)
  // These are cleaned AFTER the main removals to handle "20일에" → "에" left over
  title = title.replace(/\s+(에|에서|으로|부터|이랑|하고|과|와)\s+/g, ' ');
  // Leading particles (standalone)
  title = title.replace(/^\s*(에|을|를|은|는|이|가|의|에서)\s+/, '');
  // Trailing particles — both standalone and attached to last word
  title = title.replace(/\s+(에|을|를|은|는|이|가|의|에서)\s*$/, '');
  title = title.replace(/(을|를)\s*$/, ''); // attached: 준비를 → 준비

  // Remove "위한" when it becomes orphaned (nothing meaningful before it)
  title = title.replace(/^\s*위한\s+/, '');
  // Clean "를 위한" → just space
  title = title.replace(/\s*를\s+위한\s+/g, ' ');
  title = title.replace(/\s*을\s+위한\s+/g, ' ');

  // Collapse whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // Remove trailing commas, periods
  title = title.replace(/[,，.。、]+\s*$/, '').trim();

  return title;
}

// ============ Classification ============

const MEETING_KEYWORDS = ['회의', '미팅', 'meeting', '면담', '상담', '간담회', '회합', '브리핑', '보고회', '발표', '세미나', '워크샵', '워크숍', '토론', '논의', '협의', '점검회의', '조회', '석식', '오찬', '만남', '만나'];
const BUDGET_KEYWORDS = ['구매', '구입', '지출', '결제', '입금', '송금', '배정', '집행', '충당', '조달'];
const TASK_ACTION_KEYWORDS = ['해야', '까지', '제출', '완료', '작성', '처리', '보고', '마감', '확인', '검토', '준비', '정리', '진행', '수행', '실행', '점검'];

export function classifyAndParse(text: string): ParsedResult {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  // Extract all fields
  const allDates = extractAllDates(rawText);
  const dateResult = allDates.length > 0 ? allDates[0] : null;
  // For due date, pick the EARLIEST future date (that's when the task should be done)
  const bestDueDate = allDates.length > 0
    ? allDates.reduce((earliest, d) => d.date < earliest.date ? d : earliest).date
    : undefined;

  const timeResult = extractTime(rawText);
  const amountResult = extractAmount(rawText);
  const people = extractPeople(rawText);
  const location = extractLocation(rawText);
  const priority = extractPriority(rawText);

  // Classify
  let type: ParsedType = 'task';
  let confidence = 0.6;

  const hasMeetingKeyword = MEETING_KEYWORDS.some(k => lowerText.includes(k));
  const hasBudgetKeyword = BUDGET_KEYWORDS.some(k => lowerText.includes(k));
  const hasTaskAction = TASK_ACTION_KEYWORDS.some(k => lowerText.includes(k));
  const hasAmount = amountResult !== null;
  const hasPeople = people.length > 0;
  const hasTime = timeResult !== null;

  if (hasMeetingKeyword || (hasPeople && hasTime && !hasAmount)) {
    type = 'meeting';
    confidence = hasMeetingKeyword ? 0.95 : 0.7;
    if (hasPeople) confidence = Math.min(1, confidence + 0.1);
    if (hasTime) confidence = Math.min(1, confidence + 0.05);
  } else if ((hasAmount || hasBudgetKeyword) && !hasTaskAction) {
    type = 'budget';
    confidence = hasAmount ? 0.9 : 0.75;
    if (hasBudgetKeyword) confidence = Math.min(1, confidence + 0.1);
  } else {
    type = 'task';
    confidence = 0.7;
    if (allDates.length > 0) confidence += 0.1;
    if (hasTaskAction) confidence = Math.min(1, confidence + 0.15);
    if (hasBudgetKeyword) confidence = Math.min(1, confidence + 0.05);
  }

  // Build title: remove extracted segments, then clean
  const removals: string[] = [];
  allDates.forEach(d => removals.push(d.matched));
  if (timeResult) removals.push(timeResult.matched);
  if (amountResult) removals.push(amountResult.matched);

  let title = cleanTitle(rawText, removals);
  if (!title || title.length < 2) title = rawText;

  // Extract tags from meaningful words
  const tags: string[] = [];
  if (priority === 'high') tags.push('긴급');

  return {
    type,
    confidence,
    title,
    date: bestDueDate,
    time: timeResult?.time,
    amount: amountResult?.amount,
    people,
    location: location || undefined,
    priority,
    tags,
    rawText,
  };
}

