import os

def main():
    html_content = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
    body {
        font-family: "Malgun Gothic", "한컴돋움", sans-serif;
        line-height: 1.6;
        margin: 40px;
        color: #333333;
    }
    h1 {
        text-align: center;
        font-size: 20pt;
        font-weight: bold;
        margin-bottom: 5px;
    }
    .line {
        border-top: 2px double #000000;
        margin-bottom: 20px;
    }
    .meta-box {
        text-align: right;
        font-size: 11pt;
        font-weight: bold;
        margin-bottom: 30px;
    }
    h2 {
        font-size: 14pt;
        font-weight: bold;
        border-bottom: 1px solid #000000;
        padding-bottom: 5px;
        margin-top: 30px;
    }
    h3 {
        font-size: 11.5pt;
        font-weight: bold;
        margin-top: 15px;
        margin-bottom: 5px;
    }
    p {
        margin: 5px 0 5px 20px;
        font-size: 10.5pt;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        margin-bottom: 15px;
    }
    th, td {
        border: 1px solid #000000;
        padding: 8px;
        font-size: 9.5pt;
        vertical-align: middle;
    }
    th {
        background-color: #f2f2f2;
        text-align: center;
        font-weight: bold;
    }
    td.center {
        text-align: center;
    }
    .bold {
        font-weight: bold;
    }
    .recommend {
        color: blue;
        font-weight: bold;
    }
    .warning {
        color: red;
        font-weight: bold;
    }
</style>
</head>
<body>

<h1>강남체력인증센터 체력측정 장비 도입방안 검토 보고</h1>
<div class="line"></div>

<div class="meta-box">
    □ 기 안 자: 보건행정과 주무관 오창선<br>
    □ 협 조 자: 기획예산과장 서원희, 보건행정팀장 이민옥
</div>

<h2>Ⅰ. 추진 배경 및 예산 현황</h2>
<h3>1. 추진 배경</h3>
<p>○ 서울시 운영 지침(서울체력9988)에 따른 강남체력인증센터 맞춤형 KIOSK 체력측정 장비 도입 필요</p>
<p>○ 측정 결과의 정확성 및 스마트 연동 서비스를 위한 필수 검사 장비 6종 일괄 도입</p>

<h3>2. 예산 현황 및 부족액</h3>
<p>○ 강남체력인증센터 배정 예산(시 특별조정교부금) 중 현재 자산취득비 잔액: <strong>약 11,000,000원</strong></p>
<p>○ 도입 대상 장비 6종 전체 일괄 구매 견적액: <strong>34,210,000원</strong> (부가세 포함)</p>
<p>○ 예산 부족액: <strong>금23,210,000원</strong> (사무관리비 예산 전용을 통해 확보 추진)</p>

<h2>Ⅱ. 도입 방안별 비교 검토</h2>
<table>
    <thead>
        <tr>
            <th style="width: 15%;">구분</th>
            <th style="width: 42.5%;">1안) 사무관리비 전용 후 전체 구매 (추천)</th>
            <th style="width: 42.5%;">2안) 일부 구매(1100만) + 잔여분 임대 혼합</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="center bold">도입 방법</td>
            <td>사무관리비 잔여 예산 2,321만원 전용 후 6종 전체 일시 구매</td>
            <td>1,100만원 한도 내 일부 구매(2종) 및 나머지 4종 장비 임대(용역) 계약</td>
        </tr>
        <tr>
            <td class="center bold">소요 비용<br>(2년 기준)</td>
            <td class="recommend">합계: 34,210,000원 (부가세 포함)<br>※ 추가 운영비 소요 없음 (1년 무상 A/S)</td>
            <td class="warning">합계: 약 32,560,000원<br>- 구매비: 11,440,000원<br>- 2년 임대료: 약 21,120,000원 (24개월 의무약정)</td>
        </tr>
        <tr>
            <td class="center bold">자산성 및 경제성</td>
            <td>• 장비 소유권 구 영구 자산 등재<br>• 내구연한(5~10년) 추가 비용 없음<br>• 2년 가동 시 임대 대비 재무적 대폭 유리</td>
            <td>• 2년 후 임차 장비 반납 (구 소유권 상실)<br>• 2,112만원의 임차료는 전액 매몰비용화<br>• 장기 사용 시 누적 임대료가 구매가 초과</td>
        </tr>
        <tr>
            <td class="center bold">행정 및 관리</td>
            <td>• 초기 예산 전용 승인 및 1회 계약 완료<br>• 유지보수 채널 단일화로 관리 용이</td>
            <td>• 구매/임대 이중 계약으로 행정력 낭비<br>• 매월 임대료 검수 및 지출결의(24회) 반복<br>• 차년도 임대 예산 지속 반영 부담</td>
        </tr>
    </tbody>
</table>

<h2>Ⅲ. 1안(전체 구매) 추진의 타당성 및 상세 논리</h2>
<h3>1. 임대 계약(2안)의 재정적 불합리성 탈피</h3>
<p>○ 임대 계약 시 특약사항('총 임대기간 24개월 이상 조건')에 의거, 2년간 강제 임차가 수반됨.</p>
<p>○ 이에 따라 발생하는 2,112만 원의 임차료는 소멸성 경비(매몰비용)이며, 2년 후 장비를 반납해야 함.</p>
<p>○ 단 165만 원의 예산 차이로 4종 장비의 소유권을 잃게 되는 결과를 초래하여 심각한 재정 낭비 발생.</p>

<h3>2. 예산 전용(사무관리비 → 자산취득비)의 타당성</h3>
<p>○ 관련 근거: 지방재정법 제49조(예산의 전용) 및 서울특별시 강남구 회계관리에 관한 규칙</p>
<p>○ 본 사업 예산은 100% 특별조정교부금으로, 정책사업 내 동일 비목 간 조정이므로 예산 총액 변동 없음.</p>
<p>○ 센터 운영 초기 불요불급한 소모품 및 홍보성 사무관리비를 절감하여 필수 자산을 취득하는 적법한 조치임.</p>

<h3>3. 행정 업무 능률화 및 사후관리 편리성</h3>
<p>○ 단일 제조사(시드테크)로부터 일괄 도입 시 측정 시스템 데이터 연동 보장 및 유지보수 창구 단일화.</p>
<p>○ 임대 시 발생할 매월 지출결의(24회) 등 행정 낭비를 방지하고 담당 주무관의 행정력 집중 도모.</p>

<h2>Ⅳ. 행정사항 및 건의</h2>
<p>1. 건의 사항: 사무관리비 잔여 예산 중 금23,210,000원을 자산취득비로 전용하여 장비 6종 일괄 구매 추진</p>
<p>2. 협조 부서: 기획예산과 (예산 간주처리 및 과목 전용 승인 협조)</p>
<p>3. 향후 일정: 전용 승인 후 즉시 시드테크와 수의계약 체결 및 장비 납품 설치(계약 후 6주 내)</p>

</body>
</html>
"""
    target_path = r"d:\Desktop\강남체력인증센터 장비도입방안 검토보고.hwp"
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"SUCCESS: Document saved at {target_path}")

if __name__ == "__main__":
    main()
