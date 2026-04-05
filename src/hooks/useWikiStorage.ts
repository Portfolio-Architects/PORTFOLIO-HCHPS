import { useState, useCallback, useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import type { NodeOverride } from './useGraphCustomization';

/**
 * 특정 노드(nodeId)에 해당하는 위키(에디터 블록 구조)를
 * localStorage에 저장 및 로드하는 훅
 */
export function useWikiStorage(nodeId: string | null, setNodeOverride?: (id: string, override: Partial<NodeOverride>) => void) {
  const [blocks, setBlocks] = useState<PartialBlock[] | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);

  // nodeId 변경 시 로컬스토리지에서 해당 데이터 로드
  useEffect(() => {
    if (!nodeId) {
      setBlocks(undefined);
      setIsLoaded(false);
      return;
    }

    const stored = localStorage.getItem(`HCHPS-Wiki-${nodeId}`);
    let initialBlocks: PartialBlock[] | undefined = undefined;

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
  }, [nodeId]);

  // 새로운 블록 배열 저장
  const saveBlocks = useCallback((nodeIdToSave: string, newBlocks: PartialBlock[]) => {
    if (!nodeIdToSave) return;
    localStorage.setItem(`HCHPS-Wiki-${nodeIdToSave}`, JSON.stringify(newBlocks));
  }, []);

  return { blocks, isLoaded, saveBlocks };
}
