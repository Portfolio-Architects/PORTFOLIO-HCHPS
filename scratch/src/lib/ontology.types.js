"use strict";
/**
 * Ontology Graph Type Definitions
 * Layer 1: 업무 논리 도메인(Task/Work Logic Domain)의 과제 엔티티 간
 * 가중 의존성 네트워크 시각화를 위한 타입 정의
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAYER_LABELS = exports.EDGE_TYPE_LABELS = exports.EDGE_TYPE_DASH = exports.GROUP_LABELS = exports.GROUP_COLORS = void 0;
exports.GROUP_COLORS = {
    CORE_PROJECT: '#0055FF', // 비비드 블루
    MACRO_RESEARCH: '#00CC44', // 핫 그린
    DCF_MODELING: '#8800FF', // 일렉트릭 바이올렛
    DATA_PIPELINE: '#FF6600', // 브라이트 오렌지
    INFRASTRUCTURE: '#00BBDD', // 딥 시안
    SYSTEM_RISK: '#FF0044', // 크림슨 레드
    OTHER: '#888888',
};
exports.GROUP_LABELS = {
    CORE_PROJECT: '핵심 키워드',
    MACRO_RESEARCH: '주요 키워드',
    DCF_MODELING: '반복 키워드',
    DATA_PIPELINE: '일반 키워드',
    INFRASTRUCTURE: '기초 키워드',
    SYSTEM_RISK: '주의 키워드',
    OTHER: '기타',
};
exports.EDGE_TYPE_DASH = {
    CAUSAL_DRIVE: [], // ──────── solid
    DEPENDENCY: [8, 4], // ── ── ── long dash
    FEEDBACK_LOOP: [3, 3], // - - - -  short dash
    BOTTLENECK: [2, 2], // ········ dotted
    DECOUPLING: [10, 3, 3, 3], // ── · ── · dash-dot
    ASSIGNEE: [5, 5], // 담당자 지정 점선
    BUDGET_SOURCE: [1, 5], // 예산 출처 촘촘한 도트
    COMPONENTS: [], // 구성 요소 solid
};
exports.EDGE_TYPE_LABELS = {
    CAUSAL_DRIVE: '인과 구동',
    DEPENDENCY: '의존성',
    FEEDBACK_LOOP: '피드백 루프',
    BOTTLENECK: '병목',
    DECOUPLING: '디커플링',
    ASSIGNEE: '담당자 지정',
    BUDGET_SOURCE: '예산 배정',
    COMPONENTS: '구성 요소',
};
exports.LAYER_LABELS = {
    0: '인물 (Agent)',
    1: '예산/비품 (Resource)',
    2: '업무/회의 (Execution)',
    3: '위키/문서 (Knowledge)',
};
