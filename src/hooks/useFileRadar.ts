import { useMutation } from '@tanstack/react-query';

interface FileRadarPayload {
  nodeId: string;
  nodeLabel: string;
}

export interface RadarContact {
  name: string;
  role: string;
  phone: string;
}

export interface RadarFile {
  fileName: string;
  displayName: string;
  summary: string[];
  contacts: RadarContact[];
}

export interface FileRadarResponse {
  nodeId: string;
  nodeLabel: string;
  files: RadarFile[];
}

export function useFileRadar() {
  return useMutation<FileRadarResponse, Error, FileRadarPayload>({
    mutationFn: async ({ nodeId, nodeLabel }) => {
      const res = await fetch(
        `/api/file-radar?nodeLabel=${encodeURIComponent(nodeLabel)}&nodeId=${encodeURIComponent(nodeId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch file radar data');
      }
      return data;
    }
  });
}
