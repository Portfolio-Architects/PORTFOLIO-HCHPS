/**
 * CSV Parser — CSV 텍스트를 2D 배열로 변환
 * ontology.fetch.ts와 document.fetch.ts에서 공통 사용
 */

export function csvToRows(csv: string): string[][] {
  if (!csv) return [];
  const lines = csv.split('\n');
  const rows: string[][] = [];
  
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    if (line.trim().length === 0) continue;
    
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
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
    rows.push(result);
  }
  return rows;
}
