import { useState, useCallback, useRef, useSyncExternalStore } from 'react';
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

const emptyChatMessages: ChatMessage[] = [];
let cachedChatJson = '';
let cachedChatList: ChatMessage[] = emptyChatMessages;

const subscribeChatStorage = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === 'hchps_ai_chat' || !e.key) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

const getChatSnapshot = (): ChatMessage[] => {
  if (typeof window === 'undefined') return emptyChatMessages;
  const saved = localStorage.getItem('hchps_ai_chat') || '';
  if (saved === cachedChatJson) return cachedChatList;
  cachedChatJson = saved;
  if (!saved) {
    cachedChatList = emptyChatMessages;
    return emptyChatMessages;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      cachedChatList = parsed as ChatMessage[];
      return cachedChatList;
    }
  } catch {}
  cachedChatList = emptyChatMessages;
  return emptyChatMessages;
};

const getChatServerSnapshot = () => emptyChatMessages;

export function useAIChat() {
  const storedMessages = useSyncExternalStore(subscribeChatStorage, getChatSnapshot, getChatServerSnapshot);
  const [messagesOverride, setMessagesOverride] = useState<ChatMessage[] | null>(null);
  const messages = messagesOverride ?? storedMessages;

  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    
    setMessagesOverride(prev => {
      const current = prev ?? storedMessages;
      const updated = [...current, newMessage];
      if (typeof window !== 'undefined') {
        localStorage.setItem('hchps_ai_chat', JSON.stringify(updated));
      }
      return updated;
    });
    
    return newMessage;
  }, [storedMessages]);

  const clearMessages = useCallback(() => {
    setMessagesOverride([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hchps_ai_chat');
    }
  }, []);

  const cancelChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
    addMessage({
      role: 'system',
      content: '대화가 중단되었습니다.'
    });
  }, [addMessage]);

  const chatMutation = useMutation({
    mutationFn: async (payload: ChatMutationPayload) => {
      // 6000자 초과 시 슬라이딩 윈도우 Pruning 적용 (O(N) 증분 길이 계산)
      const prunedMessages = [...payload.messages];
      let totalLen = 0;
      for (let i = 0; i < prunedMessages.length; i++) {
        totalLen += prunedMessages[i].content?.length || 0;
      }

      while (prunedMessages.length > 0 && totalLen > 6000) {
        // 첫 번째 메시지가 system인 경우 컨텍스트 유지를 위해 보존하고 1번째 메시지(사용자 첫대화)를 제거
        if (prunedMessages[0].role === 'system' && prunedMessages.length > 1) {
          const removed = prunedMessages.splice(1, 1)[0];
          totalLen -= removed?.content?.length || 0;
        } else {
          const removed = prunedMessages.shift();
          totalLen -= removed?.content?.length || 0;
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
