'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useYjsStore } from './useYjsStore';

export interface AgentStatus {
  id: string;
  name: string;      // Planner, Generator, Evaluator
  status: 'idle' | 'running' | 'success' | 'failed';
  currentStep?: string;
  attempts?: number;
  maxAttempts?: number;
  lastUpdated: string;
  feedback?: string;
}

export function useAgentStatus() {
  const { ydoc } = useYjsStore();
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});

  // Yjs Y.Map 'agent-statuses' 가져오기
  const statusMap = useMemo(() => ydoc.getMap<AgentStatus>('agent-statuses'), [ydoc]);

  // Yjs 맵 상태를 로컬 React 상태로 동기화
  const syncStatuses = useCallback(() => {
    const current: Record<string, AgentStatus> = {};
    statusMap.forEach((value, key) => {
      current[key] = value;
    });
    setStatuses(current);
  }, [statusMap]);

  useEffect(() => {
    const timer = setTimeout(() => {
      syncStatuses();
    }, 0);

    // Yjs 맵 변경 이벤트 핸들러 바인딩
    statusMap.observe(syncStatuses);
    return () => {
      clearTimeout(timer);
      statusMap.unobserve(syncStatuses);
    };
  }, [statusMap, syncStatuses]);

  // 에이전트 상태 업데이트 함수 (이벤트 발생 시 모든 클라이언트에 브로드캐스트)
  const updateAgentStatus = useCallback((agentId: string, updates: Partial<AgentStatus>) => {
    const existing = statusMap.get(agentId) || {
      id: agentId,
      name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
      status: 'idle',
      lastUpdated: new Date().toISOString()
    };

    const updated = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString()
    } as AgentStatus;

    statusMap.set(agentId, updated);
  }, [statusMap]);

  // 모든 에이전트 상태 초기화
  const resetAgentStatuses = useCallback(() => {
    statusMap.clear();
  }, [statusMap]);

  // Memoized array of statuses for reference stability
  const statusList = useMemo(() => Object.values(statuses), [statuses]);

  return {
    statuses: statusList,
    updateAgentStatus,
    resetAgentStatuses
  };
}


