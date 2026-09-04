'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MilestoneItem {
  id: number;
  number: string;
  title: string;
  status: 'done' | 'in-progress' | 'todo';
  period: string;
  cooperationDepts?: string[];
  details: string[];
}

export interface BoothItem {
  id: number;
  category: string;
  name: string;
  scale: string;
  program: string;
  status: string;
}

export interface WeeklyReportItem {
  weekTitle: string;
  period: string;
  items: string[];
}

export interface FestivalData {
  meta: {
    title: string;
    shortTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    course: string;
    targetAudience: string;
    programStructure?: string[];
    staffNote?: string;
    organizer: string;
    overallProgress: number;
    lastUpdated: string;
  };
  budget: {
    total: number;
    allocated: {
      agencyService: number;
      suppliesAndRental: number;
      refreshments: number;
      volunteerSupport: number;
    };
    agencyQuotation: number;
    agencyCompany: string;
  };
  weeklyReport?: WeeklyReportItem;
  milestones: MilestoneItem[];
  booths: BoothItem[];
  departmentsCooperation?: {
    dept: string;
    task: string;
    status: string;
  }[];
}

export const YANGJAE_FALLBACK_DATA: FestivalData = {
  "meta": {
    "title": "2026 양재천 걷자! 건강 페스티벌",
    "shortTitle": "2026 양재천 건강 페스티벌",
    "eventDate": "2026-10-31(토)",
    "eventTime": "09:00 ~ 14:00",
    "location": "양재천 수변문화쉼터 및 출발마당 (개포동 1279 일원)",
    "course": "수변문화쉼터 ↔ 영동5교 왕복 (약 4km)",
    "targetAudience": "강남구민 800명 (사전 접수)",
    "programStructure": [
      "강남구보건소와 함께하는 건강 걷기 체험 프로그램",
      "의료 및 건강 관련 체험·홍보 부스 운영"
    ],
    "staffNote": "행사 참여 직원 대체휴무 시행 예정",
    "organizer": "강남구보건소 보건행정과 건강증진팀",
    "overallProgress": 65,
    "lastUpdated": "2026-09-03"
  },
  "budget": {
    "total": 49900000,
    "allocated": {
      "agencyService": 36950000,
      "suppliesAndRental": 9300000,
      "refreshments": 2450000,
      "volunteerSupport": 1200000
    },
    "agencyQuotation": 50215000,
    "agencyCompany": "제이민 커뮤니케이션"
  },
  "weeklyReport": {
    "weekTitle": "주간 추진실적 보고",
    "period": "8. 31. ~ 9. 4.",
    "items": [
      "1. [홍보] 행사 포스터 제작 진행중 (지영팀장님, 오창선)",
      "2. [기획/회의] 9. 1. 행사 관련 회의 완료\n   - 참석: 과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선\n   - 안건: 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등",
      "3. [장소/현장] 9. 2. 양재천 답사 실시\n   - 참석: 지영팀장님, 오창선, 유디치과 직원\n   - 내용: 유디치과 검진버스 위치 및 추가 부스 설치 장소 검토",
      "4. [의전] 구청장님 참석 비서실 사전 협의 (참석 확정, 지영팀장님)",
      "5. [부스] 9. 3. 강남구의사회·한의사회 부스 운영 협조\n   - 참석: 과장님, 오창선\n   - 내용: 부스 운영 확정 및 세부 운영안 조율중"
    ]
  },
  "milestones": [
    {
      "id": 1,
      "number": "추진과제 1",
      "title": "장소 및 일시 확정",
      "status": "done",
      "period": "7월 말 ~ 8.31. (완료)",
      "cooperationDepts": [
        "치수과",
        "공원녹지과"
      ],
      "details": [
        "[완료][7.29.(수)][참여:오창선] 1차 사전답사: 행사장소 '수변문화쉼터' 검토",
        "[완료][8월][참여:과장님, 지영팀장님, 서승오, 오창선] 2차 사전답사 :걷기코스및장소확정",
        "3차 현장미팅(8월): 팀장(김지영), 오창선, 제이민(대행사) 수변문화쉼터 실무 협의",
        "4차 종합미팅(8월): 과장, 팀장(김지영), 오창선, 제이민(대행사) 운영안 조율",
        "5차 실무회의(8.31.): 행사 세부 운영안 및 현안 5차 실무 회의 완료",
        "[완료][9.2.][참여:김지영 팀장님, 오창선, 유디 직원] 양재천 답사: 유디치과 검진버스 위치 및 추가 부스 설치 장소 검토",
        "[협조완료] 치수과: 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)",
        "[협조완료] 공원녹지과: 다리 밑 전기 사용 승인 및 청소카트 2대 지원 협의"
      ]
    },
    {
      "id": 2,
      "number": "추진과제 2",
      "title": "행사 식순 (타임테이블 확정)",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [
        "체육진흥과",
        "문화도시과"
      ],
      "details": [
        "[진행][08:00~08:30] [식전행사] 행사준비 (30분) : BGM 송출 및 현장 점검",
        "[진행][08:30~09:00] [식전공연] 식전 축하공연 (30분) : 브라스밴드 '푸라비다'",
        "[진행][09:00~09:05][참여:김연태 MC] [공식행사] 오프닝 (5분) : 사회자 공식 인사",
        "[진행][09:05~09:07] [공식행사] 국민의례 (2분) : 국기에 대한 경례",
        "[진행][09:07~09:12] [공식행사] 내빈소개 (5분) : 주요 참석 내빈 소개",
        "[진행][09:12~09:20] [공식행사] 인사말씀 & 축사 (8분) : 구청장님 인사말씀 및 내빈 축사",
        "[진행][09:20~09:25] [공식행사] 레크레이션 (5분) : 바르게 걷기 운동 레크레이션",
        "[진행][09:25~09:35] [공식행사] 공연 & 준비운동 (10분) : 치어리더 '팜팜' 준비 체조",
        "[진행][09:35~09:45] [코사진행] 이동 (10분) : START 지점으로 이동",
        "[진행][09:45~09:50] [코사진행] 기념촬영 (5분) : START 아치에서 단체 기념촬영",
        "[진행][09:50~13:00] [코사진행] 1그룹 출발 (190분) : 안전 사고 예방을 위해 2그룹으로 나누어 출발",
        "[진행][10:00~13:00] [코사진행] 2그룹 출발 (180분) : 안전 사고 예방을 위해 2그룹으로 나누어 출발",
        "[진행][11:20~11:40] [이벤트] 축하공연 (20분) : K-POP공연팀 무대",
        "[진행][11:40~12:00] [이벤트] 레크레이션 (20분) : 스틱잡기챌린지",
        "[진행][12:00~12:30] [이벤트] 축하공연 (30분) : 재즈밴드 '더뉴재즈밴드'",
        "[진행][13:00] [이벤트] 마무리 : 행사 마무리 및 행사장 환경 정비"
      ]
    },
    {
      "id": 3,
      "number": "추진과제 3",
      "title": "운영 부스 기획",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 2주",
      "cooperationDepts": [
        "의약과",
        "혁신전략과",
        "자원순환과"
      ],
      "details": [
        "[진행][9.3.][참여:과장님, 오창선] 강남구의사회·한의사회 부스 운영 협조: 운영 확정 및 세부 사항 조율중",
        "민간 전문 4대 의료기관 섭외 완료 (고대척추 X-Ray 버스, 자생한방, 차병원, 유디치과)",
        "민간 헬스케어 부스 확정 (한국신체정보 바른자세분석, 서울체력장 체력측정, 케이스튜디오)",
        "보건소 특화 13개 테마 부스 구성 (정신건강, 치매, CPR, 금연, 만성질환 등)",
        "[협조확정] 의약과: 현장 의료부스 의사 배치 및 의료폐기물 수거통 지원",
        "[협조협의] 혁신전략과: 엔젤로보틱스 웨어러블 보행로봇 시연 부스 조율",
        "[협조예정] 자원순환과: 행사장 대형 쓰레기통 및 분리수거함 현장 배치 지원"
      ]
    },
    {
      "id": 4,
      "number": "추진과제 4",
      "title": "행사 홍보",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 2주",
      "cooperationDepts": [
        "도시계획과",
        "정책홍보실",
        "자치행정과"
      ],
      "details": [
        "[진행][참여:김지영 팀장님, 오창선] 행사 포스터 제작 진행중",
        "구민 800명 온라인 사전접수 시스템 오픈 (강남구청 통합예약 시스템)",
        "홍보 포스터, 리플렛, 현수막, 걷기 완주 인증 팔찌 디자인 시안 확정",
        "[협조예정] 도시계획과: 양재천 교량 및 산책로 현수막 15일간 게첨 승인",
        "[협조기획] 정책홍보실: 구청 홈페이지, SNS, 카카오 알림톡, 보도자료 배포",
        "22개 동 주민센터 민원실 홍보 포스터 및 안내 리플렛 비치 배포"
      ]
    },
    {
      "id": 5,
      "number": "추진과제 5",
      "title": "방침 및 계약",
      "status": "in-progress",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [
        "재무과",
        "감사실",
        "재난안전과",
        "주차관리과"
      ],
      "details": [
        "[완료][9.1.][참여:과장님, 희선팀장님, 김지영 팀장님, 임석훤, 남상희, 오창선] 행사 관련 회의: 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "2026 양재천 걷자! 건강 페스티벌 세부 추진계획(방침) 수립 및 결재",
        "행사시설 설치 및 운영 대행용역 계약심사 및 일상감사 의뢰",
        "대행용역(제이민 커뮤니케이션) 조달/수의 계약 체결 및 착수 보고회",
        "행사장 안전관리계획 수립 및 심의 (재난안전과/경찰서/소방서 합동 심의)",
        "[협조예정] 주차관리과: 행사 당일 지정구역 행사차량 주차단속 유예"
      ]
    },
    {
      "id": 6,
      "number": "추진과제 6",
      "title": "VIP 초청 관련",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 3주",
      "cooperationDepts": [
        "총무과(의전팀)",
        "기획예산과"
      ],
      "details": [
        "[완료][참여:김지영 팀장님] 구청장님 참석 비서실 협의: 참석 확정",
        "주요 초청 내빈 리스트 확정 (구청장님, 구의장 및 구의원, 국회의원, 보건소장, 의사회장 등)",
        "공식 초청장(모바일 및 인쇄본) 제작 및 발송",
        "VIP 개막식 의전 시나리오 및 동선 수립 (귀빈 대기실, 축사 순서, 걷기 출발 선포 터치버튼)",
        "VIP 테마 부스 순회 투어 동선 및 주요 체험 프로그램(X-Ray 버스, 보행로봇 등) 안내 계획"
      ]
    }
  ],
  "booths": [
    {
      "id": 1,
      "category": "전문 의료·검진",
      "name": "강남 차병원",
      "scale": "3동",
      "program": "중년 여성 유방 자가검진 교육, 여성질환 및 영양 상담",
      "status": "확정"
    },
    {
      "id": 2,
      "category": "전문 의료·검진",
      "name": "고려대학교부설 척추측만증연구소",
      "scale": "2동 + 검진버스",
      "program": "거북목·척추측만증 X-Ray 무료 촬영 및 교정 상담",
      "status": "확정"
    },
    {
      "id": 3,
      "category": "전문 의료·검진",
      "name": "서울시 간호조무사회",
      "scale": "2동",
      "program": "혈당 및 혈압 측정, 만성질환 1:1 상담",
      "status": "협의중"
    },
    {
      "id": 4,
      "category": "전문 의료·검진",
      "name": "유디치과",
      "scale": "1동 + 검진버스",
      "program": "구강 검진 및 구강건강 관리법 안내",
      "status": "확정"
    },
    {
      "id": 5,
      "category": "전문 의료·검진",
      "name": "자생한방병원",
      "scale": "2동",
      "program": "간이 침 치료, 스포츠 테이핑 및 한의학 상담",
      "status": "확정"
    },
    {
      "id": 6,
      "category": "민간 헬스케어",
      "name": "케이스튜디오 (디아르스)",
      "scale": "1동",
      "program": "퍼스널 컬러 진단 및 계절별 산책·야외운동 메이크업 봉사",
      "status": "신청완료"
    },
    {
      "id": 7,
      "category": "민간 헬스케어",
      "name": "한국신체정보(주)",
      "scale": "2동",
      "program": "『리얼피티 프로 플러스』 40초 바른자세·체형 분석 및 운동처방",
      "status": "신청완료"
    },
    {
      "id": 8,
      "category": "보건소 사업",
      "name": "금연·절주 영양 보건 사업 홍보",
      "scale": "1동",
      "program": "일산화탄소 측정, 금연상담 및 음주 고글 체험",
      "status": "확정"
    },
    {
      "id": 9,
      "category": "보건소 사업",
      "name": "서울체력장 강남센터",
      "scale": "2동",
      "program": "서울체력장 인증 체력측정 (성인: 2분제자리걷기/악력, 시니어: 의자일어서기)",
      "status": "확정"
    }
  ]
};

export const initialFallbackData = YANGJAE_FALLBACK_DATA;

export function useYangjaeFestival() {
  return useQuery<FestivalData>({
    queryKey: ['festival', 'yangjae'],
    queryFn: async () => {
      const res = await fetch('/api/festival/yangjae?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch festival data');
      }
      return res.json();
    },
    placeholderData: initialFallbackData,
    staleTime: 1000,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 2500,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useSaveYangjaeFestival() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedData: FestivalData) => {
      const res = await fetch('/api/festival/yangjae', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        throw new Error('Failed to save festival data to disk');
      }
      const json = await res.json();
      return (json && json.data) ? (json.data as FestivalData) : updatedData;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['festival', 'yangjae'] });
    },
    onSuccess: (savedData: FestivalData) => {
      queryClient.setQueryData(['festival', 'yangjae'], savedData);
      queryClient.invalidateQueries({ queryKey: ['festival', 'yangjae'] });
    },
  });
}

export function calculateFestivalBudgetSummary(budget?: FestivalData['budget']) {
  if (!budget) {
    return {
      total: 0,
      allocatedTotal: 0,
      balance: 0,
      executionRate: 0,
    };
  }

  const total = Number(budget.total);
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0;

  const allocated = budget.allocated || ({} as Record<string, number>);
  const agencyService = Number(allocated.agencyService);
  const suppliesAndRental = Number(allocated.suppliesAndRental);
  const refreshments = Number(allocated.refreshments);
  const volunteerSupport = Number(allocated.volunteerSupport);

  const safeAgencyService = Number.isFinite(agencyService) && agencyService >= 0 ? agencyService : 0;
  const safeSuppliesAndRental = Number.isFinite(suppliesAndRental) && suppliesAndRental >= 0 ? suppliesAndRental : 0;
  const safeRefreshments = Number.isFinite(refreshments) && refreshments >= 0 ? refreshments : 0;
  const safeVolunteerSupport = Number.isFinite(volunteerSupport) && volunteerSupport >= 0 ? volunteerSupport : 0;

  const allocatedTotal = safeAgencyService + safeSuppliesAndRental + safeRefreshments + safeVolunteerSupport;
  const balance = safeTotal - allocatedTotal;
  const executionRate = safeTotal > 0 ? Math.round((allocatedTotal / safeTotal) * 100) : 0;

  return {
    total: safeTotal,
    allocatedTotal,
    balance,
    executionRate,
  };
}
