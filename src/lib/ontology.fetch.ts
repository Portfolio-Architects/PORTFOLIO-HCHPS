/**
 * Ontology Fetch — Google Sheets Client-Side Fetch
 * 업무 과제 네트워크 데이터를 Google Sheets에서 실시간 로드
 * Uses public CSV export (sheet must be "Published to web")
 */

import { OntologyGraph } from './ontology.types';
import { buildOntologyGraph } from './ontology.service';

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
    return result;
  });
}

// ============ Fetch from Google Sheets ============

export async function fetchOntologyFromSheets(): Promise<OntologyGraph> {
  const nodesUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=ONTOLOGY_NODES`;
  const edgesUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=ONTOLOGY_EDGES`;

  const [nodesRes, edgesRes] = await Promise.all([
    fetch(nodesUrl),
    fetch(edgesUrl),
  ]);

  if (!nodesRes.ok || !edgesRes.ok) {
    throw new Error(`Google Sheets fetch failed: nodes=${nodesRes.status}, edges=${edgesRes.status}`);
  }

  const nodesCsv = await nodesRes.text();
  const edgesCsv = await edgesRes.text();

  const nodesRaw = csvToRows(nodesCsv);
  const edgesRaw = csvToRows(edgesCsv);

  if (nodesRaw.length < 2) {
    throw new Error('ONTOLOGY_NODES 시트에 데이터가 없습니다.');
  }

  return buildOntologyGraph(nodesRaw, edgesRaw);
}

// ============ Sample Fallback Data (N01-N100 포맷) ============

export function getSampleGraph(): OntologyGraph {
  const nodesRaw: string[][] = [
    ['id', 'label', 'domain', 'base_value'],
    ['N01', '리서치 앱', 'CORE_PROJECT', '98'],
    ['N02', '거시 대시보드', 'MACRO_RESEARCH', '90'],
    ['N03', 'DCF 파이프라인', 'DCF_MODELING', '88'],
    ['N04', '데이터 수집', 'DATA_PIPELINE', '85'],
    ['N05', '과제 스케줄러', 'CORE_PROJECT', '82'],
    ['N06', '보고서 생성', 'MACRO_RESEARCH', '75'],
    ['N07', '재무 파서', 'DCF_MODELING', '72'],
    ['N08', '실시간 동기화', 'DATA_PIPELINE', '70'],
    ['N09', '인증 시스템', 'INFRASTRUCTURE', '68'],
    ['N10', 'API 게이트웨이', 'INFRASTRUCTURE', '65'],
    ['N11', '트렌드 분석', 'MACRO_RESEARCH', '62'],
    ['N12', 'DCF 산출', 'DCF_MODELING', '58'],
    ['N13', 'ETL 배치', 'DATA_PIPELINE', '55'],
    ['N14', '알림 서비스', 'INFRASTRUCTURE', '50'],
    ['N15', '로그 모니터링', 'INFRASTRUCTURE', '48'],
    ['N16', '검토 워크플로우', 'CORE_PROJECT', '74'],
    ['N17', '지표 모델링', 'MACRO_RESEARCH', '67'],
    ['N18', '밸류에이션 모듈', 'DCF_MODELING', '54'],
    ['N19', '캐시 레이어', 'DATA_PIPELINE', '52'],
    ['N20', 'CI/CD 파이프', 'INFRASTRUCTURE', '46'],
    ['N21', '정합성 오류', 'SYSTEM_RISK', '38'],
    ['N22', 'API 리밋', 'SYSTEM_RISK', '36'],
    ['N23', '승인 지연', 'SYSTEM_RISK', '35'],
    ['N24', '서버 장애', 'SYSTEM_RISK', '34'],
    ['N25', '보안 취약점', 'SYSTEM_RISK', '32'],
    ['N26', '레이턴시 병목', 'SYSTEM_RISK', '33'],
  ];

  const edgesRaw: string[][] = [
    ['source', 'target', 'type', 'weight'],
    // 핵심 과제 연결
    ['N01', 'N02', 'CAUSAL_DRIVE', '0.90'],
    ['N01', 'N03', 'CAUSAL_DRIVE', '0.88'],
    ['N01', 'N04', 'CAUSAL_DRIVE', '0.85'],
    ['N01', 'N05', 'DEPENDENCY', '0.82'],
    ['N01', 'N16', 'DEPENDENCY', '0.78'],
    ['N01', 'N09', 'DEPENDENCY', '0.60'],
    ['N01', 'N10', 'DEPENDENCY', '0.55'],
    ['N01', 'N14', 'DEPENDENCY', '0.40'],
    // 리서치 도메인
    ['N02', 'N06', 'CAUSAL_DRIVE', '0.80'],
    ['N02', 'N11', 'DEPENDENCY', '0.72'],
    ['N02', 'N17', 'FEEDBACK_LOOP', '0.68'],
    ['N06', 'N17', 'DEPENDENCY', '0.55'],
    ['N11', 'N05', 'FEEDBACK_LOOP', '0.45'],
    // DCF 도메인
    ['N03', 'N07', 'CAUSAL_DRIVE', '0.75'],
    ['N03', 'N12', 'DEPENDENCY', '0.70'],
    ['N03', 'N18', 'DEPENDENCY', '0.65'],
    ['N07', 'N04', 'DEPENDENCY', '0.50'],
    ['N12', 'N06', 'FEEDBACK_LOOP', '0.48'],
    // 데이터 파이프라인
    ['N04', 'N08', 'CAUSAL_DRIVE', '0.78'],
    ['N04', 'N13', 'DEPENDENCY', '0.60'],
    ['N04', 'N19', 'DEPENDENCY', '0.52'],
    ['N08', 'N10', 'DEPENDENCY', '0.55'],
    ['N13', 'N19', 'DEPENDENCY', '0.42'],
    // 인프라
    ['N10', 'N09', 'DEPENDENCY', '0.65'],
    ['N10', 'N15', 'DEPENDENCY', '0.38'],
    ['N14', 'N15', 'DEPENDENCY', '0.30'],
    ['N20', 'N15', 'DEPENDENCY', '0.35'],
    // 크로스 도메인
    ['N05', 'N03', 'FEEDBACK_LOOP', '0.60'],
    ['N16', 'N07', 'DEPENDENCY', '0.55'],
    ['N16', 'N08', 'DEPENDENCY', '0.48'],
    // 시스템 리스크 (음수)
    ['N21', 'N04', 'BOTTLENECK', '-0.75'],
    ['N21', 'N13', 'BOTTLENECK', '-0.60'],
    ['N21', 'N07', 'BOTTLENECK', '-0.55'],
    ['N22', 'N10', 'BOTTLENECK', '-0.80'],
    ['N22', 'N08', 'BOTTLENECK', '-0.65'],
    ['N23', 'N03', 'BOTTLENECK', '-0.70'],
    ['N23', 'N18', 'BOTTLENECK', '-0.50'],
    ['N24', 'N10', 'BOTTLENECK', '-0.72'],
    ['N24', 'N14', 'BOTTLENECK', '-0.45'],
    ['N24', 'N20', 'BOTTLENECK', '-0.40'],
    ['N25', 'N09', 'BOTTLENECK', '-0.85'],
    ['N25', 'N10', 'BOTTLENECK', '-0.60'],
    ['N26', 'N08', 'BOTTLENECK', '-0.70'],
    ['N26', 'N19', 'BOTTLENECK', '-0.55'],
    // 디커플링
    ['N01', 'N21', 'DECOUPLING', '-0.30'],
    ['N01', 'N25', 'DECOUPLING', '-0.25'],
    ['N02', 'N23', 'DECOUPLING', '-0.20'],
  ];

  return buildOntologyGraph(nodesRaw, edgesRaw);
}
