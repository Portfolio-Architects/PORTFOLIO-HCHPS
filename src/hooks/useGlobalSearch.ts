import { useState } from 'react';
import { SearchResultItem } from '@/components/SearchResultModal';
import { MapCustomizationData } from '@/hooks/useGraphCustomization';

export function useGlobalSearch() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const handleGlobalSearch = async (query: string) => {
    setSearchQuery(query);
    
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

    const wikiKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('HCHPS-Wiki-')) {
        wikiKeys.push(key);
      }
    }

    const results: SearchResultItem[] = [];
    const chunkSize = 15;
    
    for (let i = 0; i < wikiKeys.length; i += chunkSize) {
      const chunk = wikiKeys.slice(i, i + chunkSize);
      for (const key of chunk) {
        try {
          const blocks = JSON.parse(localStorage.getItem(key) || '[]');
          const text = extractTextFromBlocks(blocks);
          const nodeId = key.replace('HCHPS-Wiki-', '');
          
          let nodeLabel = nodeId;
          if (mapData) {
            const cNode = mapData.customNodes?.find((n) => n.id === nodeId);
            if (cNode && cNode.label) nodeLabel = cNode.label;
            
            const overrideLabel = mapData.overrides?.[nodeId]?.customLabel;
            if (overrideLabel) nodeLabel = overrideLabel;
          }

          if (nodeLabel === nodeId) {
            const parts = nodeId.split('-');
            nodeLabel = parts[parts.length - 1];
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
      // Yield to event loop between chunks to keep UI responsive
      if (i + chunkSize < wikiKeys.length) {
        await new Promise(r => setTimeout(r, 0));
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
