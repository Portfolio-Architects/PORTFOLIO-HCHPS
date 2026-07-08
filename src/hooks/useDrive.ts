import { useMutation } from '@tanstack/react-query';

export interface DriveSearchResult {
  fileName: string;
  relPath: string;
  fullPath: string;
  count: number;
  snippets: Array<{ pos: number; snippet: string }>;
}

interface DriveSearchPayload {
  query: string;
}

export function useDriveSearch() {
  return useMutation({
    mutationFn: async (payload: DriveSearchPayload) => {
      const res = await fetch(`/api/drive?query=${encodeURIComponent(payload.query)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '로컬 본문 스캔에 실패했습니다.');
      }
      return data.data as DriveSearchResult[];
    }
  });
}
