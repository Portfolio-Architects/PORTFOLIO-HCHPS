'use client';

import { useState, useEffect, useCallback } from 'react';
import { OntologyNode, OntologyEdge, OntologyGroup } from '@/lib/ontology.types';

const STORAGE_KEY = 'hchps-map-customization';

export interface NodeOverride {
  fixedX?: number;
  fixedY?: number;
  customColor?: string;
  customLabel?: string;
  customGroup?: string;
}

export interface MapCustomizationData {
  overrides: Record<string, NodeOverride>;
  customNodes: OntologyNode[];
  customEdges: OntologyEdge[];
}

const DEFAULT_DATA: MapCustomizationData = {
  overrides: {},
  customNodes: [],
  customEdges: [],
};

export function useGraphCustomization() {
  const [data, setData] = useState<MapCustomizationData>(() => {
    if (typeof window === 'undefined') return DEFAULT_DATA;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }, [data]);

  const setNodeOverride = useCallback((id: string, override: Partial<NodeOverride>) => {
    setData(prev => {
      const existing = prev.overrides[id] || {};
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [id]: { ...existing, ...override },
        },
      };
    });
  }, []);

  const clearNodeOverride = useCallback((id: string) => {
    setData(prev => {
      const newOverrides = { ...prev.overrides };
      delete newOverrides[id];
      return { ...prev, overrides: newOverrides };
    });
  }, []);

  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: 'OTHER', // Default custom group
      baseValue: 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100, // Make them orbit 2+ but wait, they are fixed anyway
    };
    setData(prev => ({
      ...prev,
      customNodes: [...prev.customNodes, newNode],
    }));
    return newNode;
  }, []);

  const deleteCustomNode = useCallback((id: string) => {
    setData(prev => {
      // Also remove any edges connected to this node
      const newEdges = prev.customEdges.filter(e => e.source !== id && e.target !== id);
      return {
        ...prev,
        customNodes: prev.customNodes.filter(n => n.id !== id),
        customEdges: newEdges,
      };
    });
  }, []);

  const addCustomEdge = useCallback((source: string, target: string) => {
    setData(prev => {
      // Check if already exists
      const exists = prev.customEdges.find(
        e => (e.source === source && e.target === target) || (e.source === target && e.target === source)
      );
      if (exists) return prev;

      const newEdge: OntologyEdge = {
        source,
        target,
        weight: 1.0,
        type: 'DEPENDENCY',
      };
      return {
        ...prev,
        customEdges: [...prev.customEdges, newEdge],
      };
    });
  }, []);

  const clearOverrides = useCallback(() => {
    if (confirm('모든 노드의 색상과 핀 고정 위치를 처음 상태로 되돌리겠습니까? (추가된 수동 노드는 유지됩니다)')) {
      setData(prev => ({ ...prev, overrides: {} }));
    }
  }, []);

  const clearAll = useCallback(() => {
    if (confirm('수동으로 추가한 노드를 포함하여 화이트보드의 모든 편집 내용을 지우겠습니까?')) {
      setData(DEFAULT_DATA);
    }
  }, []);

  return {
    ...data,
    setNodeOverride,
    clearNodeOverride,
    addCustomNode,
    deleteCustomNode,
    addCustomEdge,
    clearOverrides,
    clearAll,
  };
}
