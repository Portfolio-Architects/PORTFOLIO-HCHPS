'use client';

import { useEffect, useCallback, useMemo, useSyncExternalStore, useRef, useState } from 'react';
import { OntologyNode, OntologyEdge, OntologyGroup } from '@/lib/ontology.types';
import { useYjsStore } from './useYjsStore';
import * as Y from 'yjs';
import type { NodeOverride, MapCustomizationData } from './useGraphCustomization';

/**
 * usePlanningGraph — 사업기획 전용 그래프 커스터마이제이션 훅
 * 시그널 맵(useGraphCustomization)과 별도의 Yjs 네임스페이스를 사용하여
 * 데이터 충돌 없이 독립된 온톨로지 캔버스를 운영합니다.
 * 
 * Yjs Map 키:  planning_overrides / planning_customNodesMap / planning_customEdgesMap / planning_deletedEdgesMap
 * Cloud 시트:  PLANNING_MAP_CUSTOMIZATION
 */
export function usePlanningGraph() {
  const { ydoc } = useYjsStore();

  const PREFIX = 'planning_';

  const undoManager = useMemo(() => {
    return new Y.UndoManager([
      ydoc.getMap(`${PREFIX}overrides`),
      ydoc.getMap(`${PREFIX}customNodesMap`),
      ydoc.getMap(`${PREFIX}customEdgesMap`),
      ydoc.getMap(`${PREFIX}deletedEdgesMap`)
    ]);
  }, [ydoc]);

  const store = useMemo(() => {
    const overridesMap = ydoc.getMap(`${PREFIX}overrides`) as Y.Map<NodeOverride>;
    const customNodesMap = ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>;
    const customEdgesMap = ydoc.getMap(`${PREFIX}customEdgesMap`) as Y.Map<OntologyEdge>;
    const deletedEdgesMap = ydoc.getMap(`${PREFIX}deletedEdgesMap`) as Y.Map<boolean>;

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
      const map = ydoc.getMap(`${PREFIX}overrides`) as Y.Map<NodeOverride>;
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
    });
  }, [ydoc]);

  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    const newNode: OntologyNode = {
      id: `plan-${Date.now()}`,
      label,
      group: 'OTHER',
      baseValue: 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100,
    };
    (ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);

  const submitCustomNode = useCallback((node: OntologyNode) => {
    ydoc.transact(() => {
      (ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>).set(node.id, node);
    });
  }, [ydoc]);

  const deleteCustomNode = useCallback((id: string) => {
    ydoc.transact(() => {
      (ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>).delete(id);
      const edgesMap = ydoc.getMap(`${PREFIX}customEdgesMap`) as Y.Map<OntologyEdge>;
      const keysToDelete: string[] = [];
      edgesMap.forEach((edge, key) => {
        if (edge.source === id || edge.target === id) keysToDelete.push(key);
      });
      keysToDelete.forEach(k => edgesMap.delete(k));
    });
  }, [ydoc]);

  const updateCustomNodeText = useCallback((id: string, newLabel: string) => {
    ydoc.transact(() => {
      const map = ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>;
      const node = map.get(id);
      if (node) map.set(id, { ...node, label: newLabel });
    });
  }, [ydoc]);

  const addCustomEdge = useCallback((source: string, target: string) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    ydoc.transact(() => {
      const map = ydoc.getMap(`${PREFIX}customEdgesMap`) as Y.Map<OntologyEdge>;
      const deletedMap = ydoc.getMap(`${PREFIX}deletedEdgesMap`) as Y.Map<boolean>;
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
      const map = ydoc.getMap(`${PREFIX}customEdgesMap`) as Y.Map<OntologyEdge>;
      if (map.has(edgeId)) map.delete(edgeId);
      if (map.has(reverseId)) map.delete(reverseId);
      (ydoc.getMap(`${PREFIX}deletedEdgesMap`) as Y.Map<boolean>).set(edgeId, true);
    });
  }, [ydoc]);

  const renameNodeId = useCallback((oldId: string, newId: string) => {
    ydoc.transact(() => {
      const overridesMap = ydoc.getMap(`${PREFIX}overrides`) as Y.Map<NodeOverride>;
      const customNodesMap = ydoc.getMap(`${PREFIX}customNodesMap`) as Y.Map<OntologyNode>;
      const customEdgesMap = ydoc.getMap(`${PREFIX}customEdgesMap`) as Y.Map<OntologyEdge>;

      if (overridesMap.has(oldId)) {
        overridesMap.set(newId, overridesMap.get(oldId)!);
        overridesMap.delete(oldId);
      }
      for (const [key, override] of Array.from(overridesMap.entries())) {
        if (override.customParent === oldId) {
          overridesMap.set(key, { ...override, customParent: newId });
        }
      }
      if (customNodesMap.has(oldId)) {
        const node = customNodesMap.get(oldId)!;
        customNodesMap.set(newId, { ...node, id: newId });
        customNodesMap.delete(oldId);
      }
      const edgesToMove: [string, OntologyEdge][] = [];
      for (const [key, edge] of Array.from(customEdgesMap.entries())) {
        if (edge.source === oldId || edge.target === oldId) {
          edgesToMove.push([key, {
            ...edge,
            source: edge.source === oldId ? newId : edge.source,
            target: edge.target === oldId ? newId : edge.target
          }]);
        }
      }
      edgesToMove.forEach(([oldKey, edge]) => {
        customEdgesMap.delete(oldKey);
        customEdgesMap.set(`${edge.source}|||${edge.target}`, edge);
      });
    });
  }, [ydoc]);

  const clearAll = useCallback(() => {
    if (confirm('사업기획 캔버스의 모든 내용을 지우겠습니까?')) {
      ydoc.transact(() => {
        [`${PREFIX}overrides`, `${PREFIX}customNodesMap`, `${PREFIX}customEdgesMap`, `${PREFIX}deletedEdgesMap`].forEach(name => {
          const m = ydoc.getMap(name);
          Array.from(m.keys()).forEach(k => m.delete(k));
        });
      });
    }
  }, [ydoc]);

  const syncToCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('사업기획 캔버스를 클라우드에 저장하시겠습니까?')) return;
    try {
      const { replaceAll } = await import('@/lib/sheets-api');
      const latestData = store.getSnapshot();
      const res = await replaceAll('PLANNING_MAP_CUSTOMIZATION', [{ id: 'singleton', ...latestData }]);
      if (res && !silent) alert('☁️ 사업기획 캔버스가 클라우드에 저장되었습니다!');
    } catch (e: unknown) {
      console.error(e);
      if (!silent) alert('동기화 중 오류가 발생했습니다.');
    }
  }, [store]);

  const fetchFromCloud = useCallback(async (silent = false) => {
    if (!silent && !confirm('클라우드에서 사업기획 데이터를 불러오시겠습니까?')) return;
    try {
      const { readSheet } = await import('@/lib/sheets-api');
      const rows = await readSheet<MapCustomizationData & { id: string }>('PLANNING_MAP_CUSTOMIZATION');
      if (rows && rows.length > 0 && rows[0].id === 'singleton') {
        const cloudData = rows[0];
        ydoc.transact(() => {
          [`${PREFIX}overrides`, `${PREFIX}customNodesMap`, `${PREFIX}customEdgesMap`, `${PREFIX}deletedEdgesMap`].forEach(name => {
            const m = ydoc.getMap(name);
            Array.from(m.keys()).forEach(k => m.delete(k));
          });
          if (cloudData.overrides) Object.entries(cloudData.overrides).forEach(([k, v]) => ydoc.getMap(`${PREFIX}overrides`).set(k, v));
          if (cloudData.customNodes) cloudData.customNodes.forEach((n) => { const node = n as OntologyNode; ydoc.getMap(`${PREFIX}customNodesMap`).set(node.id, node); });
          if (cloudData.customEdges) cloudData.customEdges.forEach((e) => { const edge = e as OntologyEdge; ydoc.getMap(`${PREFIX}customEdgesMap`).set(`${edge.source}|||${edge.target}`, edge); });
          if (cloudData.deletedEdges) cloudData.deletedEdges.forEach((e) => { const edgeId = e as string; ydoc.getMap(`${PREFIX}deletedEdgesMap`).set(edgeId, true); });
        });
        if (!silent) alert('☁️ 사업기획 데이터를 불러왔습니다!');
      } else {
        if (!silent) alert('클라우드에 저장된 사업기획 백업이 없습니다.');
      }
    } catch (e: unknown) {
      console.error(e);
      if (!silent) alert('불러오기 중 오류가 발생했습니다.');
    }
  }, [ydoc]);

  // Auto-load from cloud
  const isInitialMount = useRef(true);
  const cloudFetched = useRef(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchFromCloud(true).then(() => {
        cloudFetched.current = true;
        setIsCloudLoaded(true);
      });
    }
  }, [fetchFromCloud]);

  // Auto-save to cloud (debounce 2500ms)
  useEffect(() => {
    if (!cloudFetched.current) return;
    const timer = setTimeout(() => {
      syncToCloud(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [data, syncToCloud]);

  return {
    ...data,
    isCloudLoaded,
    undo,
    redo,
    setNodeOverride,
    addCustomNode,
    submitCustomNode,
    deleteCustomNode,
    updateCustomNodeText,
    addCustomEdge,
    deleteCustomEdge,
    renameNodeId,
    clearAll,
    syncToCloud,
    fetchFromCloud,
  };
}
