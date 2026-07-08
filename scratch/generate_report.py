import win32com.client as win32
import os
import sys

def main():
    try:
        # 한글 객체 생성
        hwp = win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
        # 백그라운드 보안 팝업 차단을 방지하기 위해 창을 표시합니다.
        hwp.XHwpWindows.Item(0).Visible = True
        
        # 1. 새 문서 생성
        hwp.Run("FileNew")
        
        # 페이지 여백 설정 (위15, 아래15, 왼20, 오20, 머리15, 꼬리15)
        act = hwp.CreateAction("PageSetup")
        pset = act.CreateSet()
        act.GetDefault(pset)
        mset = pset.CreateItemSet("PageDef", "PageDef")
        mset.SetItem("TopMargin", int(15 * 283.465))
        mset.SetItem("BottomMargin", int(15 * 283.465))
        mset.SetItem("LeftMargin", int(20 * 283.465))
        mset.SetItem("RightMargin", int(20 * 283.465))
        mset.SetItem("HeaderMargin", int(15 * 283.465))
        mset.SetItem("FooterMargin", int(15 * 283.465))
        act.Execute(pset)
        
        # 글자 모양 설정 헬퍼
        def set_char_shape(font_name="한컴돋움", size=10, bold=False, italic=False, color=0):
            act_c = hwp.CreateAction("CharShape")
            pset_c = act_c.CreateSet()
            act_c.GetDefault(pset_c)
            pset_c.SetItem("FaceNameUser", font_name)
            pset_c.SetItem("FaceNameCommon", font_name)
            pset_c.SetItem("Height", hwp.PointToHwpUnit(size))
            pset_c.SetItem("Bold", 1 if bold else 0)
            pset_c.SetItem("Italic", 1 if italic else 0)
            pset_c.SetItem("Color", color)
            act_c.Execute(pset_c)

        # 문단 모양 설정 헬퍼
        def set_para_shape(align=0, line_spacing=160):
            # align: 0=왼쪽, 1=오른쪽, 2=가운데, 3=양쪽정렬
            act_p = hwp.CreateAction("ParagraphShape")
            pset_p = act_p.CreateSet()
            act_p.GetDefault(pset_p)
            pset_p.SetItem("AlignType", align)
            pset_p.SetItem("LineSpacing", line_spacing)
            act_p.Execute(pset_p)

        # 텍스트 삽입 헬퍼 (액션 기반)
        def insert_text(text):
            act_i = hwp.CreateAction("InsertText")
            pset_i = act_i.CreateSet()
            pset_i.SetItem("Text", text)
            act_i.Execute(pset_i)

        # 개행 및 텍스트 쓰기
        def write_line(text, size=10, bold=False, align=0, space=160, break_para=True):
            set_char_shape(size=size, bold=bold)
            set_para_shape(align=align, line_spacing=space)
            insert_text(text)
            if break_para:
                hwp.Run("BreakPara")

        # 2. 본문 작성
        write_line("", size=10)
        write_line("강남체력인증센터 체력측정 장비 도입방안 검토 보고", size=18, bold=True, align=2, space=200)
        write_line("=======================================================================================", size=10, align=2)
        write_line("□ 기 안 자: 보건행정과 주무관 오창선", size=10.5, bold=True, align=1)
        write_line("□ 협 조 자: 기획예산과장 서원희, 보건행정팀장 이민옥", size=10.5, bold=True, align=1)
        write_line("", size=10)

        # Ⅰ. 추진 배경 및 예산 현황
        write_line("Ⅰ. 추진 배경 및 예산 현황", size=14, bold=True, space=180)
        write_line("  1. 추진 배경", size=11, bold=True, space=160)
        write_line("    ○ 서울시 운영 지침(서울체력9988)에 따른 강남체력인증센터 맞춤형 KIOSK 체력측정 장비 도입 필요", size=10)
        write_line("    ○ 측정 결과의 정확성 및 스마트 연동 서비스를 위한 필수 검사 장비 6종 일괄 도입", size=10)
        write_line("  2. 예산 현황 및 부족액", size=11, bold=True, space=160)
        write_line("    ○ 강남체력인증센터 배정 예산(시 특별조정교부금) 중 현재 자산취득비 잔액: 약 11,000,000원", size=10)
        write_line("    ○ 도입 대상 장비 6종 전체 일괄 구매 견적액: 34,210,000원 (부가세 포함)", size=10)
        write_line("    ○ 예산 부족액: 금23,210,000원 (사무관리비 예산 전용을 통해 확보 추진)", size=10)
        write_line("", size=10)

        # Ⅱ. 도입 방안별 비교 검토
        write_line("Ⅱ. 도입 방안별 비교 검토", size=14, bold=True, space=180)
        write_line("", size=10)
        
        # 표 생성 (5행 3열)
        act_t = hwp.CreateAction("TableCreate")
        pset_t = act_t.CreateSet()
        act_t.GetDefault(pset_t)
        pset_t.SetItem("Rows", 5)
        pset_t.SetItem("Cols", 3)
        pset_t.SetItem("Treatment", 1) # 글자처럼 취급
        act_t.Execute(pset_t)
        
        # 표 내부 채우기 헬퍼
        def fill_cell(text, bold=False, align=0):
            set_char_shape(size=9.5, bold=bold)
            set_para_shape(align=align)
            lines = text.split('\n')
            for i, line in enumerate(lines):
                insert_text(line)
                if i < len(lines) - 1:
                    hwp.Run("BreakPara")
            hwp.Run("TableRightCell")

        # 1행: 헤더
        fill_cell("구분", bold=True, align=2)
        fill_cell("1안) 사무관리비 전용 후 전체 구매 (추천)", bold=True, align=2)
        fill_cell("2안) 일부 구매(1100만) + 잔여분 임대 혼합", bold=True, align=2)
        
        # 2행: 도입 방법
        fill_cell("도입 방법", bold=True, align=2)
        fill_cell("사무관리비 잔여 예산 2,321만원 전용 후 6종 전체 일시 구매", align=0)
        fill_cell("1,100만원 한도 내 일부 구매(2종) 및 나머지 4종 장비 임대(용역) 계약", align=0)
        
        # 3행: 도입 비용
        fill_cell("소요 비용\n(2년 기준)", bold=True, align=2)
        fill_cell("합계: 34,210,000원 (부가세 포함)\n※ 추가 운영비 소요 없음 (1년 무상 A/S)", align=0)
        fill_cell("합계: 약 32,560,000원\n- 구매비: 11,440,000원\n- 2년 임대료: 약 21,120,000원 (24개월 의무약정)", align=0)
        
        # 4행: 자산성
        fill_cell("자산성 및 경제성", bold=True, align=2)
        fill_cell("• 장비 소유권 구 영구 자산 등재\n• 내구연한(5~10년) 추가 비용 없음\n• 2년 가동 시 임대 대비 재무적 대폭 유리", align=0)
        fill_cell("• 2년 후 임차 장비 반납 (구 소유권 상실)\n• 2,112만원의 임차료는 전액 매몰비용화\n• 장기 사용 시 누적 임대료가 구매가 초과", align=0)
        
        # 5행: 행정 소요
        fill_cell("행정 및 관리", bold=True, align=2)
        fill_cell("• 초기 예산 전용 승인 및 1회 계약 완료\n• 유지보수 채널 단일화로 관리 용이", align=0)
        fill_cell("• 구매/임대 이중 계약으로 행정력 낭비\n• 매월 임대료 검수 및 지출결의(24회) 반복\n• 차년도 임대 예산 지속 반영 부담", align=0)
        
        # 표 밖으로 빠져나오기
        hwp.Run("Cancel")
        hwp.Run("MoveDown")
        write_line("", size=10)

        # Ⅲ. 1안(전체 구매) 추진의 타당성 및 상세 논리
        write_line("Ⅲ. 1안(전체 구매) 추진의 타당성 및 상세 논리", size=14, bold=True, space=180)
        write_line("  1. 임대 계약(2안)의 재정적 불합리성 탈피", size=11, bold=True, space=160)
        write_line("    ○ 임대 계약 시 특약사항('총 임대기간 24개월 이상 조건')에 의거, 2년간 강제 임차가 수반됨.", size=10)
        write_line("    ○ 이에 따라 발생하는 2,112만 원의 임차료는 소멸성 경비(매몰비용)이며, 2년 후 장비를 반납해야 함.", size=10)
        write_line("    ○ 단 165만 원의 예산 차이로 4종 장비의 소유권을 잃게 되는 결과를 초래하여 심각한 재정 낭비 발생.", size=10)
        
        write_line("  2. 예산 전용(사무관리비 → 자산취득비)의 타당성", size=11, bold=True, space=160)
        write_line("    ○ 관련 근거: 지방재정법 제49조(예산의 전용) 및 서울특별시 강남구 회계관리에 관한 규칙", size=10)
        write_line("    ○ 본 사업 예산은 100% 특별조정교부금으로, 정책사업 내 동일 비목 간 조정이므로 예산 총액 변동 없음.", size=10)
        write_line("    ○ 센터 운영 초기 불요불급한 소모품 및 홍보성 사무관리비를 절감하여 필수 자산을 취득하는 적법한 조치임.", size=10)
        
        write_line("  3. 행정 업무 능률화 및 사후관리 편리성", size=11, bold=True, space=160)
        write_line("    ○ 단일 제조사(시드테크)로부터 일괄 도입 시 측정 시스템 데이터 연동 보장 및 유지보수 창구 단일화.", size=10)
        write_line("    ○ 임대 시 발생할 매월 지출결의(24회) 등 행정 낭비를 방지하고 담당 주무관의 행정력 집중 도모.", size=10)
        write_line("", size=10)

        # Ⅳ. 행정사항 및 건의
        write_line("Ⅳ. 행정사항 및 건의", size=14, bold=True, space=180)
        write_line("  1. 건의 사항: 사무관리비 잔여 예산 중 금23,210,000원을 자산취득비로 전용하여 장비 6종 일괄 구매 추진", size=10)
        write_line("  2. 협조 부서: 기획예산과 (예산 간주처리 및 과목 전용 승인 협조)", size=10)
        write_line("  3. 향후 일정: 전용 승인 후 즉시 시드테크와 수의계약 체결 및 장비 납품 설치(계약 후 6주 내)", size=10)
        write_line("", size=10)
        
        # 3. 문서 저장
        target_path = r"d:\Desktop\강남체력인증센터 장비도입방안 검토보고.hwp"
        hwp.SaveAs(target_path)
        print(f"SUCCESS: Document saved at {target_path}")
        
        hwp.Quit()
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
