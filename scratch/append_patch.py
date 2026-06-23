import os

report_path = 'PORTFOLIO VITAL - Engineering Report.md'

new_patch = """
### 통합 주간 일정 플래너 내 연속 일정 등록 및 기간 필터 렌더링 구현 패치 (2026-06-15)
* **스키마 및 타입 확장**: `src/types/index.ts`의 `Schedule` 인터페이스와 `src/lib/schemas.ts`의 `ScheduleSchema` Zod 정의에 선택적 종료일 필드인 `endDate?: string;`을 신설하여 기존 데이터와의 하위 호환성을 완벽히 보장했습니다.
* **연속 일정 입력 폼 UI 개발**: `WeeklyScheduler.tsx` 내에 "연속 일정으로 등록" 토글 체크박스를 도입하고, 활성화 시 종료 날짜(`endDate`)를 지정할 수 있는 입력 폼을 제공했습니다. 또한, 종료일이 시작일보다 이전인 경우에 대한 실시간 유효성 검증과 자동 동기화 보정 처리를 적용했습니다.
* **주간 그리드 멀티 렌더링 및 삭제 고도화**: 요일별 스케줄 필터링 함수(`getSchedulesForDay`)를 개선하여 단일 일치 검사에서 기간 범위 대조(`[date, endDate]`)로 확장해 기간에 속하는 모든 요일 칸에 해당 스케줄이 중복 노출되도록 구현했습니다. 일정 카드를 삭제할 경우 기간 전체가 한 번에 제거되도록 설계하여 사용자 편의성을 높였습니다.
"""

with open(report_path, 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.rfind('---')
if idx != -1:
    before = content[:idx]
    after = content[idx:]
    
    updated_content = before.rstrip() + "\n\n" + new_patch.strip() + "\n\n---\n" + after[3:].lstrip()
    
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    print("Successfully appended patch log using replace.")
else:
    print("Could not find --- in the file")


