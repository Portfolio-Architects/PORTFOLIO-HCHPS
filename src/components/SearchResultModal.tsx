import React, { useState, useEffect } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';

function highlightKeyword(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, idx) => 
        regex.test(part) 
          ? <mark key={idx} className="highlight">{part}</mark> 
          : part
      )}
    </>
  );
}

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
  appMode?: 'HCHPS' | 'VITAL';
}

export function SearchResultModal({ isOpen, onClose, query, results: localResults, appMode = 'VITAL' }: SearchResultModalProps) {
  const [semanticResults, setSemanticResults] = useState<VectorResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const semanticSearchMutation = useSemanticSearch();

  useEffect(() => {
    if (!isOpen || !query) return;

    // 채팅 모달이 열릴 때 시그널 캔버스의 구 위키 다큐를 닫아 화면을 깔끔하게 유지합니다.
    window.dispatchEvent(new CustomEvent('wiki:closeNode'));

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSemanticResults([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrorMsg('');

    semanticSearchMutation.mutate({
      query,
      limit: 5
    }, {
      onSuccess: (matches) => {
        if (isMounted) {
          setSemanticResults(matches);
        }
      },
      onError: (err: any) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Unknown network error');
        }
      },
      onSettled: () => {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => { isMounted = false; };
  }, [isOpen, query, localResults, semanticSearchMutation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md transition-opacity duration-300" onClick={onClose}>
      <div 
        className="pointer-events-auto glass-panel rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-300 scale-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4.5 border-b border-white/20 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 flex-shrink-0">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-sm">
              <Search size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-slate-800 flex items-center gap-2">
                {appMode} 통합 검색
              </h3>
              <p className="text-[11px] text-slate-500 font-bold tracking-wide mt-0.5">💬 &quot;{query}&quot; 검색 결과</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/20 custom-scrollbar flex flex-col gap-4">
          
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
              <span className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
              <span className="text-xs font-semibold tracking-wide">Vector DB에서 최적 문서 탐색 중...</span>
            </div>
          )}
          
          {!isLoading && errorMsg && localResults.length === 0 && (
            <div className="text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-2">
              <X size={15} /> 검색 로드 장애: {errorMsg}
            </div>
          )}

          {!isLoading && semanticResults.length === 0 && localResults.length === 0 && !errorMsg && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
              <Search size={36} className="opacity-25 mb-1.5 text-slate-400"/>
              <p className="text-[13px] font-bold text-slate-500">지식베이스 내 관련 문서를 찾지 못했습니다.</p>
            </div>
          )}

          {!isLoading && (semanticResults.length > 0 || localResults.length > 0) && (
            <div className="flex flex-col gap-3.5">
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
                        className="text-left flex flex-col gap-2 p-5 bg-white/70 backdrop-blur-xs border border-slate-200/50 rounded-2xl shadow-2xs hover:border-indigo-400 hover:shadow-md hover:scale-[1.005] hover:bg-white transition-all duration-150 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[14.5px] font-bold text-slate-800 group-hover:text-[var(--color-primary)] transition-colors">
                            <FileText size={15} className="inline mr-1.5 text-indigo-500" /> {nodeId}
                          </span>
                          <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-500/10 border border-indigo-500/15 px-2.5 py-1 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-all duration-150 whitespace-nowrap shadow-2xs">
                            지식스캔 열기 📄
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed mt-1 font-medium">
                          {highlightKeyword(doc.metadata?.text || '(텍스트 없음)', query)}
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
                        className="text-left flex flex-col gap-2 p-5 bg-white/70 backdrop-blur-xs border border-slate-200/50 rounded-2xl shadow-2xs hover:border-orange-400 hover:shadow-md hover:scale-[1.005] hover:bg-white transition-all duration-150 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[14.5px] font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                            <FileText size={15} className="inline mr-1.5 text-orange-500" /> {displayTitle}
                          </span>
                          <span className="text-[10.5px] font-bold text-orange-700 bg-orange-500/10 border border-orange-500/15 px-2.5 py-1 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-all duration-150 whitespace-nowrap shadow-2xs">
                            로컬 문서 열기 📄
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-600 line-clamp-3 leading-relaxed mt-1 font-medium">
                          {highlightKeyword(res.context, query)}
                        </p>
                      </button>
                    );
                  })
              }

              {/* Local Fallback Warning */}
              {semanticResults.length === 0 && localResults.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/15 p-3.5 rounded-xl leading-relaxed font-semibold">
                  💡 Vectorize 검색 기록이 없어 브라우저 캐시 데이터(로컬 Fallback)를 반환했습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
