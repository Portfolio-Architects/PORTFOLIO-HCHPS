const FIXED_HOLIDAYS_SET = new Set<string>([
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 기독탄신일
]);

const DYNAMIC_HOLIDAYS_SET = new Set<string>([
  // 2026년 한정 유동 공휴일 (설날, 추석, 부처님오신날, 대체공휴일, 지방선거 등)
  '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-24', '2026-05-25', // 부처님오신날 + 대체공휴일
  '2026-06-03', // 제9회 전국동시지방선거
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28', // 추석 연휴 + 대체

  // 2025년
  '2025-01-28', '2025-01-29', '2025-01-30', // 설날
  '2025-03-03', // 삼일절 대체
  '2025-05-05', '2025-05-06', // 어린이날/부처님 대체
  '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', // 추석연휴
]);

export function isHoliday(dateStr: string | Date): boolean {
  let md: string;
  let ymd: string;

  if (typeof dateStr === 'string' && dateStr.length >= 10 && dateStr[4] === '-' && dateStr[7] === '-') {
    ymd = dateStr.slice(0, 10);
    md = dateStr.slice(5, 10);
  } else {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = day < 10 ? `0${day}` : `${day}`;
    md = `${mm}-${dd}`;
    ymd = `${d.getFullYear()}-${mm}-${dd}`;
  }

  return FIXED_HOLIDAYS_SET.has(md) || DYNAMIC_HOLIDAYS_SET.has(ymd);
}
