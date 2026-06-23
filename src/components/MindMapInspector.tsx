import React from 'react';
import { OrbitalNode, OntologyEdge, GROUP_COLORS, OntologyGroup } from '@/lib/ontology.types';
import { NodeOverride } from '@/hooks/useGraphCustomization';
import { Edit2, Waypoints, Trash2, Link2, Radio, X, Crosshair, Activity, Bot, Unlink, Phone } from 'lucide-react';
import { useLocalContacts } from '@/hooks/useLocalContacts';
import { getCanonicalWikiId } from '@/hooks/useWikiStorage';
import { readSheet } from '@/lib/sheets-api';
import { extractRawTextFromBlocks, parseContacts } from '@/lib/contacts-parser';

interface ForceGraphEngine {
  nodes: OrbitalNode[];
  edges: OntologyEdge[];
  needsRedraw?: boolean;
  getConnectedEdges?: (nodeId: string) => Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>;
  getNodeById?: (nodeId: string) => OrbitalNode | null | undefined;
}

interface MindMapInspectorProps {
  activeNode: OrbitalNode | null;
  engineRef: React.MutableRefObject<ForceGraphEngine | null | undefined>;
  overrides: Record<string, NodeOverride>;
  setNodeOverride: (id: string, options: Partial<NodeOverride>) => void;
  setActiveNode: React.Dispatch<React.SetStateAction<OrbitalNode | null>>;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
  updateCustomNodeText: (id: string, text: string) => void;
  removeCustomTombstone: (childId: string, parentId: string) => void;
  renameNodeId?: (oldId: string, newId: string) => void;
  deleteCustomNode: (id: string) => void;
  addCustomEdge: (src: string, tgt: string) => void;
  deleteCustomEdge: (src: string, tgt: string) => void;
  parentModeSource: string | null;
  setParentModeSource: (id: string | null) => void;
  initEngine: () => void;
  handleSwapNodeOrder: (dir: -1 | 1) => void;
  clearNodeOverride: (id: string) => void;
  isOverlay: boolean;
  wikiBlocks?: any[];
}

export function MindMapInspector(props: MindMapInspectorProps) {
  const {
    activeNode, engineRef, overrides, setNodeOverride, setActiveNode,
    onRenameCategory, onDeleteCategory, updateCustomNodeText, removeCustomTombstone, renameNodeId,
    deleteCustomNode, deleteCustomEdge,
    parentModeSource, setParentModeSource,
    initEngine, clearNodeOverride, isOverlay,
    wikiBlocks
  } = props;

  const { recordContactMutation, batchRecordContactsMutation } = useLocalContacts();

  const [connectedEdges, setConnectedEdges] = React.useState<Array<{ edge: OntologyEdge; otherNode: OrbitalNode }>>([]);
  const [parentLabel, setParentLabel] = React.useState<string | null>(null);
  const [engineNodes, setEngineNodes] = React.useState<OrbitalNode[]>([]);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordSuccess, setRecordSuccess] = React.useState(false);

  // Clear success feedback when activeNode changes
  React.useEffect(() => {
    setRecordSuccess(false);
    setIsRecording(false);
  }, [activeNode]);

  const handleRecordToNotebookLM = async (phones: string[], emails: string[]) => {
    if (!activeNode || isRecording) return;
    setIsRecording(true);
    setRecordSuccess(false);

    recordContactMutation.mutate({
      nodeId: activeNode.id,
      nodeLabel: activeNode.label || activeNode.id,
      phones,
      emails
    }, {
      onSuccess: () => {
        setRecordSuccess(true);
        setTimeout(() => {
          setRecordSuccess(false);
        }, 3000);
      },
      onError: (err: any) => {
        alert(`기록 실패: ${err.message || '알 수 없는 오류'}`);
      },
      onSettled: () => {
        setIsRecording(false);
      }
    });
  };

  const [isBatchExtracting, setIsBatchExtracting] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [batchSuccessCount, setBatchSuccessCount] = React.useState<number | null>(null);

  const handleBatchExtractToNotebookLM = async () => {
    if (isBatchExtracting || engineNodes.length === 0) return;
    setIsBatchExtracting(true);
    setBatchSuccessCount(null);
    setBatchProgress({ current: 0, total: engineNodes.length });

    const extractedContacts: Array<{ nodeId: string; nodeLabel: string; phones: string[]; emails: string[] }> = [];

    try {
      for (let i = 0; i < engineNodes.length; i++) {
        const node = engineNodes[i];
        setBatchProgress({ current: i + 1, total: engineNodes.length });

        const canonicalWikiId = getCanonicalWikiId(node.id);
        const rows = await readSheet<any>(`WIKI_DOC_${canonicalWikiId}`);
        if (rows && rows.length > 0 && rows[0].blocks) {
          const rawText = extractRawTextFromBlocks(rows[0].blocks);
          const { phones, emails } = parseContacts(rawText);
          if (phones.length > 0 || emails.length > 0) {
            extractedContacts.push({
              nodeId: node.id,
              nodeLabel: node.label,
              phones,
              emails,
            });
          }
        }
      }

      if (extractedContacts.length === 0) {
        alert('추출 완료: 연락처가 작성된 위키 문서가 없습니다.');
        setIsBatchExtracting(false);
        setBatchProgress(null);
        return;
      }

      // Send all extracted contacts to the backend route
      batchRecordContactsMutation.mutate({
        contacts: extractedContacts
      }, {
        onSuccess: () => {
          setBatchSuccessCount(extractedContacts.length);
          setTimeout(() => {
            setBatchSuccessCount(null);
          }, 4000);
        },
        onError: (err: any) => {
          alert(`기록 실패: ${err.message || '알 수 없는 오류'}`);
        },
        onSettled: () => {
          setIsBatchExtracting(false);
          setBatchProgress(null);
        }
      });
    } catch (err: any) {
      console.error(err);
      alert(`기록 중 에러 발생: ${err.message || err}`);
      setIsBatchExtracting(false);
      setBatchProgress(null);
    }
  };

  React.useEffect(() => {
    if (engineRef.current) {
      setEngineNodes(engineRef.current.nodes || []);
      if (activeNode) {
        const edges = engineRef.current.getConnectedEdges ? engineRef.current.getConnectedEdges(activeNode.id) : [];
        setConnectedEdges(edges || []);
        
        if (activeNode.parentId) {
          const parent = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.parentId);
          setParentLabel(parent ? parent.label : null);
        } else {
          setParentLabel(null);
        }
      } else {
        setConnectedEdges([]);
        setParentLabel(null);
      }
    } else {
      setEngineNodes([]);
      setConnectedEdges([]);
      setParentLabel(null);
    }
  }, [activeNode, engineRef]);

  const uniqueConnectedEdges = React.useMemo(() => {
    const seen = new Set<string>();
    const unique: Array<{ edge: OntologyEdge; otherNode: OrbitalNode }> = [];
    for (const item of connectedEdges) {
      if (item.otherNode && !seen.has(item.otherNode.id)) {
        seen.add(item.otherNode.id);
        unique.push(item);
      }
    }
    return unique;
  }, [connectedEdges]);

  const handleSelectNode = (node: OrbitalNode) => {
    if (engineRef.current) {
      let parentId = node.parentId;
      const engine = engineRef.current as any;
      if (engine && engine.collapsedNodeIds) {
        while (parentId) {
          engine.collapsedNodeIds.delete(parentId);
          const parentNode = engine.nodes.find((n: any) => n.id === parentId);
          parentId = parentNode?.parentId;
        }
        engine.collapsedNodeIds.delete(node.id);
      }
      
      engine.activeNode = node;
      engine.pendingCameraTargetId = node.id;
      engine.needsRedraw = true;
      setActiveNode(node);
    }
  };

  const priorityNodes = React.useMemo(() => {
    if (engineNodes.length === 0) return [];

    const scored = engineNodes
      .filter((n) => n.id !== 'root-HCHPS' && !n.isCompleted && !n.layoutHidden)
      .map((node) => {
        let score = (node.renderSize || 0.5) * 15;
        const reasons: string[] = [];



        // 2. Risk Factor (리스크 스코어)
        const risk = (node as any).riskFactor ?? 0;
        const isRiskOrigin = node.group === 'SYSTEM_RISK';
        if (isRiskOrigin) {
          score += 45;
          reasons.push(`🚨 시스템 리스크 발원지`);
        } else if (risk > 0.3) {
          score += risk * 30;
          reasons.push(`⚠️ 리스크 영향 감지 (위험도: ${(risk * 100).toFixed(0)}%)`);
        }

        // 3. Centrality (핵심 허브)
        if ((node.renderSize || 0.5) > 0.75 && reasons.length === 0) {
          reasons.push(`🌟 네트워크 위상학적 핵심 허브`);
        }

        if (reasons.length === 0) {
          reasons.push(`🔍 위상 분석 및 잠재적 모니터링 대상`);
        }

        return {
          node,
          score,
          reasons,
        };
      });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [engineNodes]);

  const renderNodeDetails = (isOverlay: boolean) => {
    return (
      <div 
        className={
          isOverlay 
            ? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] w-[95%] md:w-[90%] max-w-[800px] glass-panel rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all duration-300 transform translate-y-0 animate-slide-up-fade"
            : "w-full h-full flex-1 glass-panel rounded-2xl shadow-md overflow-hidden relative flex flex-col pointer-events-auto transition-all duration-300"
        }
      >
        <div className="px-4.5 py-3.5 border-b border-white/20 bg-slate-500/5 flex justify-between items-center">
          <h3 className="text-[12.5px] font-bold text-slate-500 uppercase tracking-wider">노드 인스펙터</h3>
          {isOverlay && (
            <button onClick={() => setActiveNode(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: isOverlay ? '45vh' : 'auto' }}>
                {activeNode ? (
                  (() => {
                    const isRadarDoc = activeNode.id.startsWith('radar-doc-');
                    if (isRadarDoc) {
                      const meta = (activeNode as any).meta;
                      const summary = meta?.summary || [];
                      const contacts = meta?.contacts || [];
                      const displayName = activeNode.label.replace('📄 ', '');
                      
                      return (
                        <div className="p-4.5 flex flex-col gap-4 animate-slide-up-fade">
                          {/* Title area */}
                          <div className="flex items-center gap-3.5 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 p-4 rounded-2xl border border-cyan-500/15 shadow-2xs">
                            <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center bg-cyan-500 text-white text-base font-bold shadow-md">
                              📄
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-[14px] text-slate-800 leading-snug truncate" title={displayName}>
                                {displayName}
                              </h4>
                              <span className="text-[9.5px] font-bold text-cyan-600 bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider">
                                시맨틱 파일 레이더
                              </span>
                            </div>
                          </div>

                          {/* 3-Line Summary */}
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                              <Bot size={13} className="text-cyan-500 animate-pulse" /> AI 3줄 요약
                            </div>
                            <div className="flex flex-col gap-2.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-4 shadow-2xs">
                              {summary.map((line: string, idx: number) => (
                                <div key={idx} className="flex gap-2.5 items-start">
                                  <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-700 font-bold text-[9.5px] flex items-center justify-center border border-cyan-500/15">
                                    {idx + 1}
                                  </span>
                                  <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                                    {line}
                                  </p>
                                </div>
                              ))}
                              {summary.length === 0 && (
                                <p className="text-[11px] font-semibold text-slate-500 italic">요약이 존재하지 않습니다.</p>
                              )}
                            </div>
                          </div>

                          {/* Key Contacts */}
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                              <Phone size={13} className="text-cyan-500" /> 실무 사업 담당자
                            </div>
                            <div className="flex flex-col gap-2">
                              {contacts.map((contact: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/60 hover:bg-white p-3 rounded-2xl border border-slate-200/30 text-[11px] font-semibold text-slate-700 shadow-2xs transition-all duration-150">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-slate-800 text-[11.5px]">{contact.name || '미상'}</span>
                                      <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                        {contact.role || '담당자'}
                                      </span>
                                    </div>
                                    <span className="text-slate-500 font-mono text-[10.5px]">{contact.phone || '번호 없음'}</span>
                                  </div>
                                  {contact.phone && (
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(contact.phone);
                                          alert('전화번호가 클립보드에 복사되었습니다.');
                                        }}
                                        className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-3xs"
                                      >
                                        복사
                                      </button>
                                      <a
                                        href={`tel:${contact.phone}`}
                                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-3xs flex items-center gap-1"
                                      >
                                        전화
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {contacts.length === 0 && (
                                <p className="text-[11px] font-semibold text-slate-500 italic p-3 bg-slate-500/5 rounded-2xl border border-slate-200/30">
                                  문서에서 담당자 정보를 식별하지 못했습니다.
                                </p>
                              )}
                              
                              {contacts.length > 0 && (
                                <button
                                  onClick={() => {
                                    const phones = contacts.map((c: any) => c.phone).filter(Boolean);
                                    handleRecordToNotebookLM(phones, []);
                                  }}
                                  disabled={isRecording}
                                  className={`mt-2 w-full py-2.5 px-3.5 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                    recordSuccess
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                      : 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-cyan-400'
                                  }`}
                                >
                                  <Bot size={13} className={isRecording ? "animate-spin" : ""} />
                                  {isRecording ? '기록 중...' : recordSuccess ? '✓ 노트북 LM 기록 완료!' : '💾 노트북 LM에 담당자 연락처 기록'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-4.5 flex flex-col gap-4">
                        {/* Group color + label */}
                    <div className="flex items-center gap-3.5 bg-white/40 p-3.5 rounded-2xl border border-slate-200/30">
                      <div
                        className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-white text-base font-bold shadow-sm"
                        style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }}
                      >
                        {activeNode.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[15.5px] text-slate-800 leading-snug flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{activeNode.label}</span>
                            <span className="shrink-0 px-2 py-0.5 bg-slate-200/60 border border-slate-200/80 text-slate-600 rounded text-[9.5px] font-bold uppercase tracking-wide">
                              {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newName = prompt('새 이름을 입력하세요:', activeNode.label);
                              if (newName && newName.trim() !== activeNode.label) {
                                  let targetId = activeNode.id;
                                  const rawNew = newName.trim().startsWith('#') ? newName.trim().slice(1) : newName.trim();
                                const isUncategorized = activeNode.id === 'tag-💭 미분류';
                                
                                if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                  targetId = `tag-${rawNew}`;
                                  if (renameNodeId) {
                                    renameNodeId(activeNode.id, targetId);
                                    const existingOverride = overrides[targetId] || overrides[activeNode.id] || {};
                                    setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  } else {
                                    const existingOverride = overrides[activeNode.id] || {};
                                    setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                    clearNodeOverride(activeNode.id);
                                  }
                                } else {
                                  const existingOverride = overrides[targetId] || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  if (targetId.startsWith('custom-')) {
                                    updateCustomNodeText(targetId, newName.trim());
                                  }
                                }
                                
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.label = newName.trim();
                                    if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                      engineNode.id = targetId; 
                                    }
                                  }
                                  setActiveNode({ ...activeNode, id: targetId, label: newName.trim() });
                                }
 
                                if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onRenameCategory) {
                                  onRenameCategory(activeNode.label, newName.trim());
                                }
                              }
                            }}
                            className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-500 hover:text-white transition-all cursor-pointer shrink-0 ml-2"
                            title="이름 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-1">
                          {(activeNode.orbitIndex === 1 || (activeNode.parentId && activeNode.parentId !== 'root-HCHPS')) && (
                            <>
                              <span className="text-emerald-600 font-semibold truncate">
                                 📁 카테고리: {activeNode.orbitIndex === 1 ? '메인' : (parentLabel || (activeNode.parentId?.startsWith('tag-') ? activeNode.parentId.replace('tag-', '') : '지정됨'))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
 
                    {/* Tags */}
                    {activeNode.isHedge && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 border border-rose-500/15 text-rose-700 uppercase tracking-wider animate-pulse">
                          🚧 병목 노드
                        </span>
                      </div>
                    )}
 
                    {/* Node Attributes Toggles: Highlight */}
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex flex-col bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl shadow-2xs">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">노드 항상 강조</label>
                          <button
                            onClick={() => {
                              const newVal = !activeNode.isHighlighted;
                              setNodeOverride(activeNode.id, { isHighlighted: newVal });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) engineNode.isHighlighted = newVal;
                                setActiveNode({ ...activeNode, isHighlighted: newVal });
                              }
                            }}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeNode.isHighlighted ? 'bg-amber-400' : 'bg-slate-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${activeNode.isHighlighted ? 'translate-x-3' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <span className="text-[9px] text-amber-600 font-bold leading-tight">선택 여부와 관계없이 3D 캔버스 내 글로우 후광 상시 유지</span>
                      </div>
                    </div>

                    {/* 모바일 다이렉트 연락처 카드 */}
                    {(() => {
                      const rawText = extractRawTextFromBlocks(wikiBlocks || []);
                      const { phones, emails } = parseContacts(rawText);
                      
                      if (phones.length === 0 && emails.length === 0) return null;
                      
                      return (
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 border border-indigo-500/15 rounded-2xl shadow-2xs">
                          <div className="text-[10px] font-bold text-indigo-700 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                            <Phone size={12} className="animate-pulse text-indigo-500" />
                            📞 담당자 연락처 &amp; 아카이브
                          </div>
                          <div className="flex flex-col gap-2">
                            {phones.map((phone) => (
                              <div key={phone} className="flex items-center justify-between bg-white/70 p-2.5 rounded-xl border border-slate-200/30 text-[11.5px] font-semibold text-slate-700 shadow-2xs">
                                <span>{phone}</span>
                                <div className="flex gap-1.5">
                                  <a
                                    href={`tel:${phone}`}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px]"
                                  >
                                    전화
                                  </a>
                                  <a
                                    href={`sms:${phone}`}
                                    className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 text-[10.5px]"
                                  >
                                    문자
                                  </a>
                                </div>
                              </div>
                            ))}
                            {emails.map((email) => (
                              <div key={email} className="flex items-center justify-between bg-white/70 p-2.5 rounded-xl border border-slate-200/30 text-[11.5px] font-semibold text-slate-700 shadow-2xs min-w-0">
                                <span className="truncate mr-2 text-slate-600" title={email}>{email}</span>
                                <a
                                  href={`mailto:${email}`}
                                  className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1 shrink-0 text-[10.5px]"
                                >
                                  메일
                                </a>
                              </div>
                            ))}

                            <button
                              onClick={() => handleRecordToNotebookLM(phones, emails)}
                              disabled={isRecording}
                              className={`mt-1.5 w-full py-2 px-3.5 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                recordSuccess
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400'
                              }`}
                            >
                              <Bot size={13} className={isRecording ? "animate-spin" : ""} />
                              {isRecording ? '기록 중...' : recordSuccess ? '✓ 노트북 LM 기록 완료!' : '💾 노트북 LM에 기록'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {activeNode.id !== 'root-HCHPS' && (
                      <div className="flex flex-col gap-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                          <Waypoints size={13} className="text-slate-400" /> 관계 및 위계 설정
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* 1. 카테고리 위계 선택 */}
                          <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">상위 카테고리 (그룹) 소속 지정</label>
                            <div className="flex gap-2">
                              <select
                                disabled={activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')}
                                value={activeNode.parentId ? activeNode.parentId : 'NONE'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'NONE') {
                                    setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                    setTimeout(() => {
                                      if (engineRef.current) {
                                        setActiveNode(prev => prev ? { ...prev, parentId: undefined, customOrbitIndex: undefined } : null);
                                        initEngine();
                                      }
                                    }, 50);
                                  } else {
                                    const parentNode = engineRef.current?.nodes.find((n: OrbitalNode) => n.id === val);
                                    const newOrbit = parentNode ? parentNode.orbitIndex + 1 : undefined;
                                    removeCustomTombstone(activeNode.id, val);
                                    setNodeOverride(activeNode.id, { customParent: val, customOrbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
                                    setTimeout(() => {
                                      if (engineRef.current) {
                                        setActiveNode(prev => prev ? { ...prev, parentId: val, customOrbitIndex: newOrbit, orbitIndex: newOrbit ?? prev.orbitIndex } : null);
                                        initEngine();
                                      }
                                    }, 50);
                                  }
                                }}
                                className={`flex-1 text-xs px-2.5 py-2 rounded-xl border min-w-0 font-medium ${(activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/40 cursor-pointer'}`}
                              >
                                <option value="NONE">❌ 연결 해제 (독립된 맵으로 고립)</option>
                                 {(activeNode.parentId && activeNode.parentId !== 'root-HCHPS' && !engineNodes.some((n: OrbitalNode) => n.id === activeNode.parentId)) && (
                                   <option value={activeNode.parentId}>
                                     👻 현재 맵에 없는 이전 부모 ({activeNode.parentId.replace('tag-', '').replace('custom-', '')})
                                   </option>
                                 )}
                                 {engineNodes
                                   .filter((n: OrbitalNode) => {
                                      if (n.id === activeNode.parentId) return true;
                                      if (activeNode.id.startsWith('root-') || activeNode.orbitIndex === 0) return false;
                                      return n.id !== activeNode.id;
                                   })
                                   .sort((a: OrbitalNode, b: OrbitalNode) => {
                                     if (a.orbitIndex !== b.orbitIndex) return a.orbitIndex - b.orbitIndex;
                                     return a.label.localeCompare(b.label);
                                   })
                                   .map((c: OrbitalNode) => {
                                     const prefix = c.orbitIndex === 0 ? '🌟 중심(에코):' : c.orbitIndex === 1 ? '📁 1차:' : c.orbitIndex === 2 ? '📄 2차:' : `📄 ${c.orbitIndex}차:`;
                                     return <option key={c.id} value={c.id}>{prefix} {c.label}</option>;
                                   })
                                }
                              </select>
                              
                              <button
                                onClick={() => setParentModeSource(parentModeSource === activeNode.id ? null : activeNode.id)}
                                className={`px-3 py-2 rounded-xl border text-xs shadow-2xs cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                                  parentModeSource === activeNode.id
                                    ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-inner'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                                title={parentModeSource === activeNode.id ? "맵에서 지정할 부모 노드를 클릭하세요..." : "맵에서 대상 노드 직접 클릭하기"}
                              >
                                <Crosshair size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {/* 2. 궤도 차수 강제 지정 */}
                          <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">궤도(차수) 수동 강제 지정</label>
                            <select
                              disabled={activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)}
                              className={`border text-xs px-2.5 py-2 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40 cursor-pointer ${(activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                              value={activeNode.customOrbitIndex ?? activeNode.orbitIndex ?? 1}
                              onChange={(e) => {
                                const newOrbit = Number(e.target.value);
                                const resolvedOrbit = newOrbit === 0 ? undefined : newOrbit;

                                setNodeOverride(activeNode.id, { customOrbitIndex: resolvedOrbit, fixedX: undefined, fixedY: undefined });
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.customOrbitIndex = resolvedOrbit;
                                    engineNode.fixedX = undefined;
                                    engineNode.fixedY = undefined;
                                  }
                                  setActiveNode({ ...activeNode, customOrbitIndex: resolvedOrbit, orbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
                                }
                                setTimeout(() => initEngine(), 50);
                              }}
                            >
                              {activeNode.id.startsWith('root-') && <option value="0">초기화 (0차 복귀)</option>}
                              <option value="1">1차 카테고리 (메인)</option>
                              <option value="2">2차 궤도 파생</option>
                              <option value="3">3차 궤도 파생</option>
                              <option value="4">4차 궤도 파생</option>
                              <option value="5">5차 궤도 파생</option>
                              <option value="6">6차 궤도 파생</option>
                            </select>
                          </div>

                          {/* 3. 위치 고정 해제 */}
                          {overrides[activeNode.id] && (
                            (overrides[activeNode.id].fixedX !== undefined && overrides[activeNode.id].fixedX !== null) || 
                            (overrides[activeNode.id].fixedY !== undefined && overrides[activeNode.id].fixedY !== null)
                          ) && (
                            <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">수동 드래그 위치 고정 상태</label>
                              <button
                                onClick={() => {
                                  setNodeOverride(activeNode.id, { fixedX: undefined, fixedY: undefined });
                                  if (engineRef.current) {
                                    const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                    if (engineNode) {
                                      engineNode.fixedX = undefined;
                                      engineNode.fixedY = undefined;
                                    }
                                    setActiveNode({ ...activeNode, fixedX: undefined, fixedY: undefined });
                                  }
                                  setTimeout(() => initEngine(), 50);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-rose-600 bg-rose-500/10 border border-rose-500/15 hover:bg-rose-500 hover:text-white rounded-xl transition-all cursor-pointer font-bold shadow-2xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                고정 좌표 초기화 (물리 거동 복원)
                              </button>
                            </div>
                          )}

                          {/* 4. 연결 끊기 */}
                          <div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">연결 끊기 (관계 해제)</label>
                            {uniqueConnectedEdges.length === 0 ? (
                              <div className="text-[10.5px] font-semibold text-slate-400 text-center py-2">
                                연결된 노드가 없습니다.
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                                {uniqueConnectedEdges.map(({ otherNode }) => {
                                  const isParentChild = activeNode.parentId === otherNode.id || otherNode.parentId === activeNode.id;
                                  return (
                                    <div key={otherNode.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-500/5 rounded-xl transition-all">
                                      <span className={`text-[11px] font-semibold truncate ${isParentChild ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600'}`}>
                                        {otherNode.label}
                                      </span>
                                      <button
                                        onClick={() => {
                                          if (confirm(`'${activeNode.label}'와(과) '${otherNode.label}'의 연결을 해제하시겠습니까?`)) {
                                            if (activeNode.parentId === otherNode.id) {
                                              setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                            } else if (otherNode.parentId === activeNode.id) {
                                              setNodeOverride(otherNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                            }
                                            deleteCustomEdge(activeNode.id, otherNode.id);
                                            
                                            setTimeout(() => {
                                              initEngine();
                                              if (engineRef.current) {
                                                 const updatedActive = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : null;
                                                 if (updatedActive) {
                                                   setActiveNode(updatedActive);
                                                 }
                                              }
                                            }, 50);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0"
                                        title="연결 해제"
                                      >
                                        <Unlink size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeNode.id !== 'root-HCHPS' && (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center px-1 gap-1.5">
                          <Trash2 size={13} /> 관리 속성
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex gap-1.5 mt-0.5">
                            <button
                              onClick={() => {
                                if (!activeNode) return;
                                
                                const allNodes = engineRef.current ? engineRef.current.nodes : [];
                                const children = allNodes.filter((n: OrbitalNode) => n.parentId === activeNode.id);
                                const hasChildren = children.length > 0;
                                
                                let deleteList: OrbitalNode[] = [activeNode];
                                let cascadeDelete = false;

                                if (hasChildren) {
                                  cascadeDelete = confirm(
                                    `"${activeNode.label}" 노드에 하위 노드가 ${children.length}개 존재합니다.\n\n하위 노드도 전체 함께 삭제하시겠습니까?\n\n[확인]: 하위 노드도 모두 일괄 삭제\n[취소]: 선택한 부모 노드만 단독 삭제`
                                  );
                                  
                                  if (cascadeDelete) {
                                    const queue = [activeNode.id];
                                    const visited = new Set<string>([activeNode.id]);
                                    
                                    while (queue.length > 0) {
                                      const currentId = queue.shift()!;
                                      const childNodes = allNodes.filter((n: OrbitalNode) => n.parentId === currentId);
                                      for (const child of childNodes) {
                                        if (!visited.has(child.id)) {
                                          visited.add(child.id);
                                          deleteList.push(child);
                                          queue.push(child.id);
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const isDeepDelete = activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1;
                                  const msg = isDeepDelete 
                                    ? '이 카테고리(또는 노드)를 완전히 삭제할까요?\n\n※ 연관된 태그나 데이터 연동이 해제될 수 있습니다.'
                                    : '이 노드를 맵에서 삭제할까요?\n\n※ 원본 데이터(업무/지식 등)는 보존되며 맵 화면에서만 지워집니다.';
                                  if (!confirm(msg)) return;
                                }

                                const deleteIds = deleteList.map(n => n.id);
                                const deleteLabels = deleteList.map(n => n.label).filter(Boolean) as string[];

                                try {
                                  const oldTombstonesRaw = localStorage.getItem('hchps-global-tombstones');
                                  const tombstones: string[] = oldTombstonesRaw ? JSON.parse(oldTombstonesRaw) : [];
                                  localStorage.setItem('hchps-global-tombstones', JSON.stringify(Array.from(new Set([...tombstones, ...deleteIds]))));

                                  const oldLabelsRaw = localStorage.getItem('hchps-deleted-labels');
                                  const deletedLabels: string[] = oldLabelsRaw ? JSON.parse(oldLabelsRaw) : [];
                                  localStorage.setItem('hchps-deleted-labels', JSON.stringify(Array.from(new Set([...deletedLabels, ...deleteLabels]))));
                                } catch (e) {
                                  console.error('Tombstone saving error:', e);
                                }

                                for (const targetNode of deleteList) {
                                  const isDeepDelete = targetNode.id.startsWith('custom-') || targetNode.orbitIndex === 1;
                                  
                                  if (isDeepDelete) {
                                    if ((targetNode.orbitIndex === 1 || targetNode.group === 'MACRO_RESEARCH') && onDeleteCategory) {
                                      onDeleteCategory(targetNode.label);
                                    }
                                    if (targetNode.id.startsWith('custom-')) {
                                      deleteCustomNode(targetNode.id);
                                    }
                                  }
                                  
                                  setNodeOverride(targetNode.id, { hidden: true });
                                }

                                if (engineRef.current) {
                                  const deleteIdSet = new Set(deleteIds);
                                  engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => !deleteIdSet.has(n.id));
                                  engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => !deleteIdSet.has(e.source) && !deleteIdSet.has(e.target));
                                  engineRef.current.needsRedraw = true;
                                }
                                
                                setActiveNode(null);
                              }}
                              className="flex-1 flex justify-center items-center gap-1.5 py-2.5 bg-rose-500/10 border border-rose-500/15 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-500 hover:text-white transition-all shadow-2xs cursor-pointer"
                            >
                              <Trash2 size={14} /> 노드 삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4.5 flex flex-col h-full gap-4">
                    {priorityNodes.length > 0 ? (
                      <div className="flex-1 flex flex-col">
                        <div className="mb-4 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center gap-2 mb-2 text-indigo-700">
                            <Bot size={18} className="animate-pulse" />
                            <h4 className="text-xs font-bold uppercase tracking-wider">스마트 포커스 레이더</h4>
                          </div>
                          <p className="text-[11.5px] text-slate-600 leading-normal font-semibold">
                            전체 {engineNodes.length}개 노드 중 위상 중요도, 마감 기한, 리스크 영향도를 실시간 종합 분석하여 지금 가장 집중해야 할 노드를 추천합니다.
                          </p>
                        </div>

                        {/* 노트북 LM 전역 연락처 추출 및 기록 카드 */}
                        <div className="mb-4 p-4 bg-slate-500/5 border border-slate-200/40 rounded-2xl shadow-2xs">
                          <div className="text-[10px] font-bold text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <Link2 size={12} className="text-indigo-500" />
                            📂 노트북 LM 전역 연락처 추출
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold mb-3">
                            캔버스의 전체 {engineNodes.length}개 노드 위키 문서를 스캔하여 감지된 모든 연락처 정보를 `data/local_contacts.txt` 파일에 추출·기록합니다.
                          </p>
                          <button
                            onClick={handleBatchExtractToNotebookLM}
                            disabled={isBatchExtracting}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                              batchSuccessCount !== null
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400'
                            }`}
                          >
                            {isBatchExtracting ? (
                              <>
                                <Bot size={13} className="animate-spin" />
                                <span>스캔 중... ({batchProgress?.current}/{batchProgress?.total})</span>
                              </>
                            ) : batchSuccessCount !== null ? (
                              <span>✓ {batchSuccessCount}개 노드 추출 완료! (txt 파일 저장됨)</span>
                            ) : (
                              <>
                                <span>💾 전체 노드 연락처 일괄 추출</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="text-[11px] font-bold text-slate-400 mb-2.5 px-1 flex items-center gap-1.5 uppercase tracking-wider">
                          <Activity size={13} className="text-indigo-500 animate-pulse" /> 핵심 요주의 노드 Top 5
                        </div>

                        <div className="flex flex-col gap-2">
                          {priorityNodes.map(({ node, score, reasons }) => {
                            const groupColor = GROUP_COLORS[node.group as OntologyGroup] || '#94A3B8';
                            return (
                              <button
                                key={node.id}
                                onClick={() => handleSelectNode(node)}
                                className="w-full text-left bg-white/60 hover:bg-white border border-slate-200/40 hover:border-indigo-500/30 rounded-xl p-3.5 shadow-2xs hover:shadow-md hover:scale-[1.005] transition-all duration-150 flex items-start gap-3 group cursor-pointer"
                              >
                                <div 
                                  className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs"
                                  style={{ backgroundColor: groupColor }}
                                >
                                  {node.label.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 truncate transition-colors">
                                      {node.label}
                                    </span>
                                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-bold text-indigo-700 bg-indigo-500/10 border border-indigo-500/15 rounded-md">
                                      중요도: {score.toFixed(0)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    {reasons.map((r, idx) => (
                                      <span key={idx} className="text-[9.5px] font-semibold text-slate-500 flex items-center gap-1">
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 my-auto">
                        <Radio size={28} className="mx-auto mb-3.5 text-slate-300 animate-pulse" />
                        <div className="text-xs font-bold text-slate-400 leading-relaxed">
                          노드를 선택해보세요<br />
                          그래프의 점을 클릭하면<br />
                          연결된 관계를 확인할 수 있어요
                        </div>
                      </div>
                    )}
                  </div>
                )}
        </div>
      </div>
    );
  };

  return renderNodeDetails(isOverlay);
}
