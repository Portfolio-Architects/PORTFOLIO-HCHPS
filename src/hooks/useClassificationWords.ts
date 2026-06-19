'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { decryptPayload, isCryptoReady } from '@/lib/crypto';

export interface ClassificationWords {
  agents: string[];
  resources: string[];
  executions: string[];
}

export function useClassificationWords(isActive: boolean) {
  const [cryptoReady, setCryptoReady] = useState(isCryptoReady());

  useEffect(() => {
    const handleReady = () => setCryptoReady(true);
    window.addEventListener('crypto-ready', handleReady);
    return () => window.removeEventListener('crypto-ready', handleReady);
  }, []);

  return useQuery({
    queryKey: ['classification-words'],
    queryFn: async (): Promise<ClassificationWords | null> => {
      const res = await fetch('/api/data?sheet=CLASSIFICATION_WORDS');
      const json = await res.json();
      if (json.success && json.data && json.data[0]) {
        const entry = json.data[0];
        if (entry._enc) {
          const decrypted = await decryptPayload<ClassificationWords>(entry._enc);
          return decrypted;
        }
      }
      return null;
    },
    enabled: isActive && cryptoReady,
    staleTime: Infinity,
  });
}
