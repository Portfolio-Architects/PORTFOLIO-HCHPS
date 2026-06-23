import { executeTaskWithSelfHealing } from '@/lib/agents/orchestrator';
import { askLlama } from '@/lib/llm-client';
import { z } from 'zod';

jest.mock('@/lib/llm-client', () => ({
  askLlama: jest.fn(),
}));

describe('Multi-Agent self-healing loop integration test', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().min(1),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1차 시도에 올바른 형식을 응답하면, 바로 성공해야 함', async () => {
    const mockLlama = askLlama as jest.Mock;
    
    // 1st call (Planner): returns plan array
    mockLlama.mockResolvedValueOnce(JSON.stringify(["Analyze goal", "Generate user JSON"]));
    // 2nd call (Generator): returns valid user JSON
    mockLlama.mockResolvedValueOnce(JSON.stringify({ name: 'Alice', age: 30 }));

    const result = await executeTaskWithSelfHealing(
      'Create a user profile',
      { defaultAge: 30 },
      schema
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.data).toEqual({ name: 'Alice', age: 30 });
  });

  it('1차 시도에 잘못된 형식을 응답하면, 피드백을 전달하여 2차 시도에 자가 치유(Self-Healing) 성공해야 함', async () => {
    const mockLlama = askLlama as jest.Mock;

    // 1st call (Planner): returns plan array
    mockLlama.mockResolvedValueOnce(JSON.stringify(["Analyze goal", "Generate user JSON"]));
    // 2nd call (Generator - Attempt 1): returns invalid user JSON (age is string instead of number)
    mockLlama.mockResolvedValueOnce(JSON.stringify({ name: 'Bob', age: 'thirty' }));
    // 3rd call (Generator - Attempt 2): returns corrected user JSON
    mockLlama.mockResolvedValueOnce(JSON.stringify({ name: 'Bob', age: 30 }));

    const result = await executeTaskWithSelfHealing(
      'Create a user profile',
      { defaultAge: 30 },
      schema
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.data).toEqual({ name: 'Bob', age: 30 });

    // Verify feedback was passed to the generator in the third call
    const generatorCallArgs = mockLlama.mock.calls[2][0][0].content;
    expect(generatorCallArgs).toContain('CRITICAL ERROR FROM PREVIOUS ATTEMPT');
    expect(generatorCallArgs).toContain('Field [age] - Invalid input: expected number, received string');
  });

  it('1차 시도에 JSON 파싱 불가한 깨진 데이터를 응답하면, 파싱 에러 피드백을 전달해 2차 시도에 성공해야 함', async () => {
    const mockLlama = askLlama as jest.Mock;

    // 1st call (Planner)
    mockLlama.mockResolvedValueOnce(JSON.stringify(["Analyze goal", "Generate user JSON"]));
    // 2nd call (Generator - Attempt 1): broken JSON
    mockLlama.mockResolvedValueOnce("Broken raw string { name: 'Bob', age: 30 }");
    // 3rd call (Generator - Attempt 2): returns corrected user JSON
    mockLlama.mockResolvedValueOnce(JSON.stringify({ name: 'Bob', age: 30 }));

    const result = await executeTaskWithSelfHealing(
      'Create a user profile',
      { defaultAge: 30 },
      schema
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.data).toEqual({ name: 'Bob', age: 30 });

    // Verify feedback contained JSON Parsing error
    const generatorCallArgs = mockLlama.mock.calls[2][0][0].content;
    expect(generatorCallArgs).toContain('JSON Parsing Failed');
  });

  it('모든 시도에 실패하면 결국 false를 반환해야 함', async () => {
    const mockLlama = askLlama as jest.Mock;

    // 1st call (Planner)
    mockLlama.mockResolvedValueOnce(JSON.stringify(["Analyze goal", "Generate user JSON"]));
    // 2nd, 3rd, 4th calls (Generator): invalid data
    mockLlama.mockResolvedValue(JSON.stringify({ name: 'Charlie', age: -5 })); // age must be min 1

    const result = await executeTaskWithSelfHealing(
      'Create a user profile',
      { defaultAge: 30 },
      schema,
      3
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.finalError).toContain('Field [age] - Too small');
  });
});
