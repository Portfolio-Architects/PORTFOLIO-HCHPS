import { useState, useCallback, useEffect, useRef } from 'react';
import type { PartialBlock } from '@blocknote/core';
import type { NodeOverride } from './useGraphCustomization';
import { readSheet, replaceAll } from '@/lib/sheets-api';

/**
 * 특정 노드(nodeId)에 해당하는 위키(에디터 블록 구조)를
 * localStorage 및 클라우드(KV)와 동기화하는 훅
 */
export function useWikiStorage(nodeId: string | null, setNodeOverride?: (id: string, override: Partial<NodeOverride>) => void) {
  const [blocks, setBlocks] = useState<PartialBlock[] | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedNodeId, setLoadedNodeId] = useState<string | null>(null);
  const syncTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 로컬/클라우드 병합 로드
  useEffect(() => {
    if (!nodeId) {
      setBlocks(undefined);
      setIsLoaded(false);
      setLoadedNodeId(null);
      return;
    }

    let isCancelled = false;
    const stored = localStorage.getItem(`HCHPS-Wiki-${nodeId}`);
    let initialBlocks: PartialBlock[] | undefined = undefined;

    // 1. 빠른 렌더링을 위해 로컬에서 먼저 읽음
    if (stored) {
      try {
        initialBlocks = JSON.parse(stored);
      } catch (e) {
        console.error("Wiki Loading Error", e);
      }
    }

    // 5W1H 실시간(JIT) 마이그레이션 - 문서 열람 시점에 병합
    try {
      const mapStore = localStorage.getItem('hchps-map-customization');
      if (mapStore) {
        const data = JSON.parse(mapStore);
        const override = data?.overrides?.[nodeId];
        if (override?.story5W1H) {
           const hasMigration = JSON.stringify(initialBlocks || []).includes('5W1H 정보 (마이그레이션)');
           if (!hasMigration) {
              const { who, department, title, contact, when, where, what, how, why } = override.story5W1H;
              if (who || department || title || contact || when || where || what || how || why) {
                const migrationBlocks: PartialBlock[] = [
                  { type: "heading", props: { level: 2 }, content: "5W1H 정보 (마이그레이션)" }
                ];
                if (who) migrationBlocks.push({ type: "paragraph", content: `**누구(Who):** ${who}` });
                if (department) migrationBlocks.push({ type: "paragraph", content: `**소속:** ${department}` });
                if (title) migrationBlocks.push({ type: "paragraph", content: `**직함:** ${title}` });
                if (contact) migrationBlocks.push({ type: "paragraph", content: `**연락처:** ${contact}` });
                if (when) migrationBlocks.push({ type: "paragraph", content: `**언제(When):** ${when}` });
                if (where) migrationBlocks.push({ type: "paragraph", content: `**어디서(Where):** ${where}` });
                if (what) migrationBlocks.push({ type: "paragraph", content: `**무엇을(What):** ${what}` });
                if (how) migrationBlocks.push({ type: "paragraph", content: `**어떻게(How):** ${how}` });
                if (why) migrationBlocks.push({ type: "paragraph", content: `**왜(Why):** ${why}` });

                if (!initialBlocks || (initialBlocks.length === 1 && (!initialBlocks[0].content || (initialBlocks[0].content as unknown[]).length === 0))) {
                  initialBlocks = migrationBlocks;
                } else {
                  initialBlocks = [...migrationBlocks, {type: "paragraph", content: ""}, ...initialBlocks];
                }
                
                // 마이그레이션된 데이터를 즉시 저장
                localStorage.setItem(`HCHPS-Wiki-${nodeId}`, JSON.stringify(initialBlocks));
              }
           }
           
           // 기존 5W1H 마스터본을 메모리 상태 레벨(useGraphCustomization)에서 안전하게 삭제 (좀비 방지)
           if (setNodeOverride) {
             setNodeOverride(nodeId, { story5W1H: undefined });
           } else {
             // Fallback
             delete data.overrides[nodeId].story5W1H;
             localStorage.setItem('hchps-map-customization', JSON.stringify(data));
           }
        }
      }
    } catch(e) {}

    setBlocks(initialBlocks);
    setIsLoaded(true);
    setLoadedNodeId(nodeId);

    // 2. 비동기 클라우드 동기화 (클라우드 데이터가 존재하면 로컬 덮어씌움)
    const fetchCloud = async () => {
      try {
        const rows = await readSheet<any>(`WIKI_DOC_${nodeId}`);
        if (isCancelled) return;
        if (rows && rows.length > 0 && rows[0].id === 'singleton' && rows[0].blocks) {
          const cloudBlocks = rows[0].blocks;
          setBlocks(cloudBlocks);
          localStorage.setItem(`HCHPS-Wiki-${nodeId}`, JSON.stringify(cloudBlocks));
        }
      } catch (e) {
        if (!isCancelled) console.error('Failed to fetch wiki from cloud', e);
      }
    };
    fetchCloud();

    return () => {
      isCancelled = true;
    };
  }, [nodeId]);

  // 새로운 블록 배열 저장 (자동 클라우드 백업)
  const saveBlocks = useCallback((nodeIdToSave: string, newBlocks: PartialBlock[]) => {
    if (!nodeIdToSave) return;
    
    // 로컬 보존 1순위
    localStorage.setItem(`HCHPS-Wiki-${nodeIdToSave}`, JSON.stringify(newBlocks));

    // 디바운스 클라우드 백업 (2초 유지 후 업로드) - 노드 단위로 독립 타이머
    if (syncTimersRef.current[nodeIdToSave]) {
      clearTimeout(syncTimersRef.current[nodeIdToSave]);
    }
    syncTimersRef.current[nodeIdToSave] = setTimeout(async () => {
      try {
        await replaceAll(`WIKI_DOC_${nodeIdToSave}`, [{ id: 'singleton', blocks: newBlocks }]);
        console.log(`[Auto-Save] Wiki ${nodeIdToSave} uploaded to cloud.`);
      } catch (error) {
        console.error(`[Auto-Save] Wiki ${nodeIdToSave} upload failed.`, error);
      }
    }, 2000);
  }, []);

  const safeBlocks = loadedNodeId === nodeId ? blocks : undefined;
  const safeIsLoaded = loadedNodeId === nodeId ? isLoaded : false;

  return { blocks: safeBlocks, isLoaded: safeIsLoaded, saveBlocks };
}
