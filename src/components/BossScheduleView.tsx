import React, { useState } from 'react';
import { extractTextFromPdfBuffer } from '@/lib/pdf-parser';
import { askLlama } from '@/lib/llm-client';
import { useBossSchedule, BossScheduleEntry } from '@/hooks/useBossSchedule';
import { UploadCloud, FileText, Loader2, Calendar, ClipboardPaste, CalendarRange } from 'lucide-react';

export function BossScheduleView() {
  const { entries, loading, syncMultiple, deleteEntry } = useBossSchedule();
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string>('');
  const [rawText, setRawText] = useState('');
  
  // PDF 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      setParseStatus('PDF 텍스트 추출 중...');
      const buffer = await file.arrayBuffer();
      const text = await extractTextFromPdfBuffer(buffer);
      setRawText(text);
      
      await handleParseText(text);
    } catch (err) {
      console.error(err);
      setParseStatus('PDF 처리 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
      e.target.value = ''; // input reset
    }
  };

  // 붙여넣기 텍스트 파싱 요청 핸들러
  const handleParseTextSubmt = async () => {
    if (!rawText.trim()) return;
    try {
      setIsParsing(true);
      await handleParseText(rawText);
    } catch (err) {
      console.error(err);
      setParseStatus('텍스트 처리 중 오류가 발생했습니다.');
      setIsParsing(false);
    }
  };

  // LLM 파싱 코어 로직
  const handleParseText = async (text: string) => {
    setParseStatus('AI 일정 분석 중... 조금만 기다려주세요 (최대 10~20초 소요)');
    
    // LLM에게 전송할 프롬프트 구조화
    const prompt = `
당신은 스케줄표에서 일정을 정확하게 추출하는 전문 비서입니다.
다음 텍스트 형태의 일정표에서 모든 회의/일정 항목을 추출해주세요.

[추출 규칙]
1. 반드시 아래 JSON 배열 형식으로만 응답해야 합니다. 다른 사족은 절대 포함하지 마세요. (마크다운 백틱 쓰지 마세요)
2. 날짜는 YYYY-MM-DD (예: 2026-04-10) 형식.
3. 시간은 HH:mm 형태. 종일 일정이면 빈 문자열("") 허용.
4. 제목, 장소를 최대한 찾아 넣고 없다면 빈 문자열.

[목표 JSON 양식]
[
  { "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "title": "...", "location": "..." }
]

[입력 텍스트]
${text}
    `;

    try {
      const responseText = await askLlama([{ role: 'user', content: prompt }]);
      
      // JSON 파싱 시도 (백틱 제거나 \n 필터링 등)
      let cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const startIndex = cleaned.indexOf('[');
      const endIndex = cleaned.lastIndexOf(']');
      
      if (startIndex >= 0 && endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
      }
      
      const parsedArray = JSON.parse(cleaned);

      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        setParseStatus(`성공! ${parsedArray.length}개의 일정을 찾아 저장했습니다.`);
        
        const validEntries = parsedArray.map((item: any) => ({
          date: item.date || '1970-01-01',
          startTime: item.startTime || '',
          endTime: item.endTime || '',
          title: item.title || '제목 없음',
          location: item.location || '',
        }));

        await syncMultiple(validEntries);
      } else {
        setParseStatus('일정 형식으로 인식되는 데이터가 없습니다.');
      }
    } catch (err) {
      console.error(err);
      setParseStatus('분석 실패: AI가 JSON 응답 규격을 지키지 않았습니다.');
    } finally {
      setIsParsing(false);
      setRawText('');
    }
  };

  // 현재 월의 일정만 필터링하거나 정렬
  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(`${b.date}T${b.startTime || '00:00'}`).getTime() - new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
  });

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* 1. Header & Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-xl p-6 bg-indigo-50/30 hover:bg-indigo-50 transition-colors cursor-pointer min-h-[160px]">
          <UploadCloud className="w-10 h-10 text-indigo-400 mb-2" />
          <h3 className="font-bold text-indigo-700 text-base">PDF 일정표 업로드</h3>
          <p className="text-sm text-indigo-500 text-center mt-1">파일을 선택하면 AI가 일정을 자동으로 파싱합니다</p>
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isParsing} />
        </label>

        <div className="flex flex-col bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-h-[160px]">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardPaste className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-gray-700 text-sm">텍스트 붙여넣기 방식</h3>
          </div>
          <textarea
            className="flex-1 w-full text-xs p-2 bg-gray-50 border border-gray-100 rounded resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400 mb-2"
            placeholder="엑셀이나 이메일 일정을 그대로 복사해서 붙여넣으세요."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={isParsing}
          />
          <button 
            onClick={handleParseTextSubmt} 
            disabled={isParsing || !rawText.trim()}
            className="w-full py-1.5 bg-emerald-500 text-white text-xs font-bold rounded shadow hover:bg-emerald-600 disabled:bg-gray-300 transition-colors"
          >
            AI 분석 시작
          </button>
        </div>
      </div>

      {/* Parsing Status Banner */}
      {isParsing && (
        <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-sm font-bold animate-pulse">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {parseStatus}
        </div>
      )}
      {!isParsing && parseStatus && (
        <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium">
          {parseStatus}
        </div>
      )}

      {/* 2. Schedule Timeline List */}
      <div className="flex-1 bg-white rounded-xl border border-[var(--color-border-light)] shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-slate-500" />
            파싱된 지휘부 일정 목록
          </h2>
          <span className="text-xs text-slate-500 px-2 py-1 bg-slate-200 rounded-full">{entries.length}개</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 text-indigo-300 animate-spin" /></div>
          ) : sortedEntries.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm flex flex-col items-center">
              <Calendar className="w-12 h-12 mb-3 opacity-20" />
              아직 등록된 일정이 없습니다.
            </div>
          ) : (
            sortedEntries.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row p-3 rounded-lg border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group">
                <div className="w-auto flex-shrink-0 sm:pr-4 sm:border-r border-slate-100 flex flex-col items-start sm:items-end justify-center mb-2 sm:mb-0">
                  <span className="text-xs font-bold text-slate-500 uppercase">{entry.date}</span>
                  <span className="text-base font-black text-indigo-600 tracking-tight">{entry.startTime || '종일'}</span>
                </div>
                <div className="flex-1 sm:px-4 flex flex-col justify-center">
                  <span className="font-bold text-slate-800 tracking-tight text-sm mb-0.5">{entry.title}</span>
                  {entry.location && <span className="text-xs text-slate-500">📍 {entry.location}</span>}
                </div>
                <div className="flex-shrink-0 flex items-center pt-2 sm:pt-0">
                  <button 
                    onClick={() => { if(window.confirm('삭제하시겠습니까?')) deleteEntry(entry.id) }} 
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
