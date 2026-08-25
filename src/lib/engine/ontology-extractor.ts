import * as Y from 'yjs';
import { OntologyNode, OntologyEdge } from '@/lib/ontology.types';

export interface ExtractedGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

/**
 * 로컬 AI(Gemini) 추출 API를 호출하여 텍스트로부터 노드 및 관계(SPO) 구조를 추출합니다.
 */
export async function extractSemanticGraph(text: string): Promise<ExtractedGraph> {
  const response = await fetch('/api/llm/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '시맨틱 추출 실패');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '시맨틱 추출 실패');
  }

  return result.data as ExtractedGraph;
}

/**
 * 추출된 시맨틱 온톨로지 정보를 Yjs CRDT 협업 스토어에 안전하게 병합합니다.
 */
export function mergeExtractedGraph(ydoc: Y.Doc, extracted: ExtractedGraph) {
  if (!extracted || !extracted.nodes) return;

  ydoc.transact(() => {
    const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
    const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
    const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

    // 1. 추출 노드 병합
    for (let i = 0; i < extracted.nodes.length; i++) {
      const node = extracted.nodes[i];
      if (!node.id) continue;
      
      // 이미 존재하는 노드면 덮어쓰지 않고 스킵 (수동 오버라이드 보존)
      if (!customNodesMap.has(node.id)) {
        customNodesMap.set(node.id, {
          id: node.id,
          label: node.label || '이름 없음',
          group: node.group || 'OTHER',
          baseValue: node.baseValue ?? 80,
          layerId: node.layerId ?? 3, // 기본: 3 (위키/문서)
          centralityScore: 100,
        });
      }
    }

    // 2. 추출 엣지(관계) 병합
    if (extracted.edges) {
      for (let i = 0; i < extracted.edges.length; i++) {
        const edge = extracted.edges[i];
        if (!edge.source || !edge.target) continue;
        
        const edgeId = `${edge.source}|||${edge.target}`;
        const reverseId = `${edge.target}|||${edge.source}`;

        // 삭제 마킹 해제 (부활)
        if (deletedEdgesMap.has(edgeId)) deletedEdgesMap.delete(edgeId);
        if (deletedEdgesMap.has(reverseId)) deletedEdgesMap.delete(reverseId);

        // 중복 추가 방지
        if (!customEdgesMap.has(edgeId) && !customEdgesMap.has(reverseId)) {
          customEdgesMap.set(edgeId, {
            source: edge.source,
            target: edge.target,
            weight: edge.weight ?? 1.0,
            type: edge.type ?? 'DEPENDENCY',
          });
        }
      }
    }
  });
}
