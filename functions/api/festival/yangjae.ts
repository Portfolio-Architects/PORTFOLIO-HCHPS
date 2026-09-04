/**
 * Cloudflare Pages Function — 2026 Yangjae Festival 24/7 Read-Only Replica API
 * 
 * GET  /api/festival/yangjae → 24시간 상시 최신 페스티벌 데이터 반환 (KV 우선, 부재 시 기본값)
 * POST /api/festival/yangjae → 로컬 PC(SSOT)에서 최신 데이터를 클라우드로 듀얼 싱크(Dual-Sync) 발행
 */

interface Env {
  HCHPS_DATA: KVNamespace;
  HCHPS_AUTH_TOKEN?: string;
}

const KV_KEY = 'festival:yangjae:2026';

function getCorsHeaders(request: Request): Record<string, string> {
  let allowedOrigin = '*';
  const origin = request.headers.get('Origin') || '';
  if (
    origin === 'http://localhost:3001' ||
    origin === 'http://127.0.0.1:3001' ||
    origin.endsWith('.trycloudflare.com') ||
    origin === 'https://portfolio-hchps.pages.dev' ||
    origin === 'https://portfolio-architects.github.io'
  ) {
    allowedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-Sync-Source',
  };
}

function jsonResponse(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...getCorsHeaders(request),
    },
  });
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    headers: getCorsHeaders(context.request),
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (context.env && context.env.HCHPS_DATA) {
      const raw = await context.env.HCHPS_DATA.get(KV_KEY, { cacheTtl: 0 });
      if (raw) {
        const parsed = JSON.parse(raw);
        return jsonResponse(context.request, parsed, 200);
      }
    }
    // Fallback if KV not yet populated
    return jsonResponse(context.request, FALLBACK_FESTIVAL_DATA, 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/festival/yangjae] GET error:', err);
    return jsonResponse(context.request, FALLBACK_FESTIVAL_DATA, 200);
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Only local PC (SSOT) is authorized to update the 24/7 Read-Only Replica
    const authHeader = context.request.headers.get('Authorization');
    const syncSource = context.request.headers.get('X-Sync-Source');
    const expectedToken = context.env.HCHPS_AUTH_TOKEN;

    if (expectedToken) {
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      if (token !== expectedToken && syncSource !== 'local-ssot-dual-sync') {
        return jsonResponse(context.request, { success: false, error: 'Unauthorized: Read-only replica' }, 401);
      }
    }

    const payload = await context.request.json() as { meta?: { title?: string } };
    if (!payload || !payload.meta) {
      return jsonResponse(context.request, { success: false, error: 'Invalid payload structure' }, 400);
    }

    if (context.env && context.env.HCHPS_DATA) {
      await context.env.HCHPS_DATA.put(KV_KEY, JSON.stringify(payload));
    }

    return jsonResponse(context.request, {
      success: true,
      publishedAt: new Date().toISOString(),
      source: 'local-ssot',
    }, 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/festival/yangjae] POST error:', err);
    return jsonResponse(context.request, { success: false, error: 'Failed to publish to replica' }, 500);
  }
};

const FALLBACK_FESTIVAL_DATA = {
  "meta": {
    "title": "2026 양재천 걷자! 건강 페스티벌",
    "shortTitle": "2026 양재천 건강 페스티벌",
    "eventDate": "2026-10-31(토)",
    "eventTime": "09:00 ~ 14:00",
    "location": "양재천 수변문화쉼터 및 출발마당 (개포동 1279 일원)",
    "course": "수변문화쉼터 ↔ 영동5교 왕복 (약 4km)",
    "targetAudience": "강남구민 800명 (사전 접수)",
    "programStructure": [
      "건강 걷기 체험 프로그램(4km)",
      "의료 및 건강 관련 체험·홍보 부스 운영"
    ],
    "staffNote": "행사 참여 직원 대체휴무 시행 예정",
    "organizer": "강남구보건소 보건행정과 건강증진팀",
    "overallProgress": 65,
    "lastUpdated": "2026-09-04"
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
      "1. [홍보] 행사 포스터 시안 제작 및 대구민 홍보 채널 구축 진행중 (지영팀장님, 오창선)\n   - 내용: 메인 포스터 디자인 감수 및 구청·보건소 홈페이지 배너·통합예약 연계 준비",
      "2. [기획/회의] 9. 1. 행사 추진 총괄 및 현안 실무회의 완료\n   - 참석: 과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선\n   - 안건: 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법(800명), 보도자료 배포 등",
      "3. [장소/현장] 9. 2. 양재천 현장답사 및 유관기관 합동점검 실시\n   - 참석: 지영팀장님, 오창선, 유디치과 관계자\n   - 내용: 유디치과 이동 검진버스 진입 동선 및 건강체험 추가 부스 설치 구역 현장 실측",
      "4. [의전] 구청장님 행사 참석 관련 구청 비서실 사전 협의 완료\n   - 내용: 행사 개회식 및 걷기대회 구청장님 참석 확정 조율 (지영팀장님)",
      "5. [부스] 9. 3. 유관 의료단체(강남구의사회·한의사회) 부스 운영 협조 회의\n   - 참석: 과장님, 오창선\n   - 내용: 전문 의료진 건강상담 부스 운영 확정 및 세부 프로그램 운영안 협의 조율중"
    ]
  },
  "milestones": [
    {
      "id": 1,
      "number": "추진과제 1",
      "title": "장소 및 일시 확정",
      "status": "in-progress",
      "period": "7월 말 ~ 8.31. (완료)",
      "cooperationDepts": [
        "건설관리과(부지 소유자)",
        "공원녹지과",
        "치수과",
        "문화도시과"
      ],
      "details": [
        "[완료][26.7.29.][참여:오창선] 사전답사 1 : 행사장소 '수변문화쉼터' 검토",
        "[완료][26.8.11.][참여:과장님, 지영팀장님, 서승오, 오창선] 사전답사 2 :걷기 코스 및 장소 확정",
        "[완료][26.8.13.][참여:지영팀장님, 오창선, 제이민(대행사)] 대행사 현장 미팅 1 : 제이민(여성기업)",
        "[완료][26.8.19.][참여:과장님, 지영팀장님, 오창선, 제이민(대행사)] 대행사 현장 미팅 2 : 세부 운영안 조율",
        "[완료][26.8.27.][참여:보건행정과-10515] [허가완료] 건설관리과: 행사장소 하천점용허가 신청 및 승인 완료 (개포동 1279 일원)",
        "[완료][26.9.1.][참여:과장님, 희선팀장님, 지영팀장님, 임석훤, 남상희, 오창선] 내부 회의 : 행사 추진 관련 전반, VIP 초청, 참가자 모집 방법, 보도자료 등 안건 협의",
        "[완료][26.9.3.][참여:보건행정과-10992] [협조완료] 공원녹지과: 출발마당(포이공원) 장소 및 전기 사용, 볼라드 개폐",
        "[예정][9.7.(월)] 전 부서 행사 알림 : 행사 포스터 시안 확정 이후",
        "[예정] 장소 사용 협조 진행 여부 : 수변문화센터 외부 소관 치수과, 내부 소관 문화도시과 "
      ]
    },
    {
      "id": 2,
      "number": "추진과제 2",
      "title": "행사 식순",
      "status": "in-progress",
      "period": "8.18. ~ 9월 4주",
      "cooperationDepts": [],
      "details": [
        "[완료][26.8.18.] 식순 초안 작성 : 보건행정과 내부 검토",
        "[완료][26.8.28.] 식순 2차안 작성 : 개회식 단축, 스트레칭 연계",
        "[완료][26.9.4.] 식순 3차 확정안 반영 : 09:30 식전공연, 10:00 개회식(내빈소개/축사), 10:20 몸풀기체조, 10:30 걷기 출발, 12:00 완보 및 경품추첨, 13:00 부스체험 및 폐회"
      ]
    },
    {
      "id": 3,
      "number": "추진과제 3",
      "title": "부스 운영",
      "status": "in-progress",
      "period": "8.11. ~ 9월 4주",
      "cooperationDepts": [],
      "details": [
        "[완료][8.11.] 1차 부스 목록 선정 : 8개 부스(의료 5, 홍보 3)",
        "[완료][8.20.] 2차 부스 모집 : 외부 참여기관(유디치과, 차병원 등) 섭외 완료",
        "[완료][8.25.] 3차 부스 운영안 확정 : 총 9개 부스(전문 의료·검진 5, 민간 헬스케어 2, 보건소 사업 2)",
        "[진행][9.3.] 부스별 세부 프로그램 및 필요 물품(책상, 전력 등) 최종 취합 중"
      ]
    },
    {
      "id": 4,
      "number": "추진과제 4",
      "title": "홍보 계획",
      "status": "in-progress",
      "period": "8.25. ~ 10월 2주",
      "cooperationDepts": [
        "홍보실"
      ],
      "details": [
        "[완료][8.25.] 홍보 기본 계획 수립 : 온라인(구청 홈페이지, SNS) 및 오프라인(현수막, 포스터)",
        "[진행][9.4.] 행사 포스터 시안 디자인 감수 및 인쇄 준비",
        "[예정][9.15.] 구민 사전 참가 접수(800명) 개시 및 보도자료 배포"
      ]
    },
    {
      "id": 5,
      "number": "추진과제 5",
      "title": "방침 및 계약",
      "status": "todo",
      "period": "9월 1주 ~ 9월 3주",
      "cooperationDepts": [],
      "details": [
        "[진행] 행사 방침서 작성 중..."
      ]
    },
    {
      "id": 6,
      "number": "추진과제 6",
      "title": "VIP 초청 관련",
      "status": "in-progress",
      "period": "9월 1주 ~ 10월 3주",
      "cooperationDepts": [
        "비서실"
      ],
      "details": [
        "[완료][9.3.][참여:지영팀장님] 구청장님 참석 비서실 협의: 참석 확정",
        "[예정] 의원 VIP 초청 진행 예정 : ",
        "[예정][참여:오창선] 남부혈액원 주차 5대 협조 공문 발송: "
      ]
    },
    {
      "id": 7,
      "number": "추진과제 7",
      "title": "안전관리",
      "status": "todo",
      "period": "",
      "cooperationDepts": [],
      "details": []
    },
    {
      "id": 8,
      "number": "추진과제 8",
      "title": "기타사항",
      "status": "todo",
      "period": "",
      "cooperationDepts": [],
      "details": [
        "[예정][참여:과장님] 개포현대2단지 아파트 입주자 대표회 : 행사 알림"
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
      "program": "내 신체나이 알아보기, 『리얼피티 프로 플러스』 40초 바른자세·체형 분석 및 운동처방",
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
      "program": "내 신체나이 알아보기, 서울체력장 인증 체력측정 (성인: 2분제자리걷기/악력, 시니어: 의자일어서기 등)",
      "status": "확정"
    }
  ]
};
