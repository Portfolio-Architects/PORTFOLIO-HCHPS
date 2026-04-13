'use client';

import React, { useState, useMemo } from 'react';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { askLlama, ChatMessage } from '@/lib/llm-client';
import { Activity } from 'lucide-react';
import { OntologyNode, CRM_ApprovalLog, GROUP_COLORS, OntologyGroup } from '@/lib/ontology.types';

const MOODS = [
  { value: 'SUNNY', label: '맑음' },
  { value: 'CLOUDY', label: '흐림' },
  { value: 'RAINY', label: '비' },
  { value: 'STORM', label: '폭풍' }
] as const;

export function CrmDashboardView() {
  const { overrides, setNodeOverride, customNodes } = useGraphCustomization();
  
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});

  const personEntities = useMemo(() => {
    return Object.entries(overrides).filter(([id, config]) => config.isPerson === true)
      .map(([id, config]) => {
        let label = id;
        let group = 'OTHER'; // Default group
        const customNode = customNodes.find(n => n.id === id);
        if (customNode) {
            if (customNode.label) label = customNode.label;
            if (customNode.group) group = customNode.group;
        }
        if (config.customLabel) label = config.customLabel;
        if (config.customGroup) group = config.customGroup;
        if (label === id && id.includes('-')) label = id.split('-').pop() || id;

        return {
          id,
          label,
          group,
          ...config
        } as any;
      });
  }, [overrides, customNodes]);

  const handleRunAiPrediction = async (personId: string, personInfo: any) => {
    if (isGenerating[personId]) return;

    setIsGenerating(prev => ({ ...prev, [personId]: true }));
    setAiResponses(prev => ({ ...prev, [personId]: '' }));

    const logs = personInfo.approvalLogs || [];
    const logsInfo = logs.length > 0 
      ? logs.map((l: CRM_ApprovalLog) => `[${l.date}] | ${l.status} | 메모: ${l.memo}`).join('\n')
      : '과거 결재 기록이 없습니다.';

    const leadershipStyle = personInfo.leadershipStyle || '알 수 없음';
    const chronotype = personInfo.chronotype || '알 수 없음';
    const currentMood = personInfo.currentMood 
      ? MOODS.find(m => m.value === personInfo.currentMood)?.label || personInfo.currentMood
      : '할당 안됨';
    const scheduleMemo = personInfo.scheduleMemo || '특별한 일정 정보 없음';
    
    const customContextInfo = (personInfo.useCustomContext && personInfo.customContextText) 
      ? `\n[개별 특수 변수: ${personInfo.customContextText}]\n해당 대상자는 현재 위와 같은 특수한 상황이나 극도의 스트레스를 받고 있을 수 있습니다. 이 요인이 의사결정 및 시간적 여유에 미치는 영향을 최우선으로 고려하여 전략과 타이밍을 제안하세요.`
      : '';

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `당신은 조직 심리학 및 행동경제학에 기반하여 최적의 의사결정 타이밍을 예측하는 'Personal CRM 전략가'입니다.

<context_integration>
[데이터 로드]
- 대상 인물 성향: 생체리듬(${chronotype}), 리더십 스타일(${leadershipStyle})
- 현재 기상도(기분 상태): ${currentMood}
- 상사 일정/스케줄 변수: ${scheduleMemo}${customContextInfo}
- 과거 결재 이력:
${logsInfo}
</context_integration>

<task>
위 Context를 분석하여 사용자에게 이번 주 결재를 받기 가장 좋은 **구체적인 시간대(예: 수요일 오후 3시)**와 **맞춤형 접근 전략**을 3문장 이내의 짧은 텍스트로 추천하세요.
</task>

<anti_pattern>
다음과 같은 형식적인 조언은 절대 피하십시오:
- "상사의 기분이 좋을 때 가세요." (X)
- 과거 이력(memo)이나 스케줄과 무관한 일반적인 직장생활 팁 (X)
- "안타깝게도 결재 기록이 없습니다" 같은 기계적인 서사의 반복 (X)

반드시 제공된 '과거 결재 이력의 메모'와 '인물 성향(리더십/생체리듬)' 데이터를 연결하여 결론을 도출해야 합니다.
</anti_pattern>`
    };

    const userPrompt: ChatMessage = {
      role: 'user',
      content: `상무님(${personInfo.label})에게 이번 기획안 결재를 올리려고 합니다. 언제, 어떻게 접근하는게 좋을까요?`
    };

    try {
      await askLlama([systemPrompt, userPrompt], (chunk) => {
        setAiResponses(prev => ({
          ...prev,
          [personId]: (prev[personId] || '') + chunk
        }));
      });
    } catch (e) {
      console.error(e);
      setAiResponses(prev => ({
        ...prev,
        [personId]: (prev[personId] || '') + '\n[오류] 추론 중 통신 문제가 발생했습니다.'
      }));
    } finally {
      setIsGenerating(prev => ({ ...prev, [personId]: false }));
    }
  };

  const getMoodColor = (mood?: string | null) => {
    switch(mood) {
      case 'SUNNY': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'CLOUDY': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'RAINY': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'STORM': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Activity className="w-5 h-5 text-indigo-500" /> 결재 기상도 (CRM)
          </h2>
          <p className="text-xs text-slate-500 mt-1 ml-7">
            핵심 인물 상태와 데이터를 기반으로 의사결정 타이밍을 예측합니다.
          </p>
        </div>
      </div>

      {personEntities.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 border border-slate-200 rounded-lg bg-slate-50">
          <p className="text-slate-500 font-medium text-sm">표시할 인물 데이터가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1 text-center">시그널 화면에서 대상을 '인물/이해관계자'로 지정해주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {personEntities.map(person => (
            <div key={person.id} className="relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-colors hover:border-slate-300">
              
              <div className="p-4 border-b border-slate-100 bg-transparent relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm"
                      style={{ backgroundColor: person.customColor || GROUP_COLORS[person.group as OntologyGroup] || '#6366f1' }}
                    >
                      {person.label.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-base font-semibold text-slate-900 leading-tight">{person.label}</h3>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{person.id}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-medium border ${getMoodColor(person.currentMood)}`}>
                    {MOODS.find(m => m.value === person.currentMood)?.label || '상태 없음'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <select 
                    className="flex-1 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-700 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    value={person.leadershipStyle || 'UNKNOWN'}
                    onChange={(e) => setNodeOverride(person.id, { leadershipStyle: e.target.value as any })}
                  >
                    <option value="UNKNOWN">리더십 선택</option>
                    <option value="MICROMANAGER">마이크로매니저</option>
                    <option value="VISIONARY">비저너리 리더</option>
                  </select>

                  <select 
                    className="flex-1 text-[11px] font-medium bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-700 outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    value={person.chronotype || 'UNKNOWN'}
                    onChange={(e) => setNodeOverride(person.id, { chronotype: e.target.value as any })}
                  >
                    <option value="UNKNOWN">생체리듬 선택</option>
                    <option value="LARK">아침형 (종달새)</option>
                    <option value="OWL">저녁형 (올빼미)</option>
                  </select>
                </div>
                
                <div className="mt-3">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 block">주요 일정 (상사 스케줄)</label>
                  <textarea
                    className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-700 resize-none outline-none focus:border-slate-400 focus:bg-white h-12 transition-colors leading-relaxed"
                    placeholder="예) 월요일 오전 회의로 예민함..."
                    value={person.scheduleMemo || ''}
                    onChange={(e) => setNodeOverride(person.id, { scheduleMemo: e.target.value })}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-1.5 bg-slate-50 px-2.5 py-2.5 rounded border border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`custom-ctx-${person.id}`}
                      checked={person.useCustomContext || false}
                      onChange={(e) => setNodeOverride(person.id, { useCustomContext: e.target.checked })}
                      className="w-3 h-3 rounded border-slate-300 text-slate-600 focus:ring-slate-500 cursor-pointer"
                    />
                    <label htmlFor={`custom-ctx-${person.id}`} className="text-[11px] font-semibold text-slate-700 cursor-pointer flex-1">
                      개별 특수 변수 (우선 반영)
                    </label>
                  </div>
                  {person.useCustomContext && (
                    <input
                      className="w-full mt-1 text-[11px] bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-slate-400 text-slate-800 placeholder-slate-400 transition-colors"
                      placeholder="예) 인사평가 시즌 극도 압박 상태..."
                      value={person.customContextText || ''}
                      onChange={(e) => setNodeOverride(person.id, { customContextText: e.target.value })}
                    />
                  )}
                </div>
              </div>

              {/* Approval Logs */}
              <div className="p-4 pb-2 flex-1 flex flex-col gap-2 min-h-[100px] border-b border-slate-100 bg-white">
                <h4 className="text-[10px] font-semibold text-slate-400">결재 이력</h4>
                {(!person.approvalLogs || person.approvalLogs.length === 0) ? (
                  <p className="text-[11px] text-slate-400">이력이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 max-h-[100px]">
                    {person.approvalLogs.map((log: CRM_ApprovalLog, i: number) => (
                      <div key={i} className="flex flex-col border-l-2 border-slate-200 pl-2 py-0.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                            log.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                            log.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">{log.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug truncate">{log.memo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Strategy Pane */}
              <div className="p-3 bg-slate-50 flex-1 flex flex-col justify-end min-h-[90px]">
                {aiResponses[person.id] ? (
                  <div className="relative group flex-1 flex flex-col">
                    <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex justify-between">
                      <span>AI 전략 분석</span>
                      <button
                        onClick={() => handleRunAiPrediction(person.id, person)}
                        disabled={isGenerating[person.id]}
                        className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
                      >
                        {isGenerating[person.id] ? '실행중...' : '재실행'}
                      </button>
                    </div>
                    <div className="p-2.5 bg-white border border-slate-200 rounded text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap flex-1 shadow-sm overflow-y-auto custom-scrollbar max-h-[140px]">
                      {aiResponses[person.id]}
                      {isGenerating[person.id] && <span className="inline-block w-1 h-2.5 ml-1 bg-slate-400 animate-pulse" />}
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleRunAiPrediction(person.id, person)}
                    disabled={isGenerating[person.id]}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isGenerating[person.id] ? (
                      <><span className="w-3 h-3 rounded-full border border-slate-300 border-t-slate-600 animate-spin" /> 분석 진행 중...</>
                    ) : (
                      <>전략 분석 요청</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
