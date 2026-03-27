/**
 * Ontology Graph Type Definitions
 * Layer 1: 업무 논리 도메인(Task/Work Logic Domain)의 과제 엔티티 간
 * 가중 의존성 네트워크 시각화를 위한 타입 정의
 */

// ============ Domain Groups ============

export type OntologyGroup =
  | 'CORE_PROJECT'
  | 'MACRO_RESEARCH'
  | 'DCF_MODELING'
  | 'DATA_PIPELINE'
  | 'INFRASTRUCTURE'
  | 'SYSTEM_RISK'
  | 'OTHER';

export const GROUP_COLORS: Record<OntologyGroup, string> = {
  CORE_PROJECT:   '#0055FF',  // 비비드 블루
  MACRO_RESEARCH: '#00CC44',  // 핫 그린
  DCF_MODELING:   '#8800FF',  // 일렉트릭 바이올렛
  DATA_PIPELINE:  '#FF6600',  // 브라이트 오렌지
  INFRASTRUCTURE: '#00BBDD',  // 딥 시안
  SYSTEM_RISK:    '#FF0044',  // 크림슨 레드
  OTHER:          '#888888',
};

export const GROUP_LABELS: Record<OntologyGroup, string> = {
  CORE_PROJECT:   '핵심 키워드',
  MACRO_RESEARCH: '주요 키워드',
  DCF_MODELING:   '반복 키워드',
  DATA_PIPELINE:  '일반 키워드',
  INFRASTRUCTURE: '기초 키워드',
  SYSTEM_RISK:    '주의 키워드',
  OTHER:          '기타',
};

// ============ Edge Types ============

export type EdgeType =
  | 'CAUSAL_DRIVE'
  | 'DEPENDENCY'
  | 'FEEDBACK_LOOP'
  | 'BOTTLENECK'
  | 'DECOUPLING';

export const EDGE_TYPE_DASH: Record<EdgeType, number[]> = {
  CAUSAL_DRIVE:  [],               // ──────── solid
  DEPENDENCY:    [8, 4],           // ── ── ── long dash
  FEEDBACK_LOOP: [3, 3],           // - - - -  short dash
  BOTTLENECK:    [2, 2],           // ········ dotted
  DECOUPLING:    [10, 3, 3, 3],    // ── · ── · dash-dot
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  CAUSAL_DRIVE:  '인과 구동',
  DEPENDENCY:    '의존성',
  FEEDBACK_LOOP: '피드백 루프',
  BOTTLENECK:    '병목',
  DECOUPLING:    '디커플링',
};

// ============ Node ============

export interface OntologyNode {
  id: string;
  label: string;
  group: OntologyGroup;
  baseValue: number;           // 0-100, user-input importance
  parentId?: string;           // Optional parent ID for radial branch alignment
  // === User Overrides ===
  fixedX?: number;             // User pinned X coordinate
  fixedY?: number;             // User pinned Y coordinate
  customColor?: string;        // User overridden color
  customLabel?: string;        // User overridden text
  customGroup?: OntologyGroup; // User overridden group
  // === Runtime computed ===
  centralityScore?: number;    // Eigenvector-weighted centrality (0-1)
  renderSize?: number;         // blended size (0-1)
  netWeight?: number;          // sum of signed edge weights
  isHedge?: boolean;           // true if netWeight < 0
}

// ============ Orbital Node (Runtime) ============

export interface OrbitalNode extends OntologyNode {
  orbitIndex: number;          // 0 = center, 1-N = orbits
  orbitAngle: number;          // current angle in radians
  orbitSpeed: number;          // rad/frame
  renderX: number;             // canvas X
  renderY: number;             // canvas Y
  renderZ: number;             // depth (-1 to 1)
  connectionToCenter: number;  // connection weight to center node
  nodeRadius: number;          // pixel radius
}

// ============ Edge ============

export interface OntologyEdge {
  source: string;
  target: string;
  weight: number;              // -1.0 ~ 1.0
  type: EdgeType;
}

// ============ Graph ============

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}
