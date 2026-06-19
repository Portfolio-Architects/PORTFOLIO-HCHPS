import { useState } from 'react';
import { SearchResultItem } from '@/components/SearchResultModal';
import { MapCustomizationData } from '@/hooks/useGraphCustomization';

export function useGlobalSearch() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const handleGlobalSearch = (query: string) => {
    setSearchQuery(query);
    const results: SearchResultItem[] = [];
    
    // 제거할 특수문자들 (?, /) 을 지우고 실제 검색할 단어만 추출
    const cleanQuery = query.replace(/^[/?]+|[/?]+$/g, '').trim().toLowerCase();
    if (!cleanQuery) return;
    
    const terms = cleanQuery.split(/\s+/);

    const matchesTerms = (text: string) => {
      const lower = text.toLowerCase();
      return terms.every(t => lower.includes(t));
    };

    const extractTextFromBlocks = (blocks: unknown[]): string => {
      if (!Array.isArray(blocks)) return '';
      let text = '';
      for (const b of blocks || []) {
        const block = b as { content?: unknown, children?: unknown[] };
        if (block.content && Array.isArray(block.content)) {
          text += block.content.map((c: { text?: string }) => c.text || '').join('') + '\n';
        } else if (typeof block.content === 'string') {
          text += block.content + '\n';
        }
        if (block.children) text += extractTextFromBlocks(block.children) + '\n';
      }
      return text;
    };

    const getContext = (text: string): string => {
      const firstTerm = terms[0] || '';
      const matchIndex = firstTerm ? text.toLowerCase().indexOf(firstTerm) : 0;
      const start = Math.max(0, matchIndex - 200);
      return (start > 0 ? '... ' : '') + text.slice(start, start + 1000) + (text.length > start + 1000 ? '...' : '');
    };

    let mapData: MapCustomizationData | null = null;
    try {
      mapData = JSON.parse(localStorage.getItem('hchps-map-customization') || '{}') as MapCustomizationData;
    } catch {}

    // 1. Search Wiki Storage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('HCHPS-Wiki-')) {
        try {
          const blocks = JSON.parse(localStorage.getItem(key) || '[]');
          const text = extractTextFromBlocks(blocks);
          const nodeId = key.replace('HCHPS-Wiki-', '');
          
          let nodeLabel = nodeId;
          if (mapData) {
            // 1. 커스텀 노드인지 확인
            const cNode = mapData.customNodes?.find((n) => n.id === nodeId);
            if (cNode && cNode.label) nodeLabel = cNode.label;
            
            // 2. 오버라이드된 이름이 있다면 최우선
            const overrideLabel = mapData.overrides?.[nodeId]?.customLabel;
            if (overrideLabel) nodeLabel = overrideLabel;
          }

          // fallback for auto-generated signal nodes (leaf-tag-XX-LABEL or tag-LABEL)
          if (nodeLabel === nodeId) {
            const parts = nodeId.split('-');
            nodeLabel = parts[parts.length - 1]; // fallback to the last part
          }
          
          const searchableText = `${nodeLabel}\n${text}`;
          if (matchesTerms(searchableText)) {
            results.push({
              id: key,
              title: `온톨로지 문서 (${nodeLabel})`,
              source: '위키 저장소',
              context: getContext(searchableText)
            });
          }
        } catch (e) {
          console.error('[Search Debug] error parsing wiki blocks', e);
        }
      }
    }

    setSearchResults(results);
    setSearchModalOpen(true);
  };

  const closeSearchModal = () => setSearchModalOpen(false);

  return {
    searchModalOpen,
    searchQuery,
    searchResults,
    handleGlobalSearch,
    closeSearchModal
  };
}
