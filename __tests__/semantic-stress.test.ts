// Recreate or extract cleanKoreanLabel and postProcessGraph logic to test directly.
function cleanKoreanLabel(label: string): string {
  if (!label) return '';
  let cleaned = label.trim();

  // Remove trailing Korean postpositions (조사)
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

  // Eliminate quotes and unnecessary outer spaces
  cleaned = cleaned.replace(/^['"“‘]+|['"”’]+$/g, '').trim();

  return cleaned;
}

function postProcessGraph(nodes: any[], edges: any[]): { nodes: any[], edges: any[] } {
  if (!nodes) nodes = [];
  if (!edges) edges = [];

  // 1. cleanKoreanLabel on all node labels
  const cleanedNodes = nodes
    .map(n => ({
      ...n,
      label: cleanKoreanLabel(n.label || '')
    }))
    .filter(n => n.label.length > 0 && n.id);

  // 2. Limit nodes to 15 (sort by baseValue descending and slice)
  const sortedNodes = [...cleanedNodes].sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0));
  const limitedNodes = sortedNodes.slice(0, 15);
  const nodeIds = new Set(limitedNodes.map(n => n.id));

  // 3. Prune dangling edges (edges where source or target is not in the 15 nodes list)
  // Also prune self-references (source === target)
  const prunedEdges = edges.filter(e => {
    return e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target;
  });

  return { nodes: limitedNodes, edges: prunedEdges };
}

// Recreate the SemanticReviewModal warning logic
function computeIntegrityWarnings(
  nodes: any[],
  edges: any[],
  existingNodeIds: Set<string>,
  getNodeLabelById: (id: string) => string
): string[] {
  const warnings: string[] = [];
  const nodeLabels = new Set<string>();
  const allAvailableNodeIds = new Set<string>();
  existingNodeIds.forEach(id => allAvailableNodeIds.add(id));
  nodes.forEach(n => allAvailableNodeIds.add(n.id));

  // 1. Check duplicate Names or IDs in pending
  nodes.forEach(n => {
    if (existingNodeIds.has(n.id)) {
      warnings.push(`노드 ID 중복: '${n.id}'(표시명: ${n.label})는 이미 마인드맵에 존재합니다. 병합 시 덮어써집니다.`);
    }
    if (nodeLabels.has(n.label)) {
      warnings.push(`노드 이름 중복: '${n.label}'이라는 이름의 노드가 검토 목록에 여러 개 포함되어 있습니다.`);
    }
    nodeLabels.add(n.label);
  });

  // 2. Check edges for self-references or dangling connections
  edges.forEach((e) => {
    const edgeName = `'${getNodeLabelById(e.source)} ➔ ${getNodeLabelById(e.target)}'`;
    if (e.source === e.target) {
      warnings.push(`자기 참조 관계: ${edgeName}는 스스로를 가리키는 관계입니다.`);
    }
    const sourceExists = allAvailableNodeIds.has(e.source);
    const targetExists = allAvailableNodeIds.has(e.target);

    if (!sourceExists || !targetExists) {
      const missing = !sourceExists && !targetExists 
        ? '출발 및 도착 노드' 
        : !sourceExists 
          ? `출발 노드('${e.source}')` 
          : `도착 노드('${e.target}')`;
      warnings.push(`미연결 관계(Dangling Edge): ${edgeName}의 ${missing}가 맵에 존재하지 않고 검토 목록에도 누락되어 있습니다.`);
    }
  });

  return warnings;
}

describe('AI Semantic Extraction - Stress & Edge-Case Unit Tests', () => {

  describe('cleanKoreanLabel', () => {
    it('should return empty string if input is empty or null', () => {
      expect(cleanKoreanLabel('')).toBe('');
      expect(cleanKoreanLabel(null as any)).toBe('');
    });

    it('should strip trailing postpositions correctly', () => {
      expect(cleanKoreanLabel('예산안의')).toBe('예산안');
      expect(cleanKoreanLabel('회의에서')).toBe('회의');
      expect(cleanKoreanLabel('업무를')).toBe('업무');
      expect(cleanKoreanLabel('부서로')).toBe('부서');
    });

    it('should preserve postposition when length is equal to the word itself', () => {
      expect(cleanKoreanLabel('는')).toBe('는');
      expect(cleanKoreanLabel('로')).toBe('로');
    });

    it('should preserve word ending with postposition character if preceding character is not syllable/alphanumeric', () => {
      expect(cleanKoreanLabel('!!!은')).toBe('!!!은');
    });

    it('should strip quotes around labels', () => {
      expect(cleanKoreanLabel('"기획안"')).toBe('기획안');
      expect(cleanKoreanLabel("'예산안'")).toBe('예산안'); // Note: '예산안' was not trimmed to '예안' which is correct
      expect(cleanKoreanLabel('“회의”')).toBe('회의');
    });

    it('should handle extremely long labels without crashing', () => {
      const longLabel = '가'.repeat(2000) + '의';
      expect(cleanKoreanLabel(longLabel)).toBe('가'.repeat(2000));
    });
  });

  describe('postProcessGraph', () => {
    it('should handle empty input arrays gracefully', () => {
      const result = postProcessGraph([], []);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should filter out nodes with empty labels or missing IDs', () => {
      const nodes = [
        { id: 'n1', label: '의', baseValue: 80 },
        { id: '', label: '정상', baseValue: 80 },
        { id: 'n2', label: '', baseValue: 80 }
      ];
      const result = postProcessGraph(nodes, []);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('n1');
    });

    it('should sort by baseValue descending and limit nodes to 15', () => {
      const nodes = Array.from({ length: 30 }, (_, i) => ({
        id: `node_${i}`,
        label: `노드_${i}`,
        baseValue: i
      }));
      const result = postProcessGraph(nodes, []);
      expect(result.nodes.length).toBe(15);
      expect(result.nodes[0].id).toBe('node_29');
      expect(result.nodes[14].id).toBe('node_15');
    });

    it('should prune dangling edges and self-references', () => {
      const nodes = Array.from({ length: 17 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
        baseValue: 100 - i
      }));
      const edges = [
        { source: 'n0', target: 'n1', weight: 0.5 },
        { source: 'n0', target: 'n0', weight: 0.5 },
        { source: 'n0', target: 'n15', weight: 0.5 },
        { source: 'n16', target: 'n1', weight: 0.5 },
        { source: 'n15', target: 'n16', weight: 0.5 },
      ];

      const result = postProcessGraph(nodes, edges);
      expect(result.nodes.length).toBe(15);
      expect(result.edges.length).toBe(1);
      expect(result.edges[0]).toEqual({ source: 'n0', target: 'n1', weight: 0.5 });
    });
  });

  describe('computeIntegrityWarnings', () => {
    const getNodeLabel = (id: string) => id.toUpperCase();

    it('should detect duplicate pending labels', () => {
      const nodes = [
        { id: 'n1', label: '회의' },
        { id: 'n2', label: '회의' }
      ];
      const warnings = computeIntegrityWarnings(nodes, [], new Set(), getNodeLabel);
      expect(warnings.some(w => w.includes('노드 이름 중복: \'회의\''))).toBe(true);
    });

    it('should detect duplicate ID with existing node', () => {
      const nodes = [
        { id: 'n1', label: '새노드' }
      ];
      const existing = new Set(['n1']);
      const warnings = computeIntegrityWarnings(nodes, [], existing, getNodeLabel);
      expect(warnings.some(w => w.includes('노드 ID 중복: \'n1\''))).toBe(true);
    });

    it('should detect self-referencing edge', () => {
      const edges = [
        { source: 'n1', target: 'n1' }
      ];
      const warnings = computeIntegrityWarnings([{ id: 'n1', label: 'N1' }], edges, new Set(), getNodeLabel);
      expect(warnings.some(w => w.includes('자기 참조 관계'))).toBe(true);
    });

    it('should detect dangling edge', () => {
      const edges = [
        { source: 'n1', target: 'n2' }
      ];
      const warnings = computeIntegrityWarnings([{ id: 'n1', label: 'N1' }], edges, new Set(), getNodeLabel);
      expect(warnings.some(w => w.includes('미연결 관계(Dangling Edge)'))).toBe(true);
    });
  });
});
