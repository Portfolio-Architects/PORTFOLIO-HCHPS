import { useMutation } from '@tanstack/react-query';

interface ReportGeneratorPayload {
  nodeId: string;
  nodeLabel: string;
  wikiText?: string;
  budgetData?: {
    total: number;
    executed: number;
    remaining: number;
    rate: number;
  };
  tasks?: Array<{
    title?: string;
    text?: string;
    isCompleted: boolean;
  }>;
  files?: Array<{
    displayName: string;
    summary: string[];
  }>;
}

interface ReportGeneratorResponse {
  success: boolean;
  fileName: string;
  content: string;
}

export function useReportGenerator() {
  return useMutation<ReportGeneratorResponse, Error, ReportGeneratorPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/report-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate report draft');
      }
      return data;
    }
  });
}
