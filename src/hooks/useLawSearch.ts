import { useMutation } from '@tanstack/react-query';

export interface LawSearchPayload {
  query?: string;
  target?: 'law' | 'admrul' | 'ordin';
  page?: number;
  mst?: string;
  type?: 'HTML' | 'XML';
}

export interface LawSearchItem {
  id: string;
  title: string;
  date: string;
  agency: string;
  link: string;
}

export interface LawSearchResponse {
  success: boolean;
  totalCnt: number;
  page: number;
  items: LawSearchItem[];
}

export function useLawSearch() {
  return useMutation<LawSearchResponse, Error, LawSearchPayload>({
    mutationFn: async ({ query, target = 'law', page = 1 }) => {
      const url = `/api/law?query=${encodeURIComponent(query || '')}&target=${target}&page=${page}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to search law data');
      }
      return data;
    }
  });
}

export function useLawBody() {
  return useMutation<string, Error, LawSearchPayload>({
    mutationFn: async ({ mst, target = 'law', type = 'HTML' }) => {
      const url = `/api/law?mst=${mst}&target=${target}&type=${type}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch law body content');
      }
      return await res.text();
    }
  });
}
