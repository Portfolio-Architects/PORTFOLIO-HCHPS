/**
 * 자주 쓰는 스케줄 문자/상용구(Preset) 템플릿 모듈
 * 
 * - 기본 실무 상용구 프리셋 제공 (보안, 회의, 교육, 기타)
 * - 사용자 정의 상용구 LocalStorage 영속 저장 및 CRUD 지원
 */

import { ScheduleType } from '@/types';

export interface SchedulePreset {
  id: string;
  title: string;
  type: ScheduleType;
  person: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  isDefault?: boolean;
}

export const DEFAULT_SCHEDULE_PRESETS: SchedulePreset[] = [
  // 🛡️ 보안
  {
    id: 'def-sec-1',
    title: '정기 보안점검',
    type: 'security',
    person: '오창선',
    startTime: '11:30',
    endTime: '13:00',
    notes: '사내 PC 및 보안 시스템 정기 점검',
    isDefault: true
  },
  {
    id: 'def-sec-2',
    title: '보안 취약점 조치 점검',
    type: 'security',
    person: '오창선',
    startTime: '09:00',
    endTime: '11:00',
    notes: '정보보안 취약점 개선 및 패치 점검',
    isDefault: true
  },
  {
    id: 'def-sec-3',
    title: '정보보안 및 개인정보보호 실태 점검',
    type: 'security',
    person: '오창선',
    startTime: '14:00',
    endTime: '16:00',
    notes: '부서별 보안 서류 및 잠금장치 점검',
    isDefault: true
  },

  // 👥 회의
  {
    id: 'def-meet-1',
    title: '2차 운영위원회 회의',
    type: 'meeting',
    person: '오창선',
    startTime: '14:00',
    endTime: '16:00',
    notes: '장소: 보건소 대회의실',
    isDefault: true
  },
  {
    id: 'def-meet-2',
    title: '주간 업무보고 회의',
    type: 'meeting',
    person: '전 직원',
    startTime: '09:00',
    endTime: '10:00',
    notes: '금주 주요 추진 계획 및 부서 공유',
    isDefault: true
  },
  {
    id: 'def-meet-3',
    title: '사업 추진 현안 검토회',
    type: 'meeting',
    person: '오창선',
    startTime: '10:00',
    endTime: '12:00',
    notes: '신체활동 및 헬스체크업 세부 추진 현안 점검',
    isDefault: true
  },

  // 📚 교육
  {
    id: 'def-edu-1',
    title: '2026년 직장 내 폭력예방 통합 대면교육',
    type: 'education',
    person: '오창선',
    startTime: '10:00',
    endTime: '12:00',
    notes: '법정의무교육',
    isDefault: true
  },
  {
    id: 'def-edu-2',
    title: '심폐소생술(CPR) 실습 교육',
    type: 'education',
    person: '여지현, 조기찬',
    startTime: '13:00',
    endTime: '17:00',
    notes: '응급처치 및 자동심장충격기(AED) 사용법',
    isDefault: true
  },
  {
    id: 'def-edu-3',
    title: '개인정보보호 및 청렴 교육',
    type: 'education',
    person: '오창선',
    startTime: '15:00',
    endTime: '17:00',
    notes: '공직자 청렴 및 개인정보 안전관리 교육',
    isDefault: true
  },

  // 📌 기타
  {
    id: 'def-oth-1',
    title: '통합건강증진 공동사업(비만예방 사업) 실적 제출',
    type: 'other',
    person: '오창선',
    startTime: '09:00',
    endTime: '18:00',
    notes: '사업 실적 데이터 취합 및 공문 제출',
    isDefault: true
  },
  {
    id: 'def-oth-2',
    title: '을지훈련',
    type: 'other',
    person: '오창선',
    startTime: '09:00',
    endTime: '18:00',
    notes: '비상대비 훈련 참여',
    isDefault: true
  },
  {
    id: 'def-oth-3',
    title: '헬스체크업 홍보메시지 발송',
    type: 'other',
    person: '오창선',
    startTime: '11:00',
    endTime: '13:00',
    notes: '구민 대상 안내 알림톡 및 홍보문자 발송',
    isDefault: true
  },
  {
    id: 'def-oth-4',
    title: '캠페인 현장 지원',
    type: 'other',
    person: '오창선',
    startTime: '07:00',
    endTime: '13:00',
    notes: '현장 부스 운영 및 주민 건강측정 지원',
    isDefault: true
  }
];

const STORAGE_KEY = 'vital-schedule-custom-presets';

/**
 * 사용자 정의 및 기본 상용구를 모두 합친 목록을 반환합니다.
 */
export function getSchedulePresets(): SchedulePreset[] {
  if (typeof window === 'undefined') return DEFAULT_SCHEDULE_PRESETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCHEDULE_PRESETS;
    const custom = JSON.parse(raw);
    if (Array.isArray(custom)) {
      return [...DEFAULT_SCHEDULE_PRESETS, ...custom];
    }
  } catch (err) {
    console.warn('[schedule-presets] Failed to load custom presets:', err);
  }
  return DEFAULT_SCHEDULE_PRESETS;
}

/**
 * 특정 유형(type)에 해당하는 상용구 목록을 반환합니다.
 */
export function getPresetsByType(type: ScheduleType): SchedulePreset[] {
  const all = getSchedulePresets();
  return all.filter(p => p.type === type);
}

/**
 * 새 상용구를 로컬 저장소에 추가합니다.
 */
export function addCustomPreset(preset: Omit<SchedulePreset, 'id' | 'isDefault'>): SchedulePreset {
  const newPreset: SchedulePreset = {
    ...preset,
    id: `custom-pre-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
    isDefault: false
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const custom: SchedulePreset[] = raw ? JSON.parse(raw) : [];
      custom.unshift(newPreset);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch (err) {
      console.error('[schedule-presets] Failed to save custom preset:', err);
    }
  }

  return newPreset;
}

/**
 * 사용자 정의 상용구를 삭제합니다.
 */
export function deleteCustomPreset(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const custom: SchedulePreset[] = JSON.parse(raw);
    const filtered = custom.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('[schedule-presets] Failed to delete custom preset:', err);
    return false;
  }
}
