import React from 'react';
import { OrbitalNode, OntologyEdge, GROUP_COLORS, GROUP_LABELS, OntologyGroup } from '@/lib/ontology.types';
import { Edit2, Waypoints, CheckCircle, Trash2, Link2, Radio, X, Crosshair, Activity, Bot } from 'lucide-react';

interface MindMapInspectorProps {
  activeNode: OrbitalNode | null;
  engineRef: React.MutableRefObject<any>;
  overrides: Record<string, any>;
  setNodeOverride: (id: string, options: any) => void;
  setActiveNode: React.Dispatch<React.SetStateAction<OrbitalNode | null>>;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
  updateCustomNodeText: (id: string, text: string) => void;
  removeCustomTombstone: (childId: string, parentId: string) => void;
  deleteCustomNode: (id: string) => void;
  addCustomEdge: (src: string, tgt: string) => void;
  deleteCustomEdge: (src: string, tgt: string) => void;
  parentModeSource: string | null;
  setParentModeSource: (id: string | null) => void;
  initEngine: () => void;
  handleSwapNodeOrder: (dir: -1 | 1) => void;
  clearNodeOverride: (id: string) => void;
  isOverlay: boolean;
}

export function MindMapInspector(props: MindMapInspectorProps) {
  const {
    activeNode, engineRef, overrides, setNodeOverride, setActiveNode,
    onRenameCategory, onDeleteCategory, updateCustomNodeText, removeCustomTombstone,
    deleteCustomNode, addCustomEdge, deleteCustomEdge,
    parentModeSource, setParentModeSource,
    initEngine, handleSwapNodeOrder, clearNodeOverride, isOverlay
  } = props;

  // CRM tab moved to CrmDashboardView

  const renderNodeDetails = (isOverlay: boolean) => {
    return (
      <div 
        className={
          isOverlay 
            ? "absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] w-[95%] md:w-[90%] max-w-[800px] bg-white rounded-xl border border-[var(--color-border-light)] shadow-xl overflow-hidden pointer-events-auto"
            : "w-full h-full flex-1 bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden relative flex flex-col pointer-events-auto"
        }
      >
        <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">노드 상세</h3>
          {isOverlay && (
            <button onClick={() => setActiveNode(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: isOverlay ? '40vh' : 'auto' }}>
                {activeNode ? (
                  <div className="p-4">
                    {/* Group color + label */}
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-base font-bold"
                        style={{ backgroundColor: GROUP_COLORS[activeNode.group as OntologyGroup] }}
                      >
                        {activeNode.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base text-[var(--color-text-primary)] leading-snug flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{activeNode.label}</span>
                            <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                              {activeNode.orbitIndex === 0 ? '중심' : `${activeNode.orbitIndex}궤도`}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newName = prompt('새 이름을 입력하세요:', activeNode.label);
                              if (newName && newName.trim() !== activeNode.label) {
                                // Migrating auto-generated category node overrides to their new ID
                                let targetId = activeNode.id;
                                const rawOld = activeNode.label.startsWith('#') ? activeNode.label.slice(1) : activeNode.label;
                                const rawNew = newName.trim().startsWith('#') ? newName.trim().slice(1) : newName.trim();
                                const isUncategorized = activeNode.id === 'tag-💭 미분류';
                                
                                if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                  targetId = `tag-${rawNew}`;
                                  // Transfer existing overrides to the new anticipated ID
                                  const existingOverride = overrides[activeNode.id] || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  clearNodeOverride(activeNode.id);
                                } else {
                                  // Custom nodes OR '미분류' retain their original ID
                                  const existingOverride = overrides[targetId] || {};
                                  setNodeOverride(targetId, { ...existingOverride, customLabel: newName.trim() });
                                  if (targetId.startsWith('custom-')) {
                                    updateCustomNodeText(targetId, newName.trim());
                                  }
                                }
                                
                                // Mutate engine immediately for fluid UI
                                if (engineRef.current) {
                                  const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                  if (engineNode) {
                                    engineNode.label = newName.trim();
                                    // Make sure we update ID for category migration, BUT don't break custom or uncategorized nodes
                                    if (activeNode.id.startsWith('tag-') && !isUncategorized) {
                                      engineNode.id = targetId; 
                                    }
                                  }
                                  setActiveNode({ ...activeNode, id: targetId, label: newName.trim() });
                                }

                                // Call global sync if it's a category node
                                if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onRenameCategory) {
                                  onRenameCategory(activeNode.label, newName.trim());
                                }
                              }
                            }}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors cursor-pointer shrink-0 ml-2"
                            title="이름 수정"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {(activeNode.orbitIndex === 1 || (activeNode.parentId && activeNode.parentId !== 'root-HCHPS')) && (
                            <>
                              <span className="text-emerald-600 font-medium truncate">
                                📁 카테고리: {activeNode.orbitIndex === 1 ? '메인' : (engineRef.current?.nodes.find((n: OrbitalNode) => n.id === activeNode.parentId)?.label || (activeNode.parentId?.startsWith('tag-') ? activeNode.parentId.replace('tag-', '') : '지정됨'))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeNode.isHedge && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          🚧 병목 노드
                        </span>
                      )}
                    </div>

                    {/* isPerson Toggle for CRM Dashboard */}
                    <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-full ${activeNode.isPerson ? 'bg-indigo-500 text-white' : 'bg-indigo-200 text-indigo-400'}`}>
                            <Activity size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-indigo-900">인물/이해관계자로 지정</span>
                            <span className="text-[10px] text-indigo-500">결재 기상도에서 AI 전략 분석을 사용할 수 있습니다.</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setNodeOverride(activeNode.id, { isPerson: !activeNode.isPerson });
                            if (engineRef.current) {
                              const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                              if (engineNode) engineNode.isPerson = !activeNode.isPerson;
                              setActiveNode({ ...activeNode, isPerson: !activeNode.isPerson });
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeNode.isPerson ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${activeNode.isPerson ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center px-1 gap-1.5">
                        <Waypoints size={12} /> 관계 및 위계 설정
                      </div>
                      <div className="flex flex-col gap-2">
                        {/* 1. 카테고리 위계 선택 (새로운 기능) */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[10px] font-bold text-slate-500">상위 카테고리 (그룹) 소속 지정</label>
                          </div>
                          <div className="flex gap-1.5">
                            <select
                              disabled={activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')}
                              value={activeNode.parentId && activeNode.parentId !== 'root-HCHPS' ? activeNode.parentId : 'NONE'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'NONE') {
                                  setNodeOverride(activeNode.id, { customParent: 'NONE', customOrbitIndex: undefined, fixedX: undefined, fixedY: undefined });
                                } else {
                                  const parentNode = engineRef.current?.nodes.find((n: OrbitalNode) => n.id === val);
                                  const newOrbit = parentNode ? parentNode.orbitIndex + 1 : undefined;
                                  // 과거에 이 대상과의 '끊기'를 수행한 적이 있다면 (Tombstone 존재), 부모 지정을 위해 Tombstone을 영구히 파기
                                  removeCustomTombstone(activeNode.id, val);
                                  setNodeOverride(activeNode.id, { customParent: val, customOrbitIndex: newOrbit, fixedX: undefined, fixedY: undefined });
                                }
                                setTimeout(() => initEngine(), 50);
                              }}
                              className={`flex-1 text-xs px-2 py-1.5 rounded-md border min-w-0 ${(activeNode.id.startsWith('root-') && (!activeNode.parentId || activeNode.parentId === 'root-HCHPS' || activeNode.parentId === 'NONE')) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer'}`}
                            >
                              <option value="NONE">소속 없음 (메인/독립 노드)</option>
                              {engineRef.current?.nodes
                                 .filter((n: OrbitalNode) => {
                                    // If this is the currently selected parent, always show it so the select doesn't break
                                    if (n.id === activeNode.parentId) return true;
                                    // Otherwise, if root node, don't show any other options
                                    if (activeNode.id.startsWith('root-')) return false;
                                    return n.id !== activeNode.id && !n.id.startsWith('root-') && n.orbitIndex > 0;
                                 })
                                 .sort((a: OrbitalNode, b: OrbitalNode) => {
                                   if (a.orbitIndex !== b.orbitIndex) return a.orbitIndex - b.orbitIndex;
                                   return a.label.localeCompare(b.label);
                                 })
                                 .map((c: OrbitalNode) => {
                                   const prefix = c.orbitIndex === 1 ? '📁 1차:' : c.orbitIndex === 2 ? '📄 2차:' : `📄 ${c.orbitIndex}차:`;
                                   return <option key={c.id} value={c.id}>{prefix} {c.label}</option>;
                                 })
                              }
                            </select>
                            
                            <button
                              onClick={() => setParentModeSource(parentModeSource === activeNode.id ? null : activeNode.id)}
                              className={`px-2.5 py-1.5 rounded-md border text-xs shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 ${
                                parentModeSource === activeNode.id
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                              title={parentModeSource === activeNode.id ? "맵에서 지정할 부모 노드를 클릭하세요..." : "맵에서 대상 노드 직접 클릭하기"}
                            >
                              <Crosshair size={14} />
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-tight mt-1">지정된 부모의 위계, 색상, 동기화 망에 종속됩니다.</p>
                        </div>
                        
                        {/* 2. 궤도 차수 강제 지정 */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <label className="text-[10px] font-bold text-slate-500 mb-0.5">궤도(차수) 수동 강제 지정</label>
                          <select
                            disabled={activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)}
                            className={`border text-xs px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer ${(activeNode.id.startsWith('root-') && (!activeNode.customOrbitIndex || activeNode.customOrbitIndex === 0)) ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                            value={activeNode.customOrbitIndex ?? activeNode.orbitIndex ?? 1}
                            onChange={(e) => {
                              const newOrbit = Number(e.target.value);
                              setNodeOverride(activeNode.id, { customOrbitIndex: newOrbit === 0 ? undefined : newOrbit, fixedX: undefined, fixedY: undefined });
                              if (engineRef.current) {
                                const engineNode = engineRef.current.nodes.find((n: OrbitalNode) => n.id === activeNode.id);
                                if (engineNode) {
                                  engineNode.customOrbitIndex = newOrbit;
                                  engineNode.fixedX = undefined;
                                  engineNode.fixedY = undefined;
                                }
                                setActiveNode({ ...activeNode, customOrbitIndex: newOrbit, orbitIndex: newOrbit });
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

                        {/* 3. 형제 노드 간 정렬 순서 조정 */}
                        <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 rounded-lg shadow-sm">
                          <label className="text-[10px] font-bold text-slate-500 mb-0.5">배치 순서 위/아래 이동</label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleSwapNodeOrder(-1)}
                              className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              title="위로 올리기"
                            >
                              ⬆ 위로 이동
                            </button>
                            <button
                              onClick={() => handleSwapNodeOrder(1)}
                              className="flex-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold shadow-sm cursor-pointer transition-colors flex items-center justify-center shrink-0 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                              title="아래로 내리기"
                            >
                              ⬇ 아래로 이동
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>



                    <div className="mb-3">
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center px-1 gap-1.5">
                        <Trash2 size={12} /> 관리 속성
                      </div>
                      <div className="flex flex-col gap-1.5">
                        

                        <div className="flex gap-1.5 mt-0.5">
                          <button
                            onClick={() => {
                              if (confirm(`'${activeNode.label}' 처리를 완료하고 지도에서 숨기시겠습니까?`)) {
                                setNodeOverride(activeNode.id, { hidden: true });
                                if (engineRef.current) {
                                  engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => n.id !== activeNode.id);
                                  engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => e.source !== activeNode.id && e.target !== activeNode.id);
                                  setActiveNode(null);
                                }
                              }
                            }}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm cursor-pointer"
                          >
                            <CheckCircle size={14} /> 완료 처리
                          </button>
                          <button
                            onClick={() => {
                              const isDeepDelete = activeNode.id.startsWith('custom-') || activeNode.orbitIndex === 1;
                              const msg = isDeepDelete 
                                ? '이 카테고리(또는 노드)를 완전히 삭제할까요?\n\n※ 연관된 태그나 데이터 연동이 해제될 수 있습니다.'
                                : '이 노드를 맵에서 삭제할까요?\n\n※ 원본 데이터(업무/지식 등)는 보존되며 맵 화면에서만 지워집니다.';
                              
                              if (confirm(msg)) {
                                if (isDeepDelete) {
                                  // Global sync for category deletion
                                  if ((activeNode.orbitIndex === 1 || activeNode.group === 'MACRO_RESEARCH') && onDeleteCategory) {
                                    onDeleteCategory(activeNode.label);
                                  }
                                  if (activeNode.id.startsWith('custom-')) {
                                    deleteCustomNode(activeNode.id);
                                  }
                                }
                                
                                // 맵 화면에서는 항상 히든 처리합니다. (특히 '미분류' 같은 자동 생성 카테고리나, 서버 삭제 딜레이 시 빠른 UI 반영을 위함)
                                setNodeOverride(activeNode.id, { hidden: true });
                                
                                if (engineRef.current) {
                                  engineRef.current.nodes = engineRef.current.nodes.filter((n: OrbitalNode) => n.id !== activeNode.id);
                                  engineRef.current.edges = engineRef.current.edges.filter((e: OntologyEdge) => e.source !== activeNode.id && e.target !== activeNode.id);
                                  setActiveNode(null);
                                }
                              }
                            }}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-sm cursor-pointer"
                          >
                            <Trash2 size={14} /> 노드 삭제
                          </button>
                        </div>
                      </div>
                    </div>



                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Radio size={28} className="mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-30" />
                    <div className="text-sm text-[var(--color-text-tertiary)] leading-relaxed">
                      노드를 선택해보세요<br />
                      그래프의 점을 클릭하면<br />
                      연결된 관계를 확인할 수 있어요
                    </div>
                  </div>
                )}
        </div>
      </div>
    );
  };

  return renderNodeDetails(isOverlay);
}
