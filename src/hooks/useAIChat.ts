import { useState, useEffect } from 'react';
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

  const chatMutation = useMutation({
    mutationFn: async (payload: ChatMutationPayload) => {
      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
    onError: (err) => {
      console.error('Chat error:', err);
      addMessage({ 
        role: 'system', 
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요. (서버 연결을 확인하거나 GEMINI_API_KEY 설정을 확인하세요)' 
      });
    },
    onSettled: () => {
      setIsTyping(false);
    }
  });

  return {
    messages,
    addMessage,
    clearMessages,
    isTyping,
    setIsTyping,
    chatMutation
  };
}
