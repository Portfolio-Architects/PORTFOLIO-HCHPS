'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, DefaultReactSuggestionItem } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { askLlama } from '@/lib/llm-client';

import '@blocknote/mantine/style.css';

interface WikiEditorProps {
  nodeId: string;
  nodeTitle: string;
  initialBlocks?: PartialBlock[];
  onChange?: (blocks: PartialBlock[]) => void;
  onClose?: () => void;
  addCustomEdge?: (source: string, target: string) => void;
}

export function WikiEditor(props: WikiEditorProps) {
  const { nodeId, nodeTitle, initialBlocks, onChange, onClose, addCustomEdge } = props;
  const [isLlamaThinking, setIsLlamaThinking] = useState(false);

  // 에디터 인스턴스 생성 (협업 대신 단일 유저 로컬/클라우드 저장소 사용)
  const editor = useCreateBlockNote({
    initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined
  });

  // 커스텀 Slash Menu (AI 커맨드 추가)
  const getCustomSlashMenuItems = (
    editor: BlockNoteEditor
  ): DefaultReactSuggestionItem[] => [
    {
      title: "✨ AI 비서 호출 (Llama 3)",
      onItemClick: async () => {
        const userPrompt = window.prompt(
          "Llama 3에게 지시할 프롬프트를 입력하세요\n(예: 이 위키 내용을 요약해줘, 또는 이 지식의 목차를 짜줘)"
        );
        if (!userPrompt) return;

        setIsLlamaThinking(true);
        
        try {
          const docText = await editor.blocksToMarkdownLossy(editor.document);
          const currentBlock = editor.getTextCursorPosition().block;
          
          // 임시 로딩 블록 삽입
          editor.insertBlocks(
            [{ type: "paragraph", content: "✨ Llama 3가 생각 중입니다..." }],
            currentBlock,
            "after"
          );
          
          const loadingBlock = editor.getTextCursorPosition().block; // 다음 블록을 가리킴

          // Truncate docText to prevent Cloudflare AI Error 1031 (Max content length)
          const truncatedDocText = docText && docText.length > 3000 ? docText.substring(0, 3000) + '\n... (이하 생략)' : docText;

          const response = await askLlama([
            { role: 'system', content: 'You are a helpful Wiki AI assistant.' },
            { 
              role: 'user', 
              content: `현재 위키 문서 제목: ${nodeTitle}\n\n현재까지 작성된 위키 내용:\n${truncatedDocText}\n\n사용자 지시사항: ${userPrompt}\n\n위 문맥과 지시사항을 바탕으로 마크다운 포맷으로 깔끔하게 응답을 작성해 줘.` 
            }
          ]);

          // 응답이 오면 Markdown을 Block배열로 변환 (tryBlockParse)
          // 간단하게는 replaceBlocks 사용, Markdown 그대로 넣기 어려울 수 있으니 paragraph로 텍스트 삽입 고려
          const lines = response.split('\n');
          const newBlocks: PartialBlock[] = lines.map(line => ({
            type: "paragraph",
            content: line
          }));

          // 로딩 블록을 변환된 블록들로 교체
          editor.replaceBlocks([loadingBlock.id], newBlocks);

        } catch (err) {
          console.error("AI Error:", err);
          alert("AI 호출에 실패했습니다.");
        } finally {
          setIsLlamaThinking(false);
        }
      },
      aliases: ["ai", "llama", "chat"],
      group: "Advanced",
      icon: <span className="text-xl">✨</span>,
      subtext: "Llama 3에게 문장 작성을 요청합니다."
    },
    ...getDefaultReactSlashMenuItems(editor),
  ];

  const [lastSavedMsg, setLastSavedMsg] = useState('');

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* 윗부분 헤더 */}
      <div className="shrink-0 pt-6 px-8 pb-4 border-b border-[var(--color-border-light)] flex justify-between items-start">
        <div>
          <div className="text-xs font-semibold text-[var(--color-primary)] mb-1 uppercase tracking-wider">
            Wiki Document
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {nodeTitle === 'root-HCHPS' ? '메인 루트 위키' : nodeTitle}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {lastSavedMsg && (
            <span className="text-xs text-emerald-600 font-medium animate-pulse">
              {lastSavedMsg}
            </span>
          )}
          {addCustomEdge && (
            <button
              onClick={async () => {
                try {
                  setIsLlamaThinking(true);
                  const docText = await editor.blocksToMarkdownLossy(editor.document);
                  const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? '' : 'https://portfolio-hchps.pages.dev';
                  const storedKey = localStorage.getItem('hchps-api-key');
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (storedKey) headers['X-API-Key'] = storedKey;
                  
                  // 1. Vectorize 검색하여 의미론적 유사 노드 찾기
                  const res = await fetch(`${apiBase}/api/semantic-search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: docText.substring(0, 500), limit: 3 })
                  });
                  if (!res.ok) {
                    throw new Error(`Vectorize API returned status ${res.status}`);
                  }
                  const searchData = await res.json();
                  
                  if (searchData.success && searchData.matches && searchData.matches.length > 0) {
                    let connectedCount = 0;
                    for (const match of searchData.matches) {
                      const targetId = match.id.replace('HCHPS-Wiki-', '');
                      // 자기 자신이 아니고, 유사도가 일정 이상(예: 0.5)일 때만 연결
                      if (targetId !== nodeId && match.score > 0.5) {
                        addCustomEdge(nodeId, targetId);
                        connectedCount++;
                      }
                    }
                    if (connectedCount > 0) {
                      setLastSavedMsg(`✨ ${connectedCount}개의 연관 노드를 궤도에 연결했습니다!`);
                    } else {
                      setLastSavedMsg(`💡 발견된 강한 연관 노드가 없습니다.`);
                    }
                  }
                } catch (e) {
                  console.error('Auto-curation failed: ', e);
                } finally {
                  setIsLlamaThinking(false);
                }
              }}
              className="group px-3 py-1.5 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200 transition-colors"
               title="이 문서 내용을 기반으로 연관성이 깊은 노드들을 화이트보드에 자동으로 선분(Edge) 연결시켜 줍니다."
            >
              <span className="text-[13px] font-bold group-hover:scale-110 transition-transform">✨</span>
              <span className="text-[12px] font-semibold">Auto-Curation</span>
            </button>
          )}
          {onClose && (
            <button 
              onClick={async () => {
                if (onChange) {
                  onChange(editor.document);
                  setLastSavedMsg('저장 성공!');
                }
                
                // Vectorize DB 비동기 동기화 (Background)
                try {
                  const docText = await editor.blocksToMarkdownLossy(editor.document);
                  const apiBase = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
                    ? '' : 'https://portfolio-hchps.pages.dev';
                  
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  const storedKey = localStorage.getItem('hchps-api-key');
                  if (storedKey) headers['X-API-Key'] = storedKey;

                  fetch(`${apiBase}/api/embeddings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      id: `HCHPS-Wiki-${nodeId}`,
                      text: `${nodeTitle}\n\n${docText}`
                    })
                  }).catch(e => console.error(e));
                } catch (e) {
                  console.error('Failed to sync to Vectorize:', e);
                }

                setTimeout(() => onClose(), 100);
              }}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center rounded-full transition-colors"
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 에디터 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {isLlamaThinking && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-4 rounded-xl shadow-md border border-emerald-100 flex items-center gap-3">
              <span className="text-2xl animate-spin">🪄</span>
              <span className="font-medium text-emerald-800">Llama 3가 마법을 부리는 중...</span>
            </div>
          </div>
        )}
        <BlockNoteView
          editor={editor}
          onChange={() => {
            if (onChange) {
               // 최신 블록트리 onChange 이벤트 발생
               onChange(editor.document);
               
               const now = new Date();
               setLastSavedMsg(`자동 저장됨 (${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')})`);
            }
          }}
          slashMenu={false} // 커스텀 메뉴를 위해 비활성화 후 아래 Controller 등록
          theme="light"
          className="min-h-full"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              getCustomSlashMenuItems(editor).filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) || 
                (item.aliases && item.aliases.some(a => a.toLowerCase().includes(query.toLowerCase())))
              )
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}
