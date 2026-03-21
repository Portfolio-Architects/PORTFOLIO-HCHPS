export function isHoliday(dateStr: string | Date): boolean {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const md = `${mm}-${dd}`;
  const yyyy = d.getFullYear();
  const ymd = `${yyyy}-${mm}-${dd}`;

  // 고정 공휴일 (양력)
  const fixedHolidays = [
    '01-01', // 신정
    '03-01', // 삼일절
    '05-05', // 어린이날
    '06-06', // 현충일
    '08-15', // 광복절
    '10-03', // 개천절
    '10-09', // 한글날
    '12-25', // 기독탄신일
  ];

  if (fixedHolidays.includes(md)) return true;

  // 2026년 한정 유동 공휴일 (설날, 추석, 부처님오신날, 대체공휴일, 지방선거 등)
  const holidays2026 = [
    '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
    '2026-03-02', // 삼일절 대체공휴일
    '2026-05-24', '2026-05-25', // 부처님오신날 + 대체공휴일
    '2026-06-03', // 제9회 전국동시지방선거
    '2026-08-17', // 광복절 대체공휴일
    '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28', // 추석 연휴 + 대체
  ];

  // 2025년 (작년/내년 등을 위해 일부 추가할 수 있으나 임시로 2026년 위주 작성)
  const holidays2025 = [
    '2025-01-28', '2025-01-29', '2025-01-30', // 설날
    '2025-03-03', // 삼일절 대체
    '2025-05-05', '2025-05-06', // 어린이날/부처님 대체
    '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', // 추석연휴
  ];

  if (holidays2026.includes(ymd)) return true;
  if (holidays2025.includes(ymd)) return true;

  // 주말 제외 처리 (일, 토)? 이 함수는 법정 공휴일만 판단.
  // 과업에 따라 주말도 거를지는 호출부에서 판단(recurrenceDays에 토일이 없으면 안됨).
  
  return false;
}
