report_path = 'PORTFOLIO VITAL - Engineering Report.md'

with open(report_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 이전 패치 기록 찾아서 교체
old_patch_title = "### 실무 사업운영 연락처 엑셀 데이터 파싱 및 E2EE 보안 데이터베이스 병합 패치 (2026-06-15)"
new_patch = """
### 실무 사업운영 연락처 엑셀 데이터 파싱 및 E2EE 보안 데이터베이스 병합 패치 (2026-06-15)
* **전체 시트 대상 연락처 추출**: 이전에 누락되었던 `사업운영`, `기부관련`, `양재천 행사관련` 시트를 포함하여 감사패관련, 건강증진지원실, 어린이 성장발달 시스템, 지역사회건강조사 조사원, 자문협력, 면접위원 등 총 9개 시트를 대상으로 하는 정밀 파서(`parse_contacts_excel.py`)를 개발 및 실행하여 113개의 실무 연락처 데이터를 완전히 추출했습니다. (계정 정보가 적혀 있는 '업무관련 아이디 비번' 시트는 개인정보보호를 위해 제외)
* **E2EE 암호화 병합 및 무결성 적재**: PIN `'0509'`와 `AES-GCM` 알고리즘을 사용한 Node.js 병합 스크립트(`merge_contacts_e2ee.js`)를 통해 기존 `data/CONTACTS.json` 내의 17개 연락처와 엑셀의 113개 연락처를 병합(총 125개)하고 암호화하여 저장했습니다. 이름 및 전화번호 정규화 대조를 통해 중복을 제거하고, 메모(`notes`)와 이메일(`email`) 등의 정보는 융합하여 보존했습니다.
"""

idx = content.find(old_patch_title)
if idx != -1:
    # 다음 '---'를 찾아서 그 부분까지 교체
    next_sep = content.find('---', idx)
    if next_sep != -1:
        updated_content = content[:idx] + new_patch.strip() + "\n\n" + content[next_sep:]
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print("Successfully updated patch log in report.")
    else:
        print("Could not find separator after patch title.")
else:
    print("Could not find patch title to update.")
