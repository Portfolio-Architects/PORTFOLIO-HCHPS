import { useState, useCallback } from 'react';
import { SearchResultItem } from '@/components/SearchResultModal';
import { MapCustomizationData } from '@/hooks/useGraphCustomization';

function extractTextBuffer(blocks: unknown[], out: string[]) {
  if (!Array.isArray(blocks)) return;
  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const block = blocks[bIdx] as { content?: unknown; children?: unknown[] };
    if (block.content && Array.isArray(block.content)) {
      for (let cIdx = 0; cIdx < block.content.length; cIdx++) {
        const item = block.content[cIdx] as { text?: string };
        if (item && item.text) out.push(item.text);
      }
      out.push('\n');
    } else if (typeof block.content === 'string') {
      out.push(block.content, '\n');
    }
    if (block.children && Array.isArray(block.children)) {
      extractTextBuffer(block.children, out);
      out.push('\n');
    }
  }
}

function matchesAllTerms(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  for (let j = 0; j < terms.length; j++) {
    if (!lower.includes(terms[j])) return false;
  }
  return true;
}

function getSearchContext(text: string, firstTerm: string): string {
  const matchIndex = firstTerm ? text.toLowerCase().indexOf(firstTerm) : 0;
  const start = Math.max(0, matchIndex - 200);
  return (start > 0 ? '... ' : '') + text.slice(start, start + 1000) + (text.length > start + 1000 ? '...' : '');
}

export function useGlobalSearch() {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const handleGlobalSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    // 제거할 특수문자들 (?, /) 을 지우고 실제 검색할 단어만 추출
    const cleanQuery = query.replace(/^[/?]+|[/?]+$/g, '').trim().toLowerCase();
    if (!cleanQuery) return;
    
    const terms = cleanQuery.split(/\s+/);
    const firstTerm = terms[0] || '';

    let mapData: MapCustomizationData | null = null;
    try {
      mapData = JSON.parse(localStorage.getItem('hchps-map-customization') || '{}') as MapCustomizationData;
    } catch {}

    const customNodesMap = new Map<string, string>();
    if (mapData?.customNodes) {
      for (const n of mapData.customNodes) {
        if (n.label) customNodesMap.set(n.id, n.label);
      }
    }

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
      for (let c = 0; c < chunk.length; c++) {
        const key = chunk[c];
        try {
          const blocks = JSON.parse(localStorage.getItem(key) || '[]');
          const textChunks: string[] = [];
          extractTextBuffer(blocks, textChunks);
          const text = textChunks.join('');
          const nodeId = key.replace('HCHPS-Wiki-', '');
          
          let nodeLabel = customNodesMap.get(nodeId) || (mapData?.overrides?.[nodeId]?.customLabel) || nodeId;

          if (nodeLabel === nodeId) {
            const lastHyphen = nodeId.lastIndexOf('-');
            if (lastHyphen !== -1) {
              nodeLabel = nodeId.slice(lastHyphen + 1);
            }
          }
          
          const searchableText = `${nodeLabel}\n${text}`;
          if (matchesAllTerms(searchableText, terms)) {
            results.push({
              id: key,
              title: `온톨로지 문서 (${nodeLabel})`,
              source: '위키 저장소',
              context: getSearchContext(searchableText, firstTerm)
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
  }, []);

  const closeSearchModal = useCallback(() => {
    setSearchModalOpen(false);
  }, []);

  return {
    searchModalOpen,
    searchQuery,
    searchResults,
    handleGlobalSearch,
    closeSearchModal
  };
}

