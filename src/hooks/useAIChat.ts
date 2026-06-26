import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

interface ChatMutationPayload {
  messages: Array<{ role: string; content: string }>;
  contextData?: any;
  appMode?: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hchps_ai_chat');
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved chat', e);
      }
    }
  }, []);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    setMessages(prev => {
      const updated = [...prev, newMessage];
      localStorage.setItem('hchps_ai_chat', JSON.stringify(updated));
      return updated;
    });
    
    return newMessage;
  };

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem('hchps_ai_chat');
  };

  const cancelChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
    addMessage({
      role: 'system',
      content: '대화가 중단되었습니다.'
    });
  };

  const chatMutation = useMutation({
    mutationFn: async (payload: ChatMutationPayload) => {
      // 6000자 초과 시 슬라이딩 윈도우 Pruning 적용 (토큰 절약 및 Context 유실 최소화)
      const prunedMessages = [...payload.messages];
      const getLength = (msgs: Array<{ role: string; content: string }>) => 
        msgs.reduce((sum, m) => sum + m.content.length, 0);

      while (prunedMessages.length > 0 && getLength(prunedMessages) > 6000) {
        // 첫 번째 메시지가 system인 경우 컨텍스트 유지를 위해 보존하고 1번째 메시지(사용자 첫대화)를 제거
        if (prunedMessages[0].role === 'system' && prunedMessages.length > 1) {
          prunedMessages.splice(1, 1);
        } else {
          prunedMessages.shift();
        }
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          messages: prunedMessages
        }),
        signal: controller.signal
      });
      
      if (!res.ok) {
        throw new Error('API request failed');
      }
      return res.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      addMessage({ role: 'assistant', content: data.content });
    },
    onError: (err: any) => {
      if (err.name === 'AbortError') {
        // Abort 에러는 별도로 system 메시지를 중복해서 뿌리지 않고 무시하거나 cancelChat에서 남김
        return;
      }
      console.error('Chat error:', err);
      addMessage({ 
        role: 'system', 
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요. (서버 연결을 확인하거나 GEMINI_API_KEY 설정을 확인하세요)' 
      });
    },
    onSettled: () => {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  });

  return {
    messages,
    addMessage,
    clearMessages,
    cancelChat,
    isTyping,
    setIsTyping,
    chatMutation
  };
}
