import { extractDate, extractTime, extractAmount, classifyAndParse } from '@/lib/korean-nlp';

describe('Korean NLP Logic Unit Tests', () => {
  beforeAll(() => {
    // Mock current date to a fixed date to ensure determinism
    jest.useFakeTimers({ now: new Date('2026-04-13T12:00:00Z').getTime() });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('extractDate', () => {
    it('순수 날짜 추출: "오늘", "내일" 같은 상대어 처리', () => {
      const today = extractDate('오늘 회의하자');
      expect(today?.date).toEqual('2026-04-13');
      const tomorrow = extractDate('내일 점심');
      expect(tomorrow?.date).toEqual('2026-04-14');
    });

    it('절대 날짜 추출: "4월 20일", "15일까지"', () => {
      const absDate = extractDate('4월 20일에 뵐게요');
      expect(absDate?.date).toEqual('2026-04-20');
      const dayDate = extractDate('15일까지 제출');
      expect(dayDate?.date).toEqual('2026-04-15');
    });
  });

  describe('extractTime', () => {
    it('오전/오후 포맷 파싱', () => {
      expect(extractTime('오후 3시 미팅')?.time).toEqual('15:00');
      expect(extractTime('오전 10시 30분 면담')?.time).toEqual('10:30');
    });

    it('콜론 포맷 처리 (HH:MM)', () => {
      expect(extractTime('14:30에 만나요')?.time).toEqual('14:30');
    });
  });

  describe('extractAmount', () => {
    it('단순/구어체 금액 변환', () => {
      expect(extractAmount('점심값 15,000원 결제')?.amount).toEqual(15000);
      expect(extractAmount('법인카드 3만원 추가')?.amount).toEqual(30000);
      expect(extractAmount('서버비 10만 원 지출')?.amount).toEqual(100000);
      expect(extractAmount('프로젝트 대금 1.5억')?.amount).toEqual(150000000);
    });
  });

  describe('classifyAndParse', () => {
    it('Task(업무)로 정확하게 분류되어야 함', () => {
      const result = classifyAndParse('오후 3시까지 기획안 작성해야 함');
      expect(result.type).toBe('task');
      expect(result.priority).toBe('high'); // "해야 함" -> high
    });

    it('Meeting(회의)으로 정확하게 분류되어야 함', () => {
      const result = classifyAndParse('내일 오전 10시 회의');
      expect(result.type).toBe('meeting');
      expect(result.date).toBe('2026-04-14');
      expect(result.time).toBe('10:00');
    });

    it('Budget(예산)으로 정확하게 분류되어야 함', () => {
      const result = classifyAndParse('사무용품 15,000원 구매');
      expect(result.type).toBe('budget');
      expect(result.amount).toBe(15000);
    });

    it('Query(지식/검색)로 분류되어야 함', () => {
      const result = classifyAndParse('김범수 본부장 연락처 알려줘');
      expect(result.type).toBe('query');
    });
  });
});
