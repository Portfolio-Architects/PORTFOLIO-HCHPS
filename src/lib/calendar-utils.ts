/**
 * Google Calendar & iCalendar (.ics) 유틸리티 모듈
 * 
 * - Google Calendar Web Intent URL 생성 (원클릭 등록)
 * - RFC 5545 표준 iCalendar (.ics) 피드 생성 및 파싱
 */

import { Schedule, ScheduleType } from '@/types';

/**
 * 일정을 구글 캘린더에 바로 등록할 수 있는 Web Intent URL을 생성합니다.
 */
export function generateGoogleCalendarUrl(schedule: Schedule): string {
  const { title, date, endDate, startTime, endTime, person, notes, type } = schedule;
  
  // 날짜/시간 정제 (YYYY-MM-DD -> YYYYMMDD, HH:mm -> HHmm00)
  const cleanDate = (d: string) => d.replace(/-/g, '');
  const cleanTime = (t: string) => t.replace(/:/g, '') + '00';

  const startDateStr = cleanDate(date);
  const targetEndDateStr = cleanDate(endDate || date);
  const startParam = `${startDateStr}T${cleanTime(startTime || '09:00')}`;
  const endParam = `${targetEndDateStr}T${cleanTime(endTime || '10:00')}`;

  const typeLabels: Record<ScheduleType, string> = {
    security: '보안',
    meeting: '회의',
    education: '교육',
    other: '기타'
  };

  const detailsArray = [
    `[유형] ${typeLabels[type] || type}`,
    `[담당자/참석자] ${person}`,
  ];
  if (notes && notes.trim()) {
    detailsArray.push(`[비고] ${notes.trim()}`);
  }
  detailsArray.push(`\n(바이탈 VITAL 스케줄러에서 자동 연동됨)`);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[VITAL] ${title}`,
    dates: `${startParam}/${endParam}`,
    details: detailsArray.join('\n'),
    ctz: 'Asia/Seoul'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Schedule 배열을 RFC 5545 표준 iCalendar (.ics) 텍스트로 변환합니다.
 */
export function generateIcsFeed(schedules: Schedule[], calendarName: string = 'VITAL 업무 스케줄'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PORTFOLIO VITAL//Schedule Calendar 1.0//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'X-LIC-LOCATION:Asia/Seoul',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const nowIcs = formatToUtcIcs(new Date().toISOString());

  for (const s of schedules) {
    if (!s.date) continue;
    const cleanDate = s.date.replace(/-/g, '');
    const cleanEndDate = (s.endDate || s.date).replace(/-/g, '');
    const cleanStart = (s.startTime || '09:00').replace(/:/g, '') + '00';
    const cleanEnd = (s.endTime || '10:00').replace(/:/g, '') + '00';

    const uid = s.id ? `${s.id}@vital.local` : `${Date.now()}-${Math.random().toString(36).substring(2, 7)}@vital.local`;
    const dtStamp = s.updatedAt ? formatToUtcIcs(s.updatedAt) : nowIcs;

    const desc = [
      `유형: ${s.type || '기타'}`,
      `담당자: ${s.person || '미지정'}`,
      s.notes ? `비고: ${s.notes}` : ''
    ].filter(Boolean).join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;TZID=Asia/Seoul:${cleanDate}T${cleanStart}`);
    lines.push(`DTEND;TZID=Asia/Seoul:${cleanEndDate}T${cleanEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(s.title || '무제')}`);
    if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
    lines.push(`CATEGORIES:${escapeIcsText(s.type || 'other')}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * iCalendar (.ics) 파일 텍스트를 Schedule[] 배열로 파싱합니다.
 */
export function parseIcsFeed(icsContent: string): Partial<Schedule>[] {
  const events: Partial<Schedule>[] = [];
  const lines = icsContent.split(/\r?\n/);
  
  let currentEvent: Partial<Schedule> | null = null;
  let currentKey = '';
  let currentValue = '';

  const commitField = () => {
    if (!currentEvent || !currentKey) return;
    const val = unescapeIcsText(currentValue);

    if (currentKey.startsWith('SUMMARY')) {
      currentEvent.title = val.replace(/^\[VITAL\]\s*/, '');
    } else if (currentKey.startsWith('DTSTART')) {
      // e.g. DTSTART;TZID=Asia/Seoul:20260827T140000 or DTSTART:20260827T140000Z
      const rawDate = val.split(':').pop() || '';
      const match = rawDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (match) {
        currentEvent.date = `${match[1]}-${match[2]}-${match[3]}`;
        currentEvent.startTime = `${match[4]}:${match[5]}`;
      }
    } else if (currentKey.startsWith('DTEND')) {
      const rawDate = val.split(':').pop() || '';
      const match = rawDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (match) {
        currentEvent.endDate = `${match[1]}-${match[2]}-${match[3]}`;
        currentEvent.endTime = `${match[4]}:${match[5]}`;
      }
    } else if (currentKey.startsWith('DESCRIPTION')) {
      currentEvent.notes = val.replace(/\\n/g, '\n');
      // 추출: 담당자
      const personMatch = val.match(/담당자:\s*([^\n\\]+)/);
      if (personMatch) {
        currentEvent.person = personMatch[1].trim();
      }
    } else if (currentKey.startsWith('CATEGORIES')) {
      const cat = val.toLowerCase();
      if (['security', 'meeting', 'education', 'other'].includes(cat)) {
        currentEvent.type = cat as ScheduleType;
      }
    } else if (currentKey.startsWith('UID')) {
      const idMatch = val.replace(/@.*$/, '');
      if (idMatch) currentEvent.id = idMatch;
    }
  };

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // Folded line continuation
      currentValue += line.substring(1);
      continue;
    }

    commitField();

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {
        type: 'other',
        person: '담당자',
        startTime: '09:00',
        endTime: '10:00'
      };
      currentKey = '';
      currentValue = '';
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (currentEvent && currentEvent.title && currentEvent.date) {
        events.push(currentEvent);
      }
      currentEvent = null;
      currentKey = '';
      currentValue = '';
      continue;
    }

    if (currentEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        currentKey = line.substring(0, colonIdx);
        currentValue = line.substring(colonIdx + 1);
      }
    }
  }

  commitField();
  return events;
}

// ============ Helper functions ============

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function unescapeIcsText(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function formatToUtcIcs(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '20260101T000000Z';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
