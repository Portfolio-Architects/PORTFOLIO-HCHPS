import React, { useState, useEffect } from 'react';
import { Search, X, FileText } from 'lucide-react';

export interface SearchResultItem {
  id: string;      
  title: string;   
  context: string; 
  source: string;  
}

export interface VectorResult {
  id: string;
  score?: number;
  metadata?: {
    text?: string;
  };
}

interface SearchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  results: SearchResultItem[]; // Keep for fallback or pure local results
}

export function SearchResultModal({ isOpen, onClose, query, results: localResults }: SearchResultModalProps) {
  const [semanticResults, setSemanticResults] = useState<VectorResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !query) return;

    // 채팅 모달이 열릴 때 시그널 캔버스의 구 위키 다큐를 닫아 화면을 깔끔하게 유지합니다.
    window.dispatchEvent(new CustomEvent('wiki:closeNode'));

    let isMounted = true;
    
    const runSearch = async () => {
      setIsLoading(true);
      setSemanticResults([]);
      setErrorMsg('');

      try {
        const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? '' : 'https://portfolio-hchps.pages.dev';

        // 1. Vectorize Semantic Search
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const { getAuthToken } = await import('@/lib/crypto');
          headers['Authorization'] = `Bearer ${getAuthToken()}`;
        } catch {
           // ignore
        }

        const searchRes = await fetch(`${apiBase}/api/semantic-search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, limit: 5 })
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.success && searchData.matches && isMounted) {
            setSemanticResults(searchData.matches);
          }
        } else {
          const errData = await searchRes.json().catch(() => ({}));
          const vectorizeError = errData.error || `HTTP ${searchRes.status}`;
          console.warn(`Vectorize search failed: ${vectorizeError}`);
          if (isMounted) setErrorMsg(vectorizeError);
        }
      } catch (e: unknown) {
        console.error("Vectorize search failed", e);
        if (isMounted) setErrorMsg(e instanceof Error ? e.message : 'Unknown network error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    runSearch();

    return () => { isMounted = false; };
  }, [isOpen, query, localResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60" onClick={onClose}>
      <div 
        className="pointer-events-auto bg-[var(--color-card)] rounded-xl shadow-xl w-full max-w-4xl overflow-hidden border border-[var(--color-border-light)] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-light)] bg-gradient-to-r from-blue-50/50 to-indigo-50/50 flex-shrink-0">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-sm">
              <Search size={22} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-gray-900 flex items-center gap-2">
                HCHPS 통합 검색
              </h3>
              <p className="text-[12px] text-gray-500 font-medium tracking-wide">" {query} " 검색 결과</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30 custom-scrollbar flex flex-col gap-4">
          
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 gap-3">
              <span className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
              <span className="text-sm font-medium">Vector DB에서 문서 탐색 중...</span>
            </div>
          )}
          
          {!isLoading && errorMsg && localResults.length === 0 && (
            <div className="text-sm font-medium text-red-500 bg-red-50 p-4 rounded-lg flex items-center gap-2">
              <X size={16} /> 오류 발생: {errorMsg}
            </div>
          )}

          {!isLoading && semanticResults.length === 0 && localResults.length === 0 && !errorMsg && (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3">
              <Search size={40} className="opacity-20 mb-2"/>
              <p className="text-[14px] font-medium text-gray-500 ml-1">관련 문서가 없습니다.</p>
            </div>
          )}

          {!isLoading && (semanticResults.length > 0 || localResults.length > 0) && (
            <div className="flex flex-col gap-3">
              {semanticResults.length > 0 
                ? semanticResults.map((doc, idx) => {
                    const nodeId = doc.id.replace('HCHPS-Wiki-', '');
                    return (
                      <button 
                        key={`sem-${idx}`} 
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('wiki:openNode', {
                            detail: { id: nodeId, label: nodeId }
                          }));
                          onClose();
                        }}
                        className="text-left flex flex-col gap-2 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[15px] font-bold text-[var(--color-primary)] group-hover:text-indigo-600 transition-colors">
                            <FileText size={16} className="inline mr-1" /> {nodeId}
                          </span>
                          <span className="text-[12px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors whitespace-nowrap">
                            열기 📄
                          </span>
                        </div>
                        <p className="text-[14px] text-gray-600 line-clamp-3 leading-relaxed mt-1">
                          {doc.metadata?.text || '(텍스트 없음)'}
                        </p>
                      </button>
                    );
                  })
                : localResults.map((res, idx) => {
                    const nodeId = res.id.replace('HCHPS-Wiki-', '');
                    const displayTitle = res.title.replace('온톨로지 문서 (', '').replace(')', '');
                    return (
                      <button 
                        key={`loc-${idx}`} 
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('wiki:openNode', {
                            detail: { id: nodeId, label: displayTitle }
                          }));
                          onClose();
                        }}
                        className="text-left flex flex-col gap-2 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[15px] font-bold text-[var(--color-primary)] group-hover:text-indigo-600 transition-colors">
                            <FileText size={16} className="inline mr-1" /> {displayTitle}
                          </span>
                          <span className="text-[12px] font-bold text-orange-500 bg-orange-50 px-2.5 py-1 rounded-md group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors whitespace-nowrap">
                            로컬 결과 📄
                          </span>
                        </div>
                        <p className="text-[14px] text-gray-600 line-clamp-3 leading-relaxed mt-1">
                          {res.context}
                        </p>
                      </button>
                    );
                  })
              }

              {/* Local Fallback Warning */}
              {semanticResults.length === 0 && localResults.length > 0 && (
                <div className="mt-2 text-[12px] text-orange-500 bg-orange-50 p-3 rounded-lg border border-orange-100/80 leading-relaxed font-medium">
                  Vectorize 검색 기록이 없어 브라우저 로컬 데이터(Fallback)를 반환했습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
