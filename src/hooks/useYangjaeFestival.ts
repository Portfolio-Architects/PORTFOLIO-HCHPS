import { useQuery } from '@tanstack/react-query';

export interface FestivalData {
  meta: {
    title: string;
    shortTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    course: string;
    targetAudience: string;
    organizer: string;
    overallProgress: number;
    lastUpdated: string;
    programStructure?: string[];
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
  weeklyRoadmap: Array<{
    week: number;
    label?: string;
    period: string;
    title: string;
    status: 'done' | 'in-progress' | 'todo';
    details: string[];
  }>;
  booths: Array<{
    id: number;
    category: string;
    name: string;
    scale: string;
    program: string;
    status: string;
  }>;
  departmentsCooperation: Array<{
    dept: string;
    task: string;
    status: string;
  }>;
}

export const YANGJAE_FALLBACK_DATA: FestivalData = {
  meta: {
    title: "『강남구보건소』와 함께하는 2026 양재천 걷자! 건강 페스티벌",
    shortTitle: "2026 양재천 건강 페스티벌",
    eventDate: "2026-10-31",
    eventTime: "09:00 ~ 14:00",
    location: "양재천 수변문화쉼터 및 출발마당 (개포동 1279 일원)",
    course: "수변문화쉼터 ↔ 영동5교 왕복 (약 4km)",
    targetAudience: "강남구민 800명 (사전 온라인 접수)",
    programStructure: [
      "강남구보건소와 함께하는 건강 걷기 체험 프로그램",
      "보건 사업 및 민간 건강 관련 체험·홍보 : 20~30개 부스"
    ],
    organizer: "강남구보건소 보건행정과 건강증진팀",
    overallProgress: 65,
    lastUpdated: "2026-09-01"
  },
  budget: {
    total: 49900000,
    allocated: {
      agencyService: 36950000,
      suppliesAndRental: 9300000,
      refreshments: 2450000,
      volunteerSupport: 1200000
    },
    agencyQuotation: 50215000,
    agencyCompany: "제이민 커뮤니케이션"
  },
  weeklyRoadmap: [
    {
      week: 1,
      label: "8월 실적",
      period: "7월 말 ~ 8.31.",
      title: "현장 사전답사(1~4차) 및 기획 실무회의(5차)",
      status: "done",
      details: [
        "1차 사전답사(7월 말): 현장 실사 및 장소 '수변문화쉼터' 검토",
        "2차 사전답사(8월): 과장, 팀장(김지영), 서승오, 오창선 코스 답사",
        "3차 현장미팅(8월): 팀장(김지영), 오창선, 제이민(대행사) 수변문화쉼터 실무 협의",
        "4차 종합미팅(8월): 과장, 팀장(김지영), 오창선, 제이민(대행사) 운영안 조율",
        "5차 실무회의(8.31.): 행사 세부 운영안 및 현안 5차 실무 회의 진행",
        "치수과 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)"
      ]
    },
    {
      week: 2,
      period: "9월 1주 (09.01~09.06)",
      title: "전문 검진/웰니스 부스 섭외 및 계약심사 의뢰",
      status: "in-progress",
      details: [
        "민간 전문 4대 기관 섭외 확정 (고대척추 X-Ray 버스, 자생한방, 차병원, 유디치과)",
        "신체정보(리얼피티), 서울체력장(강남센터), 케이스튜디오 부스 신청 접수",
        "행사시설 설치 및 운영 대행용역 계약심사 및 일상감사 의뢰"
      ]
    },
    {
      week: 3,
      period: "9월 2주 (09.08~09.13)",
      title: "구청 내 협조부서 실무협의 및 부스 확정",
      status: "todo",
      details: [
        "보건소 내 13개 테마 부스(정신건강, 치매, CPR, 감염병 등) 담당자 지정",
        "도시계획과(현수막 게첨), 공원녹지과(전기/청소카트), 주차관리과 협조 공문 발송",
        "혁신전략과 웨어러블 보행로봇(엔젤로보틱스) 시연 부스 조율"
      ]
    },
    {
      week: 4,
      period: "9월 3주 (09.15~09.20)",
      title: "대행사 계약 체결 및 홍보물 디자인 확정",
      status: "todo",
      details: [
        "운영 대행 용역 정식 계약 체결 및 착수 보고",
        "홍보 포스터, 리플렛, 현수막, 걷기 완주 인증 팔찌 디자인 확정",
        "구청 홈페이지, SNS, 알림톡 사전 홍보안 기획"
      ]
    },
    {
      week: 5,
      period: "9월 4주 (09.22~09.27)",
      title: "구민 800명 온라인 사전접수 시스템 오픈",
      status: "todo",
      details: [
        "강남구청 통합예약 시스템 참가자 800명 사전 접수 개시",
        "양재천 일대 가로등 배너 및 교량 현수막 15일간 게첨 시작",
        "동 주민센터 홍보 포스터 및 리플렛 배포"
      ]
    },
    {
      week: 6,
      period: "10월 2주 (10.05~10.11)",
      title: "안전관리계획 심의 및 자원봉사자 모집",
      status: "todo",
      details: [
        "행사장 안전관리계획 수립 및 재난안전과/경찰서/소방서 합동 심의",
        "현장 안전요원 20명, 자원봉사자 30명 모집 및 사전 교육",
        "응급의료부스 의사 배치 및 구급차(영동5교/대치교) 비상동선 점검"
      ]
    },
    {
      week: 7,
      period: "10월 3주 (10.12~10.18)",
      title: "시스템/발전차/부스 배치 현장 기술 실사",
      status: "todo",
      details: [
        "수변문화쉼터 앞 20개 부스 2D/3D 배치 실측 및 라인 마킹",
        "150kW 발전차 위치 및 다리 밑 분전함 간선 전기 배선 실사",
        "음향 5kW 시뮬레이션 및 무대(목공백월 8x3.5m) 설치 위치 확정"
      ]
    },
    {
      week: 8,
      period: "10월 4주 (10.19~10.31)",
      title: "최종 리허설 및 D-Day 행사 개최",
      status: "todo",
      details: [
        "10/30(금) 14:00~ 무대/천막/에어아치/전기 시스템 사전 설치",
        "10/31(토) 08:00 스태프 집결, 09:00 개막식 및 800명 걷기 출발",
        "14:00 완주 인센티브 지급, 철수 및 양재천 환경정비 완료"
      ]
    }
  ],
  booths: [
    { id: 1, category: "전문 의료·검진", name: "고려대학교부설 척추측만증연구소", scale: "2동 + 검진버스", program: "거북목·척추측만증 X-Ray 무료 촬영 및 교정 상담", status: "확정" },
    { id: 2, category: "전문 의료·검진", name: "자생한방병원", scale: "3동", program: "간이 침 치료, 스포츠 테이핑 및 한의학 상담", status: "확정" },
    { id: 3, category: "전문 의료·검진", name: "강남 차병원", scale: "3동", program: "중년 여성 유방 자가검진 교육, 여성질환 및 영양 상담", status: "확정" },
    { id: 4, category: "전문 의료·검진", name: "유디치과", scale: "2동 + 검진버스", program: "구강 검진 및 구강건강 관리법 안내", status: "확정" },
    { id: 5, category: "전문 의료·검진", name: "서울시 간호조무사회", scale: "2동", program: "혈당 및 혈압 측정, 만성질환 1:1 상담", status: "확정" },
    { id: 6, category: "민간 헬스케어", name: "한국신체정보(주)", scale: "2동", program: "『리얼피티 프로 플러스』 40초 바른자세·체형 분석 및 운동처방", status: "신청완료" },
    { id: 7, category: "민간 헬스케어", name: "서울체력장 강남센터", scale: "2동", program: "서울체력장 인증 체력측정 (성인: 2분제자리걷기/악력, 시니어: 의자일어서기)", status: "확정" },
    { id: 8, category: "민간 헬스케어", name: "케이스튜디오 (디아르스)", scale: "1동", program: "퍼스널 컬러 진단 및 계절별 산책·야외운동 메이크업 봉사", status: "신청완료" },
    { id: 9, category: "첨단 로봇", name: "혁신전략과 / 엔젤로보틱스", scale: "2동", program: "시니어 보행보조 웨어러블 로봇 착용 및 체험", status: "협의중" },
    { id: 10, category: "보건소 특화", name: "마음건강 충전소 (정신건강팀)", scale: "1동", program: "스트레스 완화 및 정서 안정을 돕는 마음건강 검사", status: "확정" },
    { id: 11, category: "보건소 특화", name: "두뇌건강 치매예방 (어르신건강팀)", scale: "1동", program: "인지능력 향상 체험 교구 및 치매 조기선별 안내", status: "확정" },
    { id: 12, category: "보건소 특화", name: "어르신 낙상예방 민첩성 운동", scale: "1동", program: "균형감각 및 민첩성 향상 신체활동 체험", status: "확정" },
    { id: 13, category: "보건소 특화", name: "골든타임 심폐소생술(CPR)", scale: "1동", program: "마네킹 활용 CPR 실습 및 자동심장충격기(AED) 사용법", status: "확정" },
    { id: 14, category: "보건소 특화", name: "금연·절주 클리닉 (NO담배 NO음주)", scale: "1동", program: "일산화탄소 측정, 금연상담 및 음주 고글 체험", status: "확정" },
    { id: 15, category: "보건소 특화", name: "건강식습관 저염·저당 체험", scale: "1동", program: "염도계 시연, 가공식품 당류 함량 비교 전시", status: "확정" },
    { id: 16, category: "보건소 특화", name: "우리동네 건강코치", scale: "1동", program: "생활 속 건강관리 습관 형성을 위한 전문 코칭", status: "확정" },
    { id: 17, category: "보건소 특화", name: "마약류 오남용 예방 (약무팀)", scale: "1동", program: "마약류 위험성 홍보 및 안전한 의약품 폐기 안내", status: "확정" },
    { id: 18, category: "보건소 특화", name: "감염병 예방 (손씻기/진드기)", scale: "1동", program: "뷰박스 손씻기 체험 및 야외 진드기 기피제 배부", status: "확정" },
    { id: 19, category: "보건소 특화", name: "만성질환 예방관리 (강남도감)", scale: "1동", program: "고혈압·당뇨병 예방수칙 및 건강상식 퀴즈", status: "확정" },
    { id: 20, category: "구정 연계", name: "강남 메디컬투어센터 K-Culture", scale: "1동", program: "글로벌 의료관광 홍보 및 외국인 의료 프로그램 소개", status: "확정" }
  ],
  departmentsCooperation: [
    { dept: "치수과", task: "하천점용허가 승인 및 하천변 안전시설 사전 정비", status: "완료" },
    { dept: "공원녹지과", task: "다리 밑 전기 사용 허가 및 청소카트 2대 지원", status: "협의완료" },
    { dept: "주차관리과", task: "행사 당일 지정구역 행사차량 주차단속 유예", status: "협조요청예정" },
    { dept: "도시계획과", task: "양재천 교량 및 산책로 현수막 15일 게첨 승인", status: "협조요청예정" },
    { dept: "정책홍보실", task: "구청 홈페이지, SNS, 알림톡, 보도자료 배포", status: "기획중" },
    { dept: "자원순환과", task: "행사장 대형 쓰레기통 및 분리수거함 지원", status: "예정" },
    { dept: "의약과", task: "현장 의료부스 의사 배치 및 의료폐기물 수거통 지원", status: "확정" }
  ]
};

async function fetchYangjaeFestivalData(): Promise<FestivalData> {
  const res = await fetch('/api/festival/yangjae');
  if (!res.ok) {
    throw new Error('Failed to fetch festival data: ' + res.statusText);
  }
  const data = await res.json();
  if (data && data.meta) {
    return data;
  }
  return YANGJAE_FALLBACK_DATA;
}

export function useYangjaeFestival() {
  return useQuery<FestivalData>({
    queryKey: ['festival', 'yangjae'],
    queryFn: fetchYangjaeFestivalData,
    initialData: YANGJAE_FALLBACK_DATA,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
