'use client';

import { useState, useCallback } from 'react';

export interface UseAuthReturn {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  resetError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        return true;
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        return false;
      }
    } catch {
      setError('로그인 처리 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      // ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  return {
    login,
    logout,
    isLoading,
    error,
    setError,
    resetError,
  };
}

