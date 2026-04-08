'use client';

import { useEffect, useCallback, useMemo, useSyncExternalStore, useRef, useState } from 'react';
import { OntologyNode, OntologyEdge, OntologyGroup } from '@/lib/ontology.types';
import { useYjsStore } from './useYjsStore';
import * as Y from 'yjs';

export interface NodeOverride {
  fixedX?: number | null;
  fixedY?: number | null;
  customColor?: string | null;
  customLabel?: string | null;
  customGroup?: string | null;
  customParent?: string | null;
  customOrbitIndex?: number | null;
  customSortOrder?: number | null;
  hidden?: boolean | null;
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
  } | null;
}

export interface MapCustomizationData {
  overrides: Record<string, NodeOverride>;
  customNodes: OntologyNode[];
  customEdges: OntologyEdge[];
  deletedEdges?: string[];
}

export function useGraphCustomization() {
  const { ydoc } = useYjsStore();

  const undoManager = useMemo(() => {
    return new Y.UndoManager([
      ydoc.getMap('overrides'),
      ydoc.getMap('customNodesMap'),
      ydoc.getMap('customEdgesMap'),
      ydoc.getMap('deletedEdgesMap')
    ]);
  }, [ydoc]);

  // 이관(Migration) 로직
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const localRaw = localStorage.getItem('hchps-map-customization');
        const hasMigrated = localStorage.getItem('hchps-yjs-migrated');
        
        if (localRaw && !hasMigrated) {
          const localData = JSON.parse(localRaw) as MapCustomizationData;
          console.info('[Yjs Migration] 기존 로컬 스토리지 데이터 발견. Yjs로 복구합니다...');
          
          ydoc.transact(() => {
            const overridesMap = ydoc.getMap('overrides');
            const customNodesMap = ydoc.getMap('customNodesMap');
            const customEdgesMap = ydoc.getMap('customEdgesMap');
            const deletedEdgesMap = ydoc.getMap('deletedEdgesMap');

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
  }, [ydoc]);

  // Phase 3: useSyncExternalStore & Debounce 패턴 접목
  // Yjs 상태 변경 시 곧바로 React 렌더링을 큐에 넣지 않고, 프레임 최적화(Debounce)하여 CPU 점유율을 대폭 낮춥니다.
  const store = useMemo(() => {
    const overridesMap = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
    const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
    const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
    const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;

    let snapshot: MapCustomizationData = {
      overrides: overridesMap.toJSON() as Record<string, NodeOverride>,
      customNodes: Array.from(customNodesMap.values()),
      customEdges: Array.from(customEdgesMap.values()),
      deletedEdges: Array.from(deletedEdgesMap.keys()),
    };

    const listeners = new Set<() => void>();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 16ms (약 60FPS) 이하의 초고속 이벤트를 병합(Batch) 처리 
      timeoutId = setTimeout(() => {
        snapshot = {
          overrides: overridesMap.toJSON() as Record<string, NodeOverride>,
          customNodes: Array.from(customNodesMap.values()),
          customEdges: Array.from(customEdgesMap.values()),
          deletedEdges: Array.from(deletedEdgesMap.keys()),
        };
        listeners.forEach(l => l());
      }, 16);
    };

    return {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        if (listeners.size === 1) {
          overridesMap.observe(onUpdate);
          customNodesMap.observe(onUpdate);
          customEdgesMap.observe(onUpdate);
          deletedEdgesMap.observe(onUpdate);
        }
        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) {
            overridesMap.unobserve(onUpdate);
            customNodesMap.unobserve(onUpdate);
            customEdgesMap.unobserve(onUpdate);
            deletedEdgesMap.unobserve(onUpdate);
            if (timeoutId) clearTimeout(timeoutId);
          }
        };
      },
      getSnapshot: () => snapshot
    };
  }, [ydoc]);

  const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  const setNodeOverride = useCallback((id: string, override: Partial<NodeOverride>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      const current = map.get(id) || {};
      const next: NodeOverride = { ...current };
      
      // Allow clearing specific fields explicitly by setting them to `null` to retain intent
      (Object.keys(override) as Array<keyof NodeOverride>).forEach(k => {
        if (override[k] === undefined) {
          next[k] = null as any; // Type-safe omission is handled by map, null acts as explicit tombstone
        } else {
          // Temporarily bypass strict index typing with a cast, safe due to key extraction
          (next as Record<string, unknown>)[k] = override[k];
        }
      });
      map.set(id, next);
    });
  }, [ydoc]);

  const batchSetNodeOverrides = useCallback((updates: Record<string, Partial<NodeOverride>>) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
      for (const [id, override] of Object.entries(updates)) {
        const current = map.get(id) || {};
        const next: NodeOverride = { ...current };
        (Object.keys(override) as Array<keyof NodeOverride>).forEach(k => {
          if (override[k] === undefined) {
            next[k] = null as any;
          } else {
            (next as Record<string, unknown>)[k] = override[k];
          }
        });
        map.set(id, next);
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
    (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);

  const submitCustomNode = useCallback((node: OntologyNode) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
      map.set(node.id, node);
    });
  }, [ydoc]);

  const submitCustomEdge = useCallback((edge: OntologyEdge) => {
    ydoc.transact(() => {
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const edgeId = `${edge.source}|||${edge.target}`;
      map.set(edgeId, edge);
    });
  }, [ydoc]);

  const deleteCustomNode = useCallback((id: string) => {
    ydoc.transact(() => {
      (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).delete(id);
      
      const edgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
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
      const map = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
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
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const deletedMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
      
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
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      if (map.has(edgeId)) map.delete(edgeId);
      if (map.has(reverseId)) map.delete(reverseId);
      
      (ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>).set(edgeId, true);
    });
  }, [ydoc]);

  const removeCustomTombstone = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const deletedMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
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

  const resetLayoutOverrides = useCallback(() => {
    if (confirm('모든 노드의 "배치 위치(좌표)"와 "소속 관계"를 초기화하시겠습니까? (색상 및 이름 변경 내역은 유지됩니다)')) {
      ydoc.transact(() => {
        const map = ydoc.getMap('overrides') as Y.Map<NodeOverride>;
        for (const key of Array.from(map.keys())) {
          const current = map.get(key);
          if (current) {
            map.set(key, { ...current, fixedX: null, fixedY: null, customParent: null, customOrbitIndex: null, customSortOrder: null });
          }
        }
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

  const syncToCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('현재 화면의 모든 노드 구조를 클라우드에 저장하시겠습니까? (프로덕션 환경과 동기화)')) return;
    try {
      const { replaceAll } = await import('@/lib/sheets-api');
      const latestData = store.getSnapshot();
      const res = await replaceAll('MAP_CUSTOMIZATION', [{ id: 'singleton', ...latestData }]);
      if (res && !silent) alert('☁️ 성공적으로 클라우드에 동기화되었습니다!');
      else if (!res && !silent) alert('저장에 실패했습니다.');
    } catch (e) {
      console.error(e);
      if (!silent) alert('동기화 중 오류가 발생했습니다.');
    }
  }, [store]);

  const fetchFromCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('클라우드에서 최신 데이터를 불러오시겠습니까? (현재 로컬의 캔버스 내용은 모두 덮어씌워집니다)')) return;
    try {
      const { readSheet } = await import('@/lib/sheets-api');
      const rows = await readSheet<any>('MAP_CUSTOMIZATION');
      if (rows && rows.length > 0 && rows[0].id === 'singleton') {
        const cloudData = rows[0];
        ydoc.transact(() => {
          ['overrides', 'customNodesMap', 'customEdgesMap', 'deletedEdgesMap'].forEach(name => {
            const m = ydoc.getMap(name);
            Array.from(m.keys()).forEach(k => m.delete(k));
          });
          
          if (cloudData.overrides) Object.entries(cloudData.overrides).forEach(([k, v]) => ydoc.getMap('overrides').set(k, v));
          if (cloudData.customNodes) cloudData.customNodes.forEach((n: any) => ydoc.getMap('customNodesMap').set(n.id, n));
          if (cloudData.customEdges) cloudData.customEdges.forEach((e: any) => ydoc.getMap('customEdgesMap').set(`${e.source}|||${e.target}`, e));
          if (cloudData.deletedEdges) cloudData.deletedEdges.forEach((e: any) => ydoc.getMap('deletedEdgesMap').set(e, true));
        });
        if (!silent) alert('☁️ 성공적으로 클라우드에서 데이터를 불러왔습니다!');
      } else {
        if (!silent) alert('클라우드에 저장된 백업 데이터가 없습니다.');
      }
    } catch (e) {
      console.error(e);
      if (!silent) alert('불러오기 중 오류가 발생했습니다.');
    }
  }, [ydoc]);

  // 자동 클라우드 로드 (최초 마운트)
  const isInitialMount = useRef(true);
  const cloudFetched = useRef(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // 동기적 로딩 모델: 딜레이 없이 즉각 클라우드 호출
      fetchFromCloud(true).then(() => {
         cloudFetched.current = true;
         setIsCloudLoaded(true);
         console.log('[Auto-Load] MindMap configuration fetched from cloud.');
      });
    }
  }, [fetchFromCloud]);

  // 자동 클라우드 백업 (디바운스 2500ms)
  useEffect(() => {
    if (!cloudFetched.current) return;
    const timer = setTimeout(() => {
      syncToCloud(true).then(() => {
        console.log('[Auto-Save] MindMap configuration uploaded to cloud.');
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [data, syncToCloud]);

  return {
    ...data,
    isCloudLoaded,
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
    resetLayoutOverrides,
    clearAll,
    syncToCloud,
    fetchFromCloud,
  };
}
