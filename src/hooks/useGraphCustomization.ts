'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { OntologyNode, OntologyEdge, OntologyGroup } from '@/lib/ontology.types';
import { useYjsStore } from './useYjsStore';
import * as Y from 'yjs';

export interface NodeOverride {
  fixedX?: number;
  fixedY?: number;
  customColor?: string;
  customLabel?: string;
  customGroup?: string;
  customParent?: string;
  customOrbitIndex?: number;
  customSortOrder?: number;
  hidden?: boolean;
  story5W1H?: {
    who?: string;
    when?: string;
    where?: string;
    what?: string;
    how?: string;
    why?: string;
    contact?: string;
    department?: string;
    title?: string;
  };
}

export interface MapCustomizationData {
  overrides: Record<string, NodeOverride>;
  customNodes: OntologyNode[];
  customEdges: OntologyEdge[];
  deletedEdges?: string[];
}

export function useGraphCustomization() {
  const { ydoc } = useYjsStore();

  const [data, setData] = useState<MapCustomizationData>({
    overrides: {},
    customNodes: [],
    customEdges: [],
    deletedEdges: []
  });

  const undoManager = useMemo(() => {
    return new Y.UndoManager([
      ydoc.getMap('overrides'),
      ydoc.getMap('customNodesMap'),
      ydoc.getMap('customEdgesMap'),
      ydoc.getMap('deletedEdgesMap')
    ]);
  }, [ydoc]);

  useEffect(() => {
    const overridesMap = ydoc.getMap<NodeOverride>('overrides');
    const customNodesMap = ydoc.getMap<OntologyNode>('customNodesMap');
    const customEdgesMap = ydoc.getMap<OntologyEdge>('customEdgesMap');
    const deletedEdgesMap = ydoc.getMap<boolean>('deletedEdgesMap');

    // [마이그레이션 로직] 기존 로컬 스토리지에 데이터가 있으면 Yjs로 병합(복구)합니다.
    if (typeof window !== 'undefined') {
      try {
        const localRaw = localStorage.getItem('hchps-map-customization'); // <-- CORRECTED KEY
        const hasMigrated = localStorage.getItem('hchps-yjs-migrated');
        
        if (localRaw && !hasMigrated) {
          const localData = JSON.parse(localRaw) as MapCustomizationData;
          console.log('[Yjs Migration] 기존 로컬 스토리지 데이터 발견. Yjs로 복구합니다...');
          
          ydoc.transact(() => {
            if (localData.overrides) {
              Object.entries(localData.overrides).forEach(([k, v]) => {
                if (!overridesMap.has(k)) overridesMap.set(k, v);
              });
            }
            if (localData.customNodes) {
              localData.customNodes.forEach(n => {
                if (!customNodesMap.has(n.id)) customNodesMap.set(n.id, n);
              });
            }
            if (localData.customEdges) {
              localData.customEdges.forEach(e => {
                const k = `${e.source}|||${e.target}`;
                if (!customEdgesMap.has(k)) customEdgesMap.set(k, e);
              });
            }
            if (localData.deletedEdges) {
              localData.deletedEdges.forEach(e => {
                if (!deletedEdgesMap.has(e)) deletedEdgesMap.set(e, true);
              });
            }
          });
          
          localStorage.setItem('hchps-yjs-migrated', 'true');
        }
      } catch (e) {
        console.error('Yjs migration failed:', e);
      }
    }

    const updateReactState = () => {
      setData({
        overrides: overridesMap.toJSON() as Record<string, NodeOverride>,
        customNodes: Array.from(customNodesMap.values()),
        customEdges: Array.from(customEdgesMap.values()),
        deletedEdges: Array.from(deletedEdgesMap.keys()),
      });
    };

    overridesMap.observe(updateReactState);
    customNodesMap.observe(updateReactState);
    customEdgesMap.observe(updateReactState);
    deletedEdgesMap.observe(updateReactState);

    updateReactState();

    return () => {
      overridesMap.unobserve(updateReactState);
      customNodesMap.unobserve(updateReactState);
      customEdgesMap.unobserve(updateReactState);
      deletedEdgesMap.unobserve(updateReactState);
    };
  }, [ydoc]);

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  const setNodeOverride = useCallback((id: string, override: Partial<NodeOverride>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap<NodeOverride>('overrides');
      const current = map.get(id) || {};
      const next = { ...current, ...override };
      
      // Allow clearing specific fields explicitly
      Object.keys(override).forEach(k => {
        if (override[k as keyof NodeOverride] === undefined) {
          delete next[k as keyof NodeOverride];
        }
      });
      map.set(id, next);
    });
  }, [ydoc]);

  const batchSetNodeOverrides = useCallback((updates: Record<string, Partial<NodeOverride>>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap<NodeOverride>('overrides');
      for (const [id, override] of Object.entries(updates)) {
        const current = map.get(id) || {};
        map.set(id, { ...current, ...override });
      }
    });
  }, [ydoc]);

  const clearNodeOverride = useCallback((id: string) => {
    ydoc.getMap('overrides').delete(id);
  }, [ydoc]);

  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: 'OTHER',
      baseValue: 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100,
    };
    ydoc.getMap<OntologyNode>('customNodesMap').set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);

  const deleteCustomNode = useCallback((id: string) => {
    ydoc.transact(() => {
      ydoc.getMap<OntologyNode>('customNodesMap').delete(id);
      
      const edgesMap = ydoc.getMap<OntologyEdge>('customEdgesMap');
      const keysToDelete: string[] = [];
      edgesMap.forEach((edge, key) => {
        if (edge.source === id || edge.target === id) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(k => edgesMap.delete(k));
    });
  }, [ydoc]);

  const updateCustomNodeText = useCallback((id: string, newLabel: string) => {
    ydoc.transact(() => {
      const map = ydoc.getMap<OntologyNode>('customNodesMap');
      const node = map.get(id);
      if (node) {
        map.set(id, { ...node, label: newLabel });
      }
    });
  }, [ydoc]);

  const addCustomEdge = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const map = ydoc.getMap<OntologyEdge>('customEdgesMap');
      const deletedMap = ydoc.getMap<boolean>('deletedEdgesMap');
      
      // Remove any tombstone if it exists so the edge can be resurrected
      if (deletedMap.has(edgeId)) deletedMap.delete(edgeId);
      if (deletedMap.has(reverseId)) deletedMap.delete(reverseId);

      if (!map.has(edgeId) && !map.has(reverseId)) {
        map.set(edgeId, { source, target, weight: 1.0, type: 'DEPENDENCY' });
      }
    });
  }, [ydoc]);

  const deleteCustomEdge = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const map = ydoc.getMap<OntologyEdge>('customEdgesMap');
      if (map.has(edgeId)) map.delete(edgeId);
      if (map.has(reverseId)) map.delete(reverseId);
      
      ydoc.getMap<boolean>('deletedEdgesMap').set(edgeId, true);
    });
  }, [ydoc]);

  const removeCustomTombstone = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const deletedMap = ydoc.getMap<boolean>('deletedEdgesMap');
      if (deletedMap.has(edgeId)) deletedMap.delete(edgeId);
      if (deletedMap.has(reverseId)) deletedMap.delete(reverseId);
    });
  }, [ydoc]);

  const clearOverrides = useCallback(() => {
    if (confirm('모든 노드의 색상과 핀 고정 위치를 처음 상태로 되돌리겠습니까?')) {
      ydoc.transact(() => {
        const map = ydoc.getMap('overrides');
        Array.from(map.keys()).forEach(k => map.delete(k));
      });
    }
  }, [ydoc]);

  const clearAll = useCallback(() => {
    if (confirm('화이트보드의 모든 편집 내용을 지우겠습니까?')) {
      ydoc.transact(() => {
        ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
          const m = ydoc.getMap(name);
          Array.from(m.keys()).forEach(k => m.delete(k));
        });
      });
    }
  }, [ydoc]);

  return {
    ...data,
    saveStatus: 'saved', // Mock saveStatus since Yjs persists automatically
    undo,
    redo,
    setNodeOverride,
    batchSetNodeOverrides,
    clearNodeOverride,
    addCustomNode,
    deleteCustomNode,
    updateCustomNodeText,
    addCustomEdge,
    deleteCustomEdge,
    removeCustomTombstone,
    clearOverrides,
    clearAll,
  };
}
