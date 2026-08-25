'use client';

import { useQuery } from '@tanstack/react-query';
import { readSheet } from '@/lib/sheets-api';

export interface ClassificationWords {
  id?: string;
  agents: string[];
  resources: string[];
  executions: string[];
}

export function useClassificationWords(isActive: boolean) {
  return useQuery({
    queryKey: ['classification-words'],
    queryFn: async (): Promise<ClassificationWords | null> => {
      const data = await readSheet<ClassificationWords>('CLASSIFICATION_WORDS');
      if (data && data.length > 0) {
        return data[0];
      }
      return null;
    },
    enabled: isActive,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
  });
}
