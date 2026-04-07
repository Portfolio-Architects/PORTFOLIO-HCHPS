import React, { useState, useEffect } from 'react';
import { Search, X, Bot, Sparkles, FileText, ChevronRight } from 'lucide-react';
import { askLlama } from '@/lib/llm-client';

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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'searching' | 'thinking' | 'done'>('idle');

  // scroll to bottom ref
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, phase]);

  useEffect(() => {
    if (!isOpen || !query) return;

    // 채팅 모달이 열릴 때 시그널 캔버스의 구 위키 다큐를 닫아 화면을 깔끔하게 유지합니다.
    window.dispatchEvent(new CustomEvent('wiki:closeNode'));

    let isMounted = true;
    
    const runRagPipeline = async () => {
      setPhase('searching');
      setIsLoading(true);
      setSemanticResults([]);
      setMessages([]);

      try {
        const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? '' : 'https://portfolio-hchps.pages.dev';

        // 1. Vectorize Semantic Search
        let retrievedDocs: VectorResult[] = [];
        try {
          const storedKey = localStorage.getItem('hchps_master_key');
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (storedKey) headers['X-API-Key'] = storedKey;

          const searchRes = await fetch(`${apiBase}/api/semantic-search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, limit: 3 })
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.success && searchData.matches) {
              retrievedDocs = searchData.matches;
            }
          } else {
            console.warn(`Vectorize search failed with status: ${searchRes.status}`);
          }
        } catch (e) {
          console.error("Vectorize search failed", e);
        }

        if (!isMounted) return;
        setSemanticResults(retrievedDocs);
        setPhase('thinking');

        // 2. Llama 3 RAG Generation - Apply truncation to prevent Cloudflare AI Error 1031 (Max Context Tokens exceeded)
        const truncateText = (text: string, maxLen: number) => 
          text && text.length > maxLen ? text.substring(0, maxLen) + '...' : (text || '');

        let contextText = retrievedDocs.slice(0, 3).map(doc => 
          `[Source: ${doc.id}]\n${truncateText(doc.metadata?.text || '', 1500)}`
        ).join('\n\n');

        // Fallback to local exact match results if Vectorize is empty (e.g. dev mode without Wrangler)
        if (retrievedDocs.length === 0 && localResults.length > 0) {
          contextText = localResults.slice(0, 3).map(r => `[Source: ${r.title}]\n${truncateText(r.context, 1500)}`).join('\n\n');
        }

        if (retrievedDocs.length === 0 && localResults.length === 0) {
          if (isMounted) {
            setMessages([
              { role: 'user', content: query },
              { role: 'assistant', content: '아직 위키에 관련 문서가 등록되지 않았습니다.' }
            ]);
            setPhase('done');
            setIsLoading(false);
          }
          return;
        }

        // Hard cap the entire RAG context injection to ~4500 chars to guarantee it stays below Llama-3's CF limit
        if (contextText.length > 4500) {
          contextText = contextText.substring(0, 4500) + '\n... (이하 생략)';
        }

        const prompt = `사용자 질문: "${query}"

[관련 문서]
${contextText}

[절대 가이드라인]
1. 당신은 제공된 [관련 문서] 바탕으로만 답변하는 엄격한 내부 위키 AI입니다.
2. [관련 문서]에 없는 사전 지식이나 외부 데이터를 절대로 섞어서 답변하지 마시오.
3. [관련 문서] 내용을 바탕으로 질문에 대한 충분한 답변을 찾을 수 없다면, 다른 내용을 덧붙이지 말고 정확히 "아직 위키에 해당 내용이 등록되지 않았습니다." 라고만 답변하십시오.
4. 마크다운 형식으로 가독성 좋고 전문적으로 작성하시오.`;

        const answer = await askLlama([
          { 
            role: 'system', 
            content: 'You are a strict corporate knowledge assistant. You MUST strictly adhere to the provided context. NEVER hallucinate or use external knowledge. If the context does not contain the answer, reply only with "아직 위키에 해당 내용이 등록되지 않았습니다."' 
          },
          { role: 'user', content: prompt }
        ]);

        if (isMounted) {
          setMessages([
            { role: 'user', content: query },
            { role: 'assistant', content: answer }
          ]);
          setPhase('done');
        }
      } catch (error) {
        const err = error as Error;
        console.error("RAG pipeline failed", err);
        if (isMounted) {
          setMessages([
            { role: 'user', content: query },
            { role: 'assistant', content: `[오류 발생] Llama 3 호출에 실패했습니다: ${err.message}` }
          ]);
          setPhase('done');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    runRagPipeline();

    return () => { isMounted = false; };
  }, [isOpen, query, localResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60" onClick={onClose}>
      <div 
        className="pointer-events-auto bg-[var(--color-card)] rounded-xl shadow-xl w-full max-w-6xl overflow-hidden border border-[var(--color-border-light)] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-light)] bg-gradient-to-r from-blue-50/50 to-indigo-50/50 flex-shrink-0">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-sm">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-gray-900 flex items-center gap-2">
                HCHPS WikiBot
                <Sparkles size={14} className="text-yellow-500" />
              </h3>
              <p className="text-[12px] text-gray-500 font-medium tracking-wide">LLAMA 3.1 NATIVE RAG ENGINE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Splitter */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
          
          {/* Left Panel: Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
              
              {messages.map((msg, idx) => (
                msg.role === 'user' ? (
                  <div key={idx} className="flex justify-end">
                    <div className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] text-[15px] font-medium break-words">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                      <Bot size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 border border-gray-100 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              ))}

              {/* Loading Indicators */}
              {(phase === 'searching' || phase === 'thinking') && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    {phase === 'searching' && (
                      <div className="flex items-center gap-2 text-gray-500 text-[14px] bg-gray-50 px-4 py-3 rounded-2xl rounded-tl-sm w-fit animate-pulse">
                        <Search size={16} /> Vector DB(지식창고)에서 유사 문서 검색 중...
                      </div>
                    )}
                    {phase === 'thinking' && (
                      <>
                        <div className="flex items-center gap-2 text-indigo-500 text-[14px] bg-indigo-50 px-4 py-3 rounded-2xl rounded-tl-sm w-fit animate-pulse font-medium">
                          <Sparkles size={16} /> Llama 3.1 8B Instruct가 답변을 생성 중입니다...
                        </div>
                        {semanticResults.length > 0 && (
                          <div className="text-[12px] text-gray-400 mt-1 pl-1 flex items-center gap-1">
                            <FileText size={12} /> {semanticResults.length}개의 관련 문서를 처음 참조했습니다.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="px-5 py-4 border-t border-[var(--color-border-light)] bg-gray-50/50 flex items-center gap-3 flex-shrink-0">
              <form 
                className="flex-1 relative flex items-center"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!inputText.trim() || isLoading) return;
                  
                  const newText = inputText.trim();
                  setInputText('');
                  setMessages(prev => [...prev, { role: 'user', content: newText }]);
                  setPhase('thinking');
                  setIsLoading(true);

                  try {
                    let contextText = semanticResults.map(doc => 
                      `[Source: ${doc.id}]\n${doc.metadata?.text || 'No text content available'}`
                    ).join('\n\n');

                    if (semanticResults.length === 0 && localResults.length > 0) {
                      contextText = localResults.slice(0, 3).map(r => `[Source: ${r.title}]\n${r.context}`).join('\n\n');
                    }

                    const systemPrompt = `[관련 가이드 문서]
${contextText || '(관련 문서가 없습니다.)'}
====================
위 지식 문서의 내용과 이전 대화를 기반으로 사용자에게 전문적이고 자연스럽게 답변하시오. 당신은 조직 통합 시스템의 엄격한 WikiBot입니다. 문서에 없는 외부 지식(환각)은 절대 대답에 섞지 마십시오.`;

                    const chatParams = [
                      { role: 'system', content: systemPrompt },
                      ...messages,
                      { role: 'user', content: newText }
                    ] as Parameters<typeof askLlama>[0];

                    const answer = await askLlama(chatParams);
                    setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
                    setPhase('done');
                  } catch (error) {
                    const err = error as Error;
                    setMessages(prev => [...prev, { role: 'assistant', content: `[오류 발생] ${err.message}` }]);
                    setPhase('done');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                <input 
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={isLoading ? "생성하는 중..." : "위키 내용을 바탕으로 이어서 질문하기..."}
                  disabled={isLoading}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-12 py-3 text-[14px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="absolute right-2 p-1.5 bg-indigo-500/10 text-indigo-600 rounded-md hover:bg-indigo-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} className="translate-x-0.5" />
                </button>
              </form>
              <button 
                type="button"
                onClick={onClose}
                className="px-5 py-3 text-[14px] font-semibold tracking-wide text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>

          {/* Right Panel: Sources Area */}
          {(phase === 'done' && (semanticResults.length > 0 || localResults.length > 0)) && (
            <div className="lg:w-[350px] xl:w-[400px] border-t lg:border-t-0 lg:border-l border-[var(--color-border-light)] bg-gray-50 flex flex-col flex-shrink-0">
              <div className="px-5 py-4 border-b border-[var(--color-border-light)] bg-white sticky top-0 z-10 hidden lg:block">
                <h4 className="text-[14px] font-semibold text-gray-700 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" /> 참조된 원본 문서
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:bg-gray-50/30">
                {/* Mobile Header (Shown only on small screens when stacked) */}
                <h4 className="text-[13px] font-semibold text-gray-500 mb-3 flex items-center gap-1 lg:hidden">
                  <FileText size={14} /> 참조된 문서 출처
                </h4>
                
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
                            }}
                            className="text-left flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 cursor-pointer group"
                            style={{ animationFillMode: 'both' }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[14px] font-bold text-[var(--color-primary)] group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {nodeId}
                              </span>
                              <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors whitespace-nowrap">
                                열기 📄
                              </span>
                            </div>
                            <p className="text-[13px] text-gray-500 line-clamp-3 leading-relaxed">
                              {doc.metadata?.text || '(텍스트 없음)'}
                            </p>
                          </button>
                        );
                      })
                    : localResults.slice(0, 3).map((res, idx) => {
                        const nodeId = res.id.replace('HCHPS-Wiki-', '');
                        const displayTitle = res.title.replace('온톨로지 문서 (', '').replace(')', '');
                        return (
                          <button 
                            key={`loc-${idx}`} 
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('wiki:openNode', {
                                detail: { id: nodeId, label: displayTitle }
                              }));
                            }}
                            className="text-left flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 cursor-pointer group"
                            style={{ animationFillMode: 'both' }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[14px] font-bold text-[var(--color-primary)] group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {displayTitle}
                              </span>
                              <span className="text-[11px] text-orange-400 font-medium bg-orange-50 px-2 py-1 rounded-md group-hover:bg-orange-100 group-hover:text-orange-500 transition-colors whitespace-nowrap">
                                로컬 연결 📄
                              </span>
                            </div>
                            <p className="text-[13px] text-gray-500 line-clamp-3 leading-relaxed">
                              {res.context}
                            </p>
                          </button>
                        );
                      })
                  }

                  {/* Local Fallback Warning */}
                  {semanticResults.length === 0 && localResults.length > 0 && (
                    <div className="mt-2 text-[12px] text-orange-500 bg-orange-50 p-3 rounded-lg border border-orange-100/80 leading-relaxed font-medium">
                      Vectorize 연결이 불완전하여 브라우저 로컬 데이터(Fallback)를 기반으로 답변했습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
