import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Settings, Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: {
    signals: any[];
    budgetEntries?: any[];
    budgetCategories?: any[];
    budgets?: any[];
    knowledge: any[];
  };
}

export function AIAssistantModal({ isOpen, onClose, contextData }: AIAssistantModalProps) {
  const { messages, addMessage, clearMessages, isTyping, setIsTyping } = useAIChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userQuery = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userQuery });
    setIsTyping(true);

    try {
      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userQuery }],
          contextData
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
              HCHPS AI Assistant.
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
