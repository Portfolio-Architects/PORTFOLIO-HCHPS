'use client';

import React, { useState, useMemo } from 'react';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';
import { askLlama, ChatMessage } from '@/lib/llm-client';
import { Activity, BrainCircuit, Droplets, Sun, Cloud, CloudRain, CloudLightning, Maximize2 } from 'lucide-react';
import { OntologyNode, CRM_ApprovalLog } from '@/lib/ontology.types';

const MOODS = [
  { value: 'SUNNY', icon: '☀️', label: '맑음' },
  { value: 'CLOUDY', icon: '☁️', label: '흐림' },
  { value: 'RAINY', icon: '☔️', label: '비' },
  { value: 'STORM', icon: '⚡️', label: '폭풍' }
] as const;

export function CrmDashboardView() {
  const { overrides, setNodeOverride, customNodes } = useGraphCustomization();
  
  // 상태 관리: 예측 텍스트 파이프라인
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});

  // overrides에서 isPerson인 타겟만 추출
  const personEntities = useMemo(() => {
    return Object.entries(overrides).filter(([id, config]) => config.isPerson === true)
      .map(([id, config]) => {
        // 노드 라벨 찾기 (customNodes 참조 or id 파싱)
        let label = id;
        const customNode = customNodes.find(n => n.id === id);
        if (customNode && customNode.label) label = customNode.label;
        if (config.customLabel) label = config.customLabel;
        if (label === id && id.includes('-')) label = id.split('-').pop() || id;

        return {
          id,
          label,
          ...config
        };
      });
  }, [overrides, customNodes]);

  const handleRunAiPrediction = async (personId: string, personInfo: any) => {
    if (isGenerating[personId]) return;

    // 예측 시작 상태
    setIsGenerating(prev => ({ ...prev, [personId]: true }));
    setAiResponses(prev => ({ ...prev, [personId]: '' }));

    // 1. 과거 결재 이력 문자열화
    const logs = personInfo.approvalLogs || [];
    const logsInfo = logs.length > 0 
      ? logs.map((l: CRM_ApprovalLog) => `[${l.date}] | ${l.status} | 메모: ${l.memo}`).join('\n')
      : '과거 결재 기록이 없습니다.';

    // 2. 인물 성향 문자열화
    const leadershipStyle = personInfo.leadershipStyle || '알 수 없음';
    const chronotype = personInfo.chronotype || '알 수 없음';
    const currentMood = personInfo.currentMood 
      ? MOODS.find(m => m.value === personInfo.currentMood)?.label || personInfo.currentMood
      : '할당 안됨';
    const scheduleMemo = personInfo.scheduleMemo || '특별한 일정 정보 없음';
    
    const examProximityContext = personInfo.isPreparingExam 
      ? `\n[특수 상황: 5급 승진 역량평가 준비 중]\n해당 대상자는 5급 승진 역량평가(기획/면접)를 준비 중이므로 시간적 압박과 인지적 과부하가 심한 상태입니다.\n- 주말 및 일과 후 시간 침해 리스크(studyTimeProtection)에 극도로 예민하므로 늦은 오후나 금요일 퇴근 직전 보고는 피할 것.\n- 결재 안건의 일괄(Batch) 처리 및 B.L.U.F(Bottom Line Up-Front) 화법 엄격 적용 필수.`
      : '';

    // 3. 사용자 제안 프롬프트 (System)
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `당신은 조직 심리학 및 행동경제학에 기반하여 최적의 의사결정 타이밍을 예측하는 'Personal CRM 전략가'입니다.

<context_integration>
[데이터 로드]
- 대상 인물 성향: 생체리듬(${chronotype}), 리더십 스타일(${leadershipStyle})
- 현재 기상도(기분 상태): ${currentMood}
- 상사 일정/스케줄 변수: ${scheduleMemo}${examProximityContext}
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
      await askLlama([systemPrompt, userPrompt], undefined, (chunk) => {
        setAiResponses(prev => ({
          ...prev,
          [personId]: (prev[personId] || '') + chunk
        }));
      });
    } catch (e) {
      console.error(e);
      setAiResponses(prev => ({
        ...prev,
        [personId]: (prev[personId] || '') + '\n[오류] AI 추론 중 통신 문제가 발생했습니다.'
      }));
    } finally {
      setIsGenerating(prev => ({ ...prev, [personId]: false }));
    }
  };

  const getMoodColor = (mood?: string | null) => {
    switch(mood) {
      case 'SUNNY': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'CLOUDY': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'RAINY': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'STORM': return 'bg-purple-50 text-purple-600 border-purple-200 animate-pulse';
      default: return 'bg-gray-50 text-gray-400 border-gray-200';
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end border-b border-[var(--color-border-light)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
            <Activity className="w-6 h-6 text-indigo-500" /> 결재 기상도 (Personal CRM)
          </h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 ml-8">
            핵심 인물들의 상태와 심리 데이터를 모델링하여 전략적인 의사결정 타이밍을 예측합니다.
          </p>
        </div>
      </div>

      {personEntities.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-[var(--color-border-light)] rounded-2xl bg-[var(--color-card)]">
          <Droplets className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-[var(--color-text-secondary)] font-medium">관리 중인 인물 노드가 없습니다.</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-2 mx-auto max-w-sm text-center">
            시그널 맵(MindMap) 탭의 노드 상세 패널에서 <br/>
            <strong>"👤 인물/이해관계자로 지정"</strong> 옵션을 켜주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {personEntities.map(person => (
            <div key={person.id} className="relative flex flex-col rounded-2xl border border-[var(--color-border-light)] bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
              
              {/* Header Box */}
              <div className="p-5 border-b border-[var(--color-border-light)] bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">{person.label}</h3>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">{person.id}</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${getMoodColor(person.currentMood)}`}>
                    {MOODS.find(m => m.value === person.currentMood)?.icon}
                    {MOODS.find(m => m.value === person.currentMood)?.label || '상태 없음'}
                  </div>
                </div>

                {/* Attributes */}
                <div className="flex gap-2">
                  <select 
                    className="flex-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
                    value={person.leadershipStyle || 'UNKNOWN'}
                    onChange={(e) => setNodeOverride(person.id, { leadershipStyle: e.target.value as any })}
                  >
                    <option value="UNKNOWN">리더십 불명</option>
                    <option value="MICROMANAGER">⚠️ 마이크로매니저</option>
                    <option value="VISIONARY">🚀 비저너리 리더</option>
                  </select>

                  <select 
                    className="flex-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-300"
                    value={person.chronotype || 'UNKNOWN'}
                    onChange={(e) => setNodeOverride(person.id, { chronotype: e.target.value as any })}
                  >
                    <option value="UNKNOWN">생체리듬 불명</option>
                    <option value="LARK">🌅 아침형 (종달새)</option>
                    <option value="OWL">🌃 저녁형 (올빼미)</option>
                  </select>
                </div>
                
                <div className="mt-2.5">
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">주요 일정 (상사 스케줄)</label>
                  <textarea
                    className="w-full text-[11px] font-medium bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 resize-none outline-none focus:border-indigo-300 h-16 custom-scrollbar"
                    placeholder="예) 월요일 오전 임원회의 준비로 예민함, 수요일 오후 연차..."
                    value={person.scheduleMemo || ''}
                    onChange={(e) => setNodeOverride(person.id, { scheduleMemo: e.target.value })}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 px-2 py-2 rounded-lg border border-rose-100 dark:border-rose-900/50">
                  <input
                    type="checkbox"
                    id={`exam-${person.id}`}
                    checked={person.isPreparingExam || false}
                    onChange={(e) => setNodeOverride(person.id, { isPreparingExam: e.target.checked })}
                    className="w-3.5 h-3.5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor={`exam-${person.id}`} className="text-[11px] font-bold text-rose-700 dark:text-rose-400 cursor-pointer">
                    🔥 5급 승진 역량평가 준비 중 (인지적 과부하/시간 압박)
                  </label>
                </div>
              </div>

              {/* Approval Logs */}
              <div className="p-5 flex-1 flex flex-col gap-3 min-h-[150px] max-h-[200px] overflow-y-auto custom-scrollbar border-b border-[var(--color-border-light)] bg-white dark:bg-transparent">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  결재 이력 (최근 {person.approvalLogs?.length || 0}건)
                </h4>
                {(!person.approvalLogs || person.approvalLogs.length === 0) ? (
                  <p className="text-[11px] text-slate-400 italic">기록된 결재나 보고 이력이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {person.approvalLogs.map((log: CRM_ApprovalLog, i: number) => (
                      <div key={i} className="flex flex-col border-l-2 border-slate-200 pl-3 py-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            log.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            log.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status === 'APPROVED' ? '승인됨 (APPROVED)' : 
                             log.status === 'REJECTED' ? '반려됨 (REJECTED)' : 
                             log.status === 'RE_REVIEW' ? '재검토 (RE-REVIEW)' : '보류 (PENDING)'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{log.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{log.memo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Strategy Pane */}
              <div className="p-4 bg-[var(--color-background)]">
                {aiResponses[person.id] ? (
                  <div className="relative group">
                    <div className="absolute -top-3 left-3 bg-gradient-to-r from-indigo-500 to-purple-600 px-2 py-0.5 rounded text-[9px] font-bold text-white shadow-sm flex items-center gap-1">
                      <BrainCircuit size={10} /> AI Agent 분석
                    </div>
                    <div className="p-4 pt-5 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/50 rounded-xl shadow-inner text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {aiResponses[person.id]}
                      {isGenerating[person.id] && <span className="inline-block w-1.5 h-3 ml-1 bg-indigo-500 animate-pulse" />}
                    </div>
                     <button
                        onClick={() => handleRunAiPrediction(person.id, person)}
                        disabled={isGenerating[person.id]}
                        className="absolute bottom-2 right-2 p-1.5 border border-slate-200 rounded-lg bg-white/80 hover:bg-white text-slate-400 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        title="AI 분석 재실행"
                      >
                        <BrainCircuit size={14} />
                      </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleRunAiPrediction(person.id, person)}
                    disabled={isGenerating[person.id]}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating[person.id] ? (
                      <><span className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" /> 모델 스핀업 중...</>
                    ) : (
                      <><BrainCircuit size={16} /> 인물 전략 최적화 요청 (AI)</>
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
