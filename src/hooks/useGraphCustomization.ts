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
  customParent?: string;
  customOrbitIndex?: number;
  hidden?: boolean;
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

  const [past, setPast] = useState<MapCustomizationData[]>([]);
  const [future, setFuture] = useState<MapCustomizationData[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }, [data]);

  const updateData = useCallback((updater: (prev: MapCustomizationData) => MapCustomizationData) => {
    setData(prev => {
      const next = updater(prev);
      if (next === prev) return prev; // No change
      setPast(p => [...p, prev].slice(-50));
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setData(current => {
        setFuture(f => [current, ...f]);
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      setData(current => {
        setPast(p => [...p, current]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const setNodeOverride = useCallback((id: string, override: Partial<NodeOverride>) => {
    updateData(prev => {
      const existing = prev.overrides[id] || {};
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [id]: { ...existing, ...override },
        },
      };
    });
  }, [updateData]);

  const clearNodeOverride = useCallback((id: string) => {
    updateData(prev => {
      const newOverrides = { ...prev.overrides };
      delete newOverrides[id];
      return { ...prev, overrides: newOverrides };
    });
  }, [updateData]);

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
    updateData(prev => ({
      ...prev,
      customNodes: [...prev.customNodes, newNode],
    }));
    return newNode;
  }, [updateData]);

  const deleteCustomNode = useCallback((id: string) => {
    updateData(prev => {
      // Also remove any edges connected to this node
      const newEdges = prev.customEdges.filter(e => e.source !== id && e.target !== id);
      return {
        ...prev,
        customNodes: prev.customNodes.filter(n => n.id !== id),
        customEdges: newEdges,
      };
    });
  }, [updateData]);

  const updateCustomNodeText = useCallback((id: string, newLabel: string) => {
    updateData(prev => ({
      ...prev,
      customNodes: prev.customNodes.map(n => n.id === id ? { ...n, label: newLabel } : n)
    }));
  }, [updateData]);

  const addCustomEdge = useCallback((source: string, target: string) => {
    updateData(prev => {
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
  }, [updateData]);

  const clearOverrides = useCallback(() => {
    if (confirm('모든 노드의 색상과 핀 고정 위치를 처음 상태로 되돌리겠습니까? (추가된 수동 노드는 유지됩니다)')) {
      updateData(prev => ({ ...prev, overrides: {} }));
    }
  }, [updateData]);

  const clearAll = useCallback(() => {
    if (confirm('수동으로 추가한 노드를 포함하여 화이트보드의 모든 편집 내용을 지우겠습니까?')) {
      updateData(() => DEFAULT_DATA);
    }
  }, [updateData]);

  return {
    ...data,
    undo,
    redo,
    setNodeOverride,
    clearNodeOverride,
    addCustomNode,
    deleteCustomNode,
    updateCustomNodeText,
    addCustomEdge,
    clearOverrides,
    clearAll,
  };
}
