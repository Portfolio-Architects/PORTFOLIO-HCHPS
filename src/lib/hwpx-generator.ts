/**
 * HWPX Generator — 한글 기안문 자동 생성
 * HWPX 템플릿의 section0.xml 내 텍스트를 치환하여
 * 서식(글꼴, 자간, 줄간격 등)을 유지한 채 새 문서를 생성
 */

import JSZip from 'jszip';
import { DocumentEntry } from '@/types';

// ============ 한글 금액 변환 ============

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조'];

export function numberToKorean(num: number): string {
  if (num === 0) return '영';

  const str = String(num);
  const groups: string[] = [];

  // Split into 4-digit groups from right
  for (let i = str.length; i > 0; i -= 4) {
    const start = Math.max(0, i - 4);
    groups.unshift(str.slice(start, i));
  }

  let result = '';
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const bigIdx = groups.length - 1 - gi;
    let groupStr = '';

    for (let di = 0; di < group.length; di++) {
      const digit = parseInt(group[di], 10);
      const smallIdx = group.length - 1 - di;
      if (digit === 0) continue;
      if (digit === 1 && smallIdx > 0) {
        groupStr += SMALL_UNITS[smallIdx];
      } else {
        groupStr += DIGITS[digit] + SMALL_UNITS[smallIdx];
      }
    }

    if (groupStr) {
      result += groupStr + BIG_UNITS[bigIdx];
    }
  }

  return result;
}

export function formatAmount(amount: number): string {
  const korean = numberToKorean(amount);
  const formatted = amount.toLocaleString('ko-KR');
  return `금${formatted}원(금${korean}원)`;
}

// ============ HWPX Template Processing ============

export async function generateHwpx(
  templateData: ArrayBuffer,
  entry: DocumentEntry
): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateData);

  // Read section0.xml
  const section0File = zip.file('Contents/section0.xml');
  if (!section0File) {
    throw new Error('HWPX 템플릿에 Contents/section0.xml이 없습니다.');
  }

  let xml = await section0File.async('string');

  // Build replacement map for the document body
  const fullTitle = `(${entry.expenseType})${entry.title}`;
  const amountStr = formatAmount(entry.amount);
  const vendorStr = `${entry.vendorName} (등록번호 : ${entry.vendorRegNo})`;

  // === Replace title in header table ===
  // The title cell contains the exact text within <hp:t>...</hp:t>
  xml = replaceHpText(xml,
    '(일상경비)2026 지역사회 비만예방 합동 캠페인 운영 부스 렌탈비 지급',
    fullTitle
  );

  // === Replace body paragraphs ===
  // 1. 관련문서 번호
  xml = replaceHpText(xml,
    '1. 보건행정과-1809(2026.02.12.)호와 관련입니다.',
    `1. ${entry.relatedDoc}호와 관련입니다.`
  );

  // 2. 설명문 - 건명
  xml = replaceHpText(xml,
    '2. 비만예방 캠페인 운영을 위한 부스를 렌탈하고 아래와 같이 지급 하고자 합니다.',
    `2. ${entry.title.split(' ').slice(0, 3).join(' ')} 관련 아래와 같이 지급 하고자 합니다.`
  );

  // 가. 건명
  xml = replaceHpText(xml,
    '가. 건    명 : 2026 지역사회 비만예방 합동 캠페인 운영 부스 렌탈비 지급',
    `가. 건    명 : ${entry.title}`
  );

  // 나. 지급액
  xml = replaceHpText(xml,
    '금544,000원(금오십사만사천원)',
    amountStr
  );

  // 라. 지급처
  xml = replaceHpText(xml,
    '티트리렌탈 (등록번호 : 580-04-02685)',
    vendorStr
  );

  // 마. 지급방법
  xml = replaceHpText(xml,
    '지급방법 : 채주 청구 의거 보건행정과 일상경비출납원이 납품업체 계좌로 입금',
    `지급방법 : ${entry.paymentMethod}`
  );

  // 바. 예산과목
  xml = replaceHpText(xml,
    '보건행정과, 건강도시 조성, 건강증진사업관리, 건강생활실천사업(건강증진), ',
    `${entry.budgetAccount}, `
  );

  // 수신
  xml = replaceHpText(xml, '내부결재', entry.recipient);

  // Write modified XML back
  zip.file('Contents/section0.xml', xml);

  // Generate output
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/hwp+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

// ============ Helper: Replace text within <hp:t> tags ============

function replaceHpText(xml: string, search: string, replace: string): string {
  // Escape special XML chars in search for regex
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace all occurrences (some text appears in title and body)
  return xml.replace(new RegExp(escaped, 'g'), escapeXml(replace));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============ Download Helper ============

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}
