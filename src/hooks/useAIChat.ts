import { useState, useEffect } from 'react';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
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

  return {
    messages,
    addMessage,
    clearMessages,
    isTyping,
    setIsTyping
  };
}
