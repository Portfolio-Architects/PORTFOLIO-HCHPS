import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, CalendarDays, UploadCloud, Zap } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useGraphCustomization } from '@/hooks/useGraphCustomization';

// pdfjs-dist worker config
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface WeeklyReportViewProps {
  addSignal?: (text: string) => void;
}

interface WeeklyReportData {
  completedTasks: string[];
  upcomingTasks: string[];
  leaderSchedules: string[];
}

export function WeeklyReportView({ addSignal }: WeeklyReportViewProps) {
  const { overrides, setNodeOverride } = useGraphCustomization();
  
  const [extractedRawText, setExtractedRawText] = useState<string>('');
  const [parsedData, setParsedData] = useState<WeeklyReportData | null>(null);
  
  const [draftReport, setDraftReport] = useState<string>('');
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Required for pure Korean PDF
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      let extractedText = `[주간업무 보고: ${file.name}]\n\n`;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        extractedText += pageText + '\n\n';
      }

      setExtractedRawText(extractedText);
      setParsedData(null); // Reset parsed data on new upload
    } catch (err) {
      console.error('PDF parsing error:', err);
      alert('PDF 처리에 실패했습니다. 브라우저 콘솔을 확인하세요.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExtractKnowledge = async () => {
    if (!extractedRawText) return;
    setIsExtracting(true);
    
    try {
      const { askLlama } = await import('@/lib/llm-client');
      
      const prompt = `다음은 주간업무보고서 원문 데이터입니다:
${extractedRawText}

이 내용에서 다음 세 가지를 추출하여 반드시 JSON 형식으로만 응답해 주십시오:
1. "completedTasks" (문자열 배열): 완료된 내역 또는 실적 개요
2. "upcomingTasks" (문자열 배열): 예정 내역 또는 차주 계획
3. "leaderSchedules" (문자열 배열): 팀장 등 상위 결재권자의 주요 일정 (날짜, 시간, 내용 요약)

응답 예시:
{
  "completedTasks": ["A 프로젝트 완료", "B 시스템 패치"],
  "upcomingTasks": ["C 기획안 작성", "D 회의 준비"],
  "leaderSchedules": ["4/15 15:00 외부 업체 미팅"]
}

JSON 텍스트 외에 다른 말은 절대 하지 마십시오. 마크다운 JSON 블록 기호도 생략하고 순수 JSON만 반환하세요.`;

      const response = await askLlama([
        { role: 'system', content: 'You are a highly capable AI assistant that strictly outputs raw valid JSON.' },
        { role: 'user', content: prompt }
      ]);

      const jsonStr = response.replace(/^```json/g, '').replace(/```$/g, '').trim();
      const data = JSON.parse(jsonStr) as WeeklyReportData;
      setParsedData(data);
    } catch (err) {
      console.error('LLM Extraction Error:', err);
      alert('AI 정제에 실패했습니다. 형식이나 원문을 확인해 주세요.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDraftNextWeekReport = async () => {
    if (!parsedData) return;
    setIsDrafting(true);
    try {
      const { askLlama } = await import('@/lib/llm-client');
      
      const prompt = `다음은 이번 주의 주간업무 실적 및 차주 계획 데이터입니다:
[이번주 완료 내역]:
${parsedData.completedTasks.map(t => `- ${t}`).join('\n')}

[이번주에 세운 차주 계획]:
${parsedData.upcomingTasks.map(t => `- ${t}`).join('\n')}

위 데이터를 바탕으로 **다음 주(Next Week)**에 제출할 주간보고서의 '#초안(Draft)'을 공문서(마크다운) 형식으로 세련되게 작성해 주십시오.
이번 주의 '예정 내역'들이 다음 주 보고서에서는 '진행/완료 내역'으로 자연스럽게 승격되며, 새로운 가상의 차주 핵심 목표가 추가되도록 구성하세요.

응답은 마크다운 형식으로 작성된 최종 보고서 내용만 반환하십시오.`;

      const response = await askLlama([
        { role: 'system', content: 'You are a professional executive assistant tasked with drafting a futuristic, highly organized weekly report.' },
        { role: 'user', content: prompt }
      ]);

      setDraftReport(response.trim());
    } catch (err) {
      console.error('Draft Error:', err);
      alert('보고서 초안 생성에 실패했습니다.');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 pt-6 pb-2">
        <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
          <CalendarDays className="text-purple-500" size={32} />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
            주간업무 리포트
          </span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">주간보고 PDF를 업로드하면 자동으로 개인 실적과 팀장님 일정을 데이터화합니다.</p>
      </div>

      <Card className="p-8 border-2 border-dashed border-purple-200 bg-purple-50/30">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-2">
            <UploadCloud size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">이번 주 주간업무 파일(PDF) 끌어다 놓기</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">
            파일을 드롭하거나 버튼을 눌러 제출용 주간보고 문서를 등록하세요.<br/>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="mt-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all font-semibold"
          >
            {isProcessing ? '스캔 분석 중...' : 'PDF 파일 선택하기'}
          </button>
        </div>
      </Card>

      {extractedRawText && !parsedData && (
        <Card className="p-6 bg-white border border-gray-200">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <FileText size={18} className="text-gray-500" /> 추출된 원시 데이터 (임시 뷰)
          </h3>
          <textarea 
            className="w-full h-64 p-4 border rounded-xl text-sm leading-relaxed custom-scrollbar bg-gray-50 text-gray-700"
            value={extractedRawText}
            readOnly
          />
          <div className="flex justify-end gap-3 mt-4">
             <button
               onClick={() => setExtractedRawText('')}
               className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-600"
             >
               초기화
             </button>
             <button 
               onClick={handleExtractKnowledge}
               disabled={isExtracting}
               className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2"
             >
               <Zap size={16} className={isExtracting ? "animate-pulse" : "text-amber-400"} />
               {isExtracting ? 'AI 지식 분류 중...' : 'AI 지식 구조화 및 일정 추출'}
             </button>
          </div>
        </Card>
      )}

      {parsedData && (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-emerald-100 bg-emerald-50/20">
              <h3 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"/> 내 업무 정리 (완료 및 예정)
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-emerald-600 mb-2">이번주 완료 내역</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {parsedData.completedTasks.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-amber-600 mb-2">차주 예정 내역</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {parsedData.upcomingTasks.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-indigo-100 bg-indigo-50/20">
              <h3 className="text-indigo-800 font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"/> 팀장님 주요 일정 (CRM 동기화 대기)
              </h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
                {parsedData.leaderSchedules.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Card>
          </div>

          <div className="flex justify-end gap-3 mt-2">
             <button
               onClick={() => setParsedData(null)}
               className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-600"
             >
               다시 분석하기
             </button>
             <button 
               onClick={() => {
                 let hasAlerted = false;
                 // 1. Migrate to Signal
                 if (parsedData.completedTasks.length > 0 || parsedData.upcomingTasks.length > 0) {
                   const stringifiedTasks = [
                     ...parsedData.completedTasks.map(t => `[완료] ${t}`), 
                     ...parsedData.upcomingTasks.map(t => `[예정] ${t}`)
                   ].join('\n');
                   addSignal?.(`[주간보고 정리]\n${stringifiedTasks}`);
                 }

                 // 2. Map to CRM Team Leader schedule
                 const personIds = Object.entries(overrides).filter(([_, conf]) => conf.isPerson).map(([id]) => id);
                 if (personIds.length > 0 && parsedData.leaderSchedules.length > 0) {
                   // Attach to the first registered person in CRM
                   const targetPersonId = personIds[0];
                   setNodeOverride(targetPersonId, {
                     scheduleMemo: `[최근 주간보고 연동 일정] ${parsedData.leaderSchedules.join(' / ')}`
                   });
                   alert('성공적으로 시그널 키워드가 추출 생성되었으며, 결재 기상도(CRM)의 리더 일정 정보로도 자동 주입되었습니다!');
                   hasAlerted = true;
                 } else if (personIds.length === 0) {
                   alert('시그널은 생성되었으나, 결재 기상도에 등록된 인물이 없어 일정 연동은 생략되었습니다.');
                   hasAlerted = true;
                 }
                 
                 if (!hasAlerted) alert('데이터 전송이 완료되었습니다.');
                 setParsedData(null);
                 setExtractedRawText('');
               }}
               className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-colors flex items-center gap-2"
             >
               <Zap size={16} className="text-amber-400" />
               데이터 확정 및 전송하기
             </button>
          </div>

          <div className="mt-8 border-t border-purple-100 pt-8 pb-4">
             <div className="flex items-center justify-between mb-4">
               <div>
                 <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                   ✨ 차주 주간업무 초안 AI 작성
                 </h3>
                 <p className="text-sm text-gray-500 mt-1">이번 주 실적과 차주 계획 데이터를 바탕으로 다음 주에 제출할 보고서의 뼈대를 미리 생성합니다.</p>
               </div>
               <button 
                 onClick={handleDraftNextWeekReport}
                 disabled={isDrafting}
                 className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
               >
                 <CalendarDays size={18} className={isDrafting ? "animate-pulse" : "text-purple-200"} />
                 {isDrafting ? '마법처럼 보고서 작성 중...' : '차주 보고서 초안 생성'}
               </button>
             </div>
             
             {draftReport && (
               <Card className="p-6 mt-4 bg-purple-50/50 border border-purple-100">
                 <textarea 
                   value={draftReport}
                   onChange={e => setDraftReport(e.target.value)}
                   className="w-full h-80 p-5 bg-white border border-purple-100 rounded-xl text-sm leading-relaxed custom-scrollbar shadow-inner"
                 />
                 <div className="flex justify-end mt-3">
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(draftReport);
                       alert('초안이 클립보드에 복사되었습니다!');
                     }}
                     className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-[13px] font-bold hover:bg-gray-50 shadow-sm"
                   >
                     📋 전체 복사하기
                   </button>
                 </div>
               </Card>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
