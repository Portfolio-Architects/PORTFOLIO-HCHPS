import { RAGEngine } from '../src/lib/rag/rag-engine';
import { BudgetPlanner } from '../src/lib/budget/budget-planner';
import { BudgetCategory, BudgetEntry } from '../src/types';

describe('Phase 9 - Hybrid RAG Engine Tests', () => {
  test('RAGEngine.chunkText splits long paragraphs correctly', () => {
    const text = '이 문장은 첫 번째 문단입니다. 매우 중요한 건강 정보를 담고 있습니다.\n\n이 문장은 두 번째 문단입니다. 예산 소진 관련 내용을 다룹니다.';
    const chunks = RAGEngine.chunkText(text, 50);
    
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('첫 번째 문단');
    expect(chunks[1]).toContain('두 번째 문단');
  });

  test('RAGEngine.tokenize extracts Bi-gram tokens and words', () => {
    const tokens = RAGEngine.tokenize('체육센터 비만예방');
    
    expect(tokens.has('체육센터')).toBe(true);
    expect(tokens.has('비만예방')).toBe(true);
    expect(tokens.has('체육')).toBe(true);
    expect(tokens.has('육센')).toBe(true);
    expect(tokens.has('센터')).toBe(true);
    expect(tokens.has('비만')).toBe(true);
    expect(tokens.has('예방')).toBe(true);
  });

  test('RAGEngine.computeKeywordScore evaluates text similarity', () => {
    const doc = '서울시 강남체육센터 비만예방 프로그램 운영 예산안';
    
    // Exact match sub-words
    const score1 = RAGEngine.computeKeywordScore('강남체육센터', doc);
    expect(score1).toBeGreaterThan(0);

    // Partial overlap postpositions
    const score2 = RAGEngine.computeKeywordScore('비만예방과 체육', doc);
    expect(score2).toBeGreaterThan(0);
    
    // No match
    const score3 = RAGEngine.computeKeywordScore('글로벌 마케팅 비즈니스', doc);
    expect(score3).toBe(0);
  });
});

describe('Phase 9 - Budget Velocity Planner Tests', () => {
  const dummyCategories: BudgetCategory[] = [
    {
      id: 'cat-1',
      name: '홍보물 제작비',
      totalBudget: 5000000, // 500만원
      color: '#10b981',
    },
    {
      id: 'cat-2',
      name: 'AI 스마트짐 비품 구매',
      totalBudget: 2000000, // 200만원
      color: '#3b82f6',
    }
  ];

  const dummyEntries: BudgetEntry[] = [
    // cat-1: 163일 동안 50만원만 씀 (연말 예상 지출 약 112만원 -> 잉여 예상)
    {
      id: 'e-1',
      categoryId: 'cat-1',
      amount: 500000,
      date: '2026-02-10',
      purpose: '리플릿 제작',
      isPlanned: false
    },
    // cat-2: 163일 동안 180만원을 씀 (연말 예상 지출 약 400만원 -> 적자 예상)
    {
      id: 'e-2',
      categoryId: 'cat-2',
      amount: 1800000,
      date: '2026-03-15',
      purpose: '비품 구매',
      isPlanned: false
    }
  ];

  test('BudgetPlanner.calculateForecasts calculates velocity and recommends reallocation', () => {
    const report = BudgetPlanner.calculateForecasts(dummyCategories, dummyEntries);
    
    // Overall Stats
    expect(report.totalBudget).toBe(7000000);
    expect(report.totalActualExpense).toBe(2300000);
    
    // Forecasts check
    const cat1Forecast = report.forecasts.find(f => f.categoryId === 'cat-1');
    const cat2Forecast = report.forecasts.find(f => f.categoryId === 'cat-2');
    
    expect(cat1Forecast).toBeDefined();
    expect(cat2Forecast).toBeDefined();
    
    // cat-1 is underutilized
    expect(cat1Forecast!.status).toBe('under_utilized');
    expect(cat1Forecast!.projectedBalance).toBeGreaterThan(2000000);
    
    // cat-2 is critical (over budget risk)
    expect(cat2Forecast!.status).toBe('critical');
    expect(cat2Forecast!.projectedBalance).toBeLessThan(0);
    
    // Reallocation Recommendation
    expect(report.recommendations.length).toBeGreaterThan(0);
    const rec = report.recommendations[0];
    expect(rec.fromCategoryId).toBe('cat-1');
    expect(rec.toCategoryId).toBe('cat-2');
    expect(rec.amount).toBeGreaterThan(0);
    expect(rec.reason).toContain('예산 초과');
  });
});
