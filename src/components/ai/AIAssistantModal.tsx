import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Settings, Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';
import { BudgetCategory, BudgetEntry } from '@/types';
import { SignalEntry } from '@/hooks/useSignal';
import { buildSignalGraph } from '@/lib/signal-graph';
import { OntologyNetwork } from '@/lib/engine/OntologyNetwork';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: {
    signals: SignalEntry[];
    budgetEntries?: BudgetEntry[];
    budgetCategories?: BudgetCategory[];
    budgets?: BudgetCategory[];
    customNodes?: any[];
    customEdges?: any[];
    deletedEdges?: string[];
    overrides?: Record<string, any>;
    keywordMap?: Record<string, number>;
  };
  appMode?: 'HCHPS' | 'VITAL';
}

// Helper function to extract plain text from editor block structure (BlockNote schema)
function extractTextFromBlocks(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return '';
  let text = '';
  for (const block of blocks) {
    if (block.content && Array.isArray(block.content)) {
      const line = block.content.map((c: any) => c.text || '').join('');
      if (line.trim()) {
        text += line + '\n';
      }
    }
    if (block.children && block.children.length > 0) {
      text += extractTextFromBlocks(block.children);
    }
  }
  return text;
}

export function AIAssistantModal({ isOpen, onClose, contextData, appMode = 'VITAL' }: AIAssistantModalProps) {
  const { messages, addMessage, clearMessages: baseClearMessages, isTyping, setIsTyping } = useAIChat();
  const [input, setInput] = useState('');
  const [wikiContextMap, setWikiContextMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const clearMessages = () => {
    baseClearMessages();
    setWikiContextMap({});
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userQuery = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userQuery });
    setIsTyping(true);

    // ── 동적 마인드맵 노드 매핑 및 위키 RAG 컨텍스트 추출 ──
    let updatedWikiMap = { ...wikiContextMap };
    let hasNewMatch = false;
    try {
      const customNodes = contextData?.customNodes || [];
      const overrides = contextData?.overrides || {};
      
      for (const cn of customNodes) {
        const override = overrides[cn.id];
        const nodeLabel = override?.customLabel || cn.label || '';
        
        if (nodeLabel.length >= 2 && userQuery.includes(nodeLabel)) {
          const getCanonicalId = (id: string) => {
            if (id.startsWith('leaf-')) {
              if (id.startsWith('leaf-tag-')) {
                const parts = id.split('-');
                if (parts.length >= 4) return `leaf-kw-${parts.slice(3).join('-')}`;
              }
              const parts = id.split('-');
              if (parts[1] === 'kw') return id;
              return `leaf-kw-${parts.slice(1).join('-')}`;
            }
            return id;
          };
          
          const canonicalId = getCanonicalId(cn.id);
          const wikiStr = localStorage.getItem(`HCHPS-Wiki-${canonicalId}`) || localStorage.getItem(`HCHPS-Wiki-${cn.id}`);
          
          if (wikiStr) {
            const blocks = JSON.parse(wikiStr);
            const wikiContent = extractTextFromBlocks(blocks);
            if (wikiContent.trim()) {
              const formattedContent = `- [노드: ${nodeLabel}] 관련 위키 내용:\n${wikiContent.trim()}\n\n`;
              updatedWikiMap[nodeLabel] = formattedContent;
              hasNewMatch = true;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to extract matching wiki context:', e);
    }

    if (hasNewMatch) {
      setWikiContextMap(updatedWikiMap);
    }

    // 누적된 모든 위키 컨텍스트 병합
    const matchedWikiText = Object.values(updatedWikiMap).join('');

    // ── 온톨로지 지식 그래프 RAG 코퍼스 생성 및 시맨틱 추론 ──
    let knowledgeGraphText = '';
    try {
      const signals = contextData?.signals || [];
      const keywordMap = contextData?.keywordMap || {};
      const customNodes = contextData?.customNodes || [];
      const customEdges = contextData?.customEdges || [];
      const deletedEdges = contextData?.deletedEdges || [];
      const overrides = contextData?.overrides || {};

      const graph = buildSignalGraph(keywordMap, signals, {
        overrides,
        customNodes,
        customEdges,
        deletedEdges
      });

      // 1. 질문에 포함된 노드 필터링
      const matchedNodes = graph.nodes.filter(node => {
        const label = node.label || node.id;
        return label.length >= 2 && userQuery.includes(label);
      });

      if (matchedNodes.length > 0) {
        const matchedNodeIds = new Set(matchedNodes.map(n => n.id));
        const subgraphNodeIds = new Set<string>();
        
        // 1-Hop 인접 노드 확장
        graph.edges.forEach(edge => {
          if (matchedNodeIds.has(edge.source) || matchedNodeIds.has(edge.target)) {
            subgraphNodeIds.add(edge.source);
            subgraphNodeIds.add(edge.target);
          }
        });
        
        // 매칭된 노드가 고립된 경우 대비
        matchedNodes.forEach(n => subgraphNodeIds.add(n.id));

        const subgraphNodes = graph.nodes.filter(n => subgraphNodeIds.has(n.id));
        const subgraphEdges = graph.edges.filter(edge => 
          subgraphNodeIds.has(edge.source) && subgraphNodeIds.has(edge.target)
        );

        // 노드 레이블 맵 작성
        const nodeLabelMap = new Map<string, string>();
        graph.nodes.forEach(n => nodeLabelMap.set(n.id, n.label || n.id));

        // SPO 트리플 생성
        const triples: string[] = [];
        subgraphEdges.forEach(edge => {
          const sLabel = nodeLabelMap.get(edge.source);
          const tLabel = nodeLabelMap.get(edge.target);
          if (sLabel && tLabel) {
            let relType: string = edge.type || '연결';
            if (edge.type === 'DEPENDENCY') relType = '의존성';
            else if (edge.type === 'CAUSAL_DRIVE') relType = '인과구동';
            else if (edge.type === 'FEEDBACK_LOOP') relType = '피드백루프';
            else if (edge.type === 'ASSIGNEE') relType = '담당자';
            else if (edge.type === 'BUDGET_SOURCE') relType = '예산원천';
            else if (edge.type === 'COMPONENTS') relType = '구성요소';
            
            triples.push(`- [관계] ${sLabel} --(${relType})--> ${tLabel}`);
          }
        });

        // 규칙 기반 시맨틱 추론기 구동
        const inferences = OntologyNetwork.inferSemanticRelations(subgraphNodes, subgraphEdges);

        // XML 조각 빌드
        knowledgeGraphText = `<knowledge_graph>\n`;
        if (triples.length > 0) {
          knowledgeGraphText += `  <relations>\n    ${triples.join('\n    ')}\n  </relations>\n`;
        } else {
          knowledgeGraphText += `  <relations>없음</relations>\n`;
        }
        if (inferences.length > 0) {
          knowledgeGraphText += `  <inferences>\n    ${inferences.join('\n    ')}\n  </inferences>\n`;
        } else {
          knowledgeGraphText += `  <inferences>없음</inferences>\n`;
        }
        knowledgeGraphText += `</knowledge_graph>`;
      }
    } catch (err) {
      console.warn('Failed to build knowledge graph:', err);
    }

    try {
      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userQuery }],
          contextData: {
            ...contextData,
            matchedWiki: matchedWikiText || undefined,
            knowledgeGraph: knowledgeGraphText || undefined
          },
          appMode
        })
      });

      if (!res.ok) throw new Error('API request failed');
      
      const data = await res.json();
      addMessage({ role: 'assistant', content: data.content });
    } catch (err) {
      console.error('Chat error:', err);
      addMessage({ 
        role: 'system', 
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요. (서버 연결을 확인하거나 GEMINI_API_KEY 설정을 확인하세요)' 
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
      className="w-[calc(100vw-2rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
      style={{ maxWidth: '600px', height: '780px', maxHeight: '85vh' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blue-500" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">Portfolio Assistant</span>
            <span className="text-[10px] text-gray-400 font-medium">GEMMA 4 31B IT</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearMessages}
            className="text-gray-400 hover:text-red-500 rounded-full p-1.5 hover:bg-red-50 transition-colors"
            title="대화 내역 지우기"
          >
            <Trash2 size={16} />
          </button>
          <button className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <Settings size={16} />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      
      {/* Body: Chat History */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-500 shadow-inner">
              <Sparkles size={24} />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              {appMode} AI Assistant.
              <br />
              Ask anything about your work!
            </h3>
            <div className="flex flex-col gap-1.5 text-xs text-gray-500">
              <p>&quot;내일까지 예산 기획안 작성해줘&quot;</p>
              <p>&quot;강남체육센터 예산 현황 보여줘&quot;</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] sm:max-w-[80%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role !== 'system' && (
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-blue-500 text-white'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                )}
                
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-gray-800 text-white rounded-tr-sm' 
                      : msg.role === 'assistant'
                        ? 'bg-white border border-gray-200 text-gray-700 shadow-sm rounded-tl-sm'
                        : 'bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs w-full text-center'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex w-full justify-start">
            <div className="flex max-w-[80%] gap-2">
              <div className="shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm">
                <Bot size={14} />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-3 bg-white border-t border-gray-100">
        <form onSubmit={handleSubmit} className="relative flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 max-h-32 min-h-[44px] bg-transparent text-sm resize-none outline-none py-3 px-4 custom-scrollbar"
            rows={1}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 bottom-2 p-1.5 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
          >
            {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
