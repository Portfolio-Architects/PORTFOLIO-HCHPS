/**
 * Document Data Fetch — Google Sheets Client-Side Fetch
 * 기안문 데이터를 Google Sheets에서 실시간 로드
 * Uses public CSV export (sheet must be "Published to web")
 */

import { DocumentEntry, generateId } from '@/types';

const SPREADSHEET_ID = '1Ktm5PDYOHm4r5te1vnPC5gcAoIuRFxM5w5X5mSF6DGE';

// ============ CSV Parser ============

function csvToRows(csv: string): string[][] {
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// ============ Fetch from Google Sheets ============

export async function fetchDocumentEntries(): Promise<DocumentEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=DOCUMENT_DATA`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Google Sheets fetch failed: ${res.status}`);
      return [];
    }

    const csv = await res.text();
    const rows = csvToRows(csv);

    if (rows.length < 2) return [];

    // Header: 건명, 경비구분, 금액, 업체명, 등록번호, 관련문서, 수신, 예산과목, 지급방법, 상태
    const entries: DocumentEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      entries.push({
        id: generateId(),
        title: r[0] || '',
        expenseType: r[1] || '일상경비',
        amount: parseInt(r[2]?.replace(/,/g, '') || '0', 10),
        vendorName: r[3] || '',
        vendorRegNo: r[4] || '',
        relatedDoc: r[5] || '',
        recipient: r[6] || '내부결재',
        budgetAccount: r[7] || '',
        paymentMethod: r[8] || '채주 청구 의거 보건행정과 일상경비출납원이 납품업체 계좌로 입금',
        status: (r[9] as DocumentEntry['status']) || 'draft',
      });
    }

    return entries;
  } catch (err) {
    console.warn('DOCUMENT_DATA 시트를 찾을 수 없습니다.', err);
    return [];
  }
}
