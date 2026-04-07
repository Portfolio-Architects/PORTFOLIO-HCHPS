import { classifyAndParse } from '../src/lib/korean-nlp';

describe('Korean NLP Parser', () => {
  it('identifies urgent meetings correctly', () => {
    const result = classifyAndParse('내일 오전 10시 김부장님과 긴급 면담');
    expect(result.type).toBe('meeting');
    expect(result.priority).toBe('high');
    expect(result.people).toContain('김부장');
    expect(result.time).toBe('10:00');
  });

  it('extracts budget amounts correctly', () => {
    const result = classifyAndParse('마케팅 솔루션 구독 비용 50만원 결제');
    expect(result.type).toBe('budget');
    expect(result.amount).toBe(500000);
  });
  
  it('identifies signal keywords', () => {
    const result = classifyAndParse('최근 타 부서 협업 거절 기류가 보임 관련 동향 파악 바람');
    expect(result.type).toBe('signal');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
