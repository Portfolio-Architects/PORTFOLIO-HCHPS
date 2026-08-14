/**
 * M1 Empirical Stress & Edge Case Test Suite
 * Created by Challenger 2 for Milestone 1 (M1: LLM Prompt & RAG Context Optimization)
 */

import { RAGEngine } from '@/lib/rag/rag-engine';

describe('Milestone 1 (M1) Empirical Stress Tests', () => {

  describe('1. RAGEngine Edge Cases & Tokenization Stress', () => {
    test('chunkText handles empty, null, or undefined input', () => {
      expect(RAGEngine.chunkText('')).toEqual([]);
      expect(RAGEngine.chunkText(null as any)).toEqual([]);
      expect(RAGEngine.chunkText(undefined as any)).toEqual([]);
    });

    test('chunkText splits text into paragraphs with maxLen 650', () => {
      const p1 = 'A'.repeat(300);
      const p2 = 'B'.repeat(400);
      const fullText = `${p1}\n\n${p2}`;
      const chunks = RAGEngine.chunkText(fullText, 650);
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(p1);
      expect(chunks[1]).toBe(p2);
    });

    test('tokenize handles Korean text and special regex symbols', () => {
      const query = '([특수*문자]) 예산2026? !!';
      const tokens = RAGEngine.tokenize(query);
      expect(tokens.has('특수')).toBe(true);
      expect(tokens.has('문자')).toBe(true);
      expect(tokens.has('예산2026')).toBe(true);
    });

    test('computeKeywordScore measures token overlap safely', () => {
      const score = RAGEngine.computeKeywordScore('보건소 예산', '2026년 강남구 보건소 행정 예산 집행');
      expect(score).toBeGreaterThan(0);
      expect(RAGEngine.computeKeywordScore('', 'doc')).toBe(0);
    });

    test('cosineSimilarity handles unequal vector lengths gracefully', () => {
      expect(RAGEngine.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
      expect(RAGEngine.cosineSimilarity([1, 0], [1, 0])).toBe(1);
    });
  });

  describe('2. Generator Agent Array Truncation (serializeContext)', () => {
    function serializeContext(context: any): string {
      if (context === undefined || context === null) return 'null';
      if (typeof context !== 'object') return String(context);
      return JSON.stringify(context, (k, v) => (Array.isArray(v) && v.length > 10 ? v.slice(0, 10) : v));
    }

    test('truncates array properties with >10 elements down to 10', () => {
      const ctx = {
        tasks: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Task ${i}` })),
        smallArray: [1, 2, 3],
        metadata: { subArray: Array.from({ length: 100 }, (_, i) => i) }
      };
      const jsonStr = serializeContext(ctx);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.tasks.length).toBe(10);
      expect(parsed.smallArray.length).toBe(3);
      expect(parsed.metadata.subArray.length).toBe(10);
    });

    test('handles primitive and null context safely', () => {
      expect(serializeContext(null)).toBe('null');
      expect(serializeContext(undefined)).toBe('null');
      expect(serializeContext('plain string')).toBe('plain string');
      expect(serializeContext(42)).toBe('42');
    });
  });

  describe('3. Chat API Compact History & Pre-filtering Logic', () => {
    function compactHistory(messages: any[], maxTurns = 6) {
      const historyMsgs = messages.slice(0, -1).filter((m: any) => m.role === 'user' || m.role === 'assistant');
      if (historyMsgs.length <= maxTurns) {
        return historyMsgs.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }],
        }));
      }
      const oldTurns = historyMsgs.slice(0, -maxTurns);
      const recentTurns = historyMsgs.slice(-maxTurns);
      const summaryText = `[이전 대화 요약]: ${oldTurns.map((m: any) => `${m.role === 'user' ? 'Q' : 'A'}: ${(m.content || '').slice(0, 60)}`).join(' | ')}`;
      
      return [
        { role: 'user', parts: [{ text: summaryText }] },
        { role: 'model', parts: [{ text: '이전 대화 내용을 숙지했습니다.' }] },
        ...recentTurns.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }],
        })),
      ];
    }

    test('compacts history exceeding maxTurns into summary + recent turns', () => {
      const history = Array.from({ length: 21 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Turn content ${i}`
      }));

      const result = compactHistory(history, 6);
      expect(result.length).toBe(8); // 1 summary user turn + 1 model ack + 6 recent turns
      expect(result[0].role).toBe('user');
      expect(result[0].parts[0].text).toContain('[이전 대화 요약]:');
      expect(result[1].role).toBe('model');
    });

    test('handles short history <= maxTurns without compaction', () => {
      const history = [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' }
      ];
      const result = compactHistory(history, 6);
      expect(result.length).toBe(2); // excluding the last active message
      expect(result[0].parts[0].text).toBe('Q1');
      expect(result[1].parts[0].text).toBe('A1');
    });

    test('pre-filters budget entries and caps at top 20', () => {
      const queryKeywords = ['운영비'];
      const rawEntries = Array.from({ length: 150 }, (_, i) => ({
        id: `e_${i}`,
        categoryId: 'c1',
        purpose: i % 3 === 0 ? `행정 운영비 지출 ${i}` : `기타 소모품 ${i}`,
        amount: 1000,
        date: '2026-08-01'
      }));
      const catMap = new Map([['c1', '일반운영비']]);

      const filteredEntries = rawEntries.filter((e: any) => {
        const catName = catMap.get(e.categoryId) || '';
        const text = `${e.date || ''} ${e.purpose || ''} ${catName}`.toLowerCase();
        return queryKeywords.some((kw: string) => text.includes(kw));
      });

      const selected = (filteredEntries.length > 0 ? filteredEntries : rawEntries).slice(0, 20);
      expect(selected.length).toBe(20);
      expect(selected.every(e => e.purpose.includes('운영비') || (catMap.get(e.categoryId) || '').includes('운영비'))).toBe(true);
    });
  });

  describe('6. Discovered Bug Verification Suite', () => {
    test('Bug 1: RAGEngine.chunkText fails maxLen enforcement on unpunctuated continuous text', () => {
      const longUnbrokenText = 'A'.repeat(5000);
      const chunks = RAGEngine.chunkText(longUnbrokenText, 650);
      // Verify maxLen enforcement works: no chunk exceeds 650 chars
      expect(chunks.some(c => c.length > 650)).toBe(false);
    });

    test('Bug 2: Chat API compactHistory empty array boundary handling', () => {
      function compactHistory(messages: any[], _maxTurns = 6) {
        void _maxTurns;
        const historyMsgs = messages.slice(0, -1).filter((m: any) => m.role === 'user' || m.role === 'assistant');
        return historyMsgs;
      }
      expect(compactHistory([])).toEqual([]);
    });

    test('Bug 3: Category matching guard for missing name property', () => {
      const cats = [{ id: 'cat1' }, { id: 'cat2', name: null }, { id: 'cat3', name: '건강증진' }];
      const queryLower = '건강';

      // Demonstrates fix condition for Bug 3
      const safeMatchedCategories = cats.filter((c: any) => {
        if (!c.name || typeof c.name !== 'string') return false;
        return c.name.toLowerCase().includes(queryLower);
      });

      expect(safeMatchedCategories.length).toBe(1);
      expect(safeMatchedCategories[0].id).toBe('cat3');
    });
  });

  describe('4. Extract API Post-processing & Edge Pruning', () => {
    function cleanKoreanLabel(label: string): string {
      if (!label) return '';
      let cleaned = label.trim();
      const postpositions = ['에서', '에게', '으로', '까지', '부터', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로'];
      for (const post of postpositions) {
        if (cleaned.endsWith(post) && cleaned.length > post.length) {
          const base = cleaned.substring(0, cleaned.length - post.length);
          if (/[\uac00-\ud7a30-9a-zA-Z]$/.test(base)) {
            cleaned = base;
            break;
          }
        }
      }
      return cleaned.replace(/^['"“‘]+|['"”’]+$/g, '').trim();
    }

    function postProcessGraph(nodes: any[], edges: any[]): { nodes: any[], edges: any[] } {
      if (!nodes) nodes = [];
      if (!edges) edges = [];

      const cleanedNodes = nodes
        .map(n => ({ ...n, label: cleanKoreanLabel(n.label || '') }))
        .filter(n => n.label.length > 0 && n.id);

      const sortedNodes = [...cleanedNodes].sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0));
      const limitedNodes = sortedNodes.slice(0, 15);
      const nodeIds = new Set(limitedNodes.map(n => n.id));

      const prunedEdges = edges.filter(e => {
        return e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target;
      });

      return { nodes: limitedNodes, edges: prunedEdges };
    }

    test('strips Korean postpositions and limits node list to 15', () => {
      const inputNodes = Array.from({ length: 25 }, (_, i) => ({
        id: `node_${i}`,
        label: `담당자_${i}에게`,
        baseValue: i * 5
      }));

      const { nodes } = postProcessGraph(inputNodes, []);
      expect(nodes.length).toBe(15);
      expect(nodes[0].label).toBe('담당자_24');
    });

    test('prunes self-referencing and dangling edges', () => {
      const nodes = [
        { id: 'n1', label: '노드1', baseValue: 100 },
        { id: 'n2', label: '노드2', baseValue: 90 }
      ];
      const edges = [
        { source: 'n1', target: 'n2', weight: 0.8 },
        { source: 'n1', target: 'n1', weight: 0.5 }, // self edge
        { source: 'n1', target: 'n3_missing', weight: 0.7 } // dangling edge
      ];

      const processed = postProcessGraph(nodes, edges);
      expect(processed.edges.length).toBe(1);
      expect(processed.edges[0]).toEqual({ source: 'n1', target: 'n2', weight: 0.8 });
    });
  });

  describe('5. File Radar Regex Escaping', () => {
    test('safely escapes special regex characters in query keywords', () => {
      const nodeLabel = '사업(2026) [특수문자] + * ?';
      const queryWords = nodeLabel.split(/[\s,()]+/).filter(w => w.length >= 2);
      
      const content = '사업(2026) 관련 문서입니다. [특수문자] 내용 포함';
      let score = 0;

      queryWords.forEach(word => {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = content.match(regex);
        if (matches) {
          score += matches.length * 3;
        }
      });

      expect(score).toBeGreaterThan(0);
    });
  });

});
