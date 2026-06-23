import os

report_path = 'PORTFOLIO VITAL - Engineering Report.md'

with open(report_path, 'r', encoding='utf-8') as f:
    content = f.read()

target_str = "### AI 메디스포츠 센터 탑다운 뷰 조감도 배치 정합성 교정 패치 (2026-06-11)"

idx = content.find(target_str)
if idx != -1:
    end_idx = content.find('---', idx)
    if end_idx != -1:
        new_entry = """### AI 메디스포츠 센터 탑다운 뷰 조감도 배치 정합성 교정 패치 (2026-06-11)
* **탑다운 뷰(평면도) 배치 및 전체 구도 정밀 정합**: 탑다운 뷰 투영 시 외곽 경계부가 잘리지 않고 600㎡ 전체 면적이 온전히 포함되도록 줌 아웃(Zoom Out)하여 시설 전체 레이아웃을 화각 중심부에 정방형 정렬(direct 2D orthographic plan view)하고, 16:9 와이드 비율 크롭 시에도 모든 기능 영역이 잘림 없이 담기도록 조감도(`medi_sports_true_topdown_ortho_1781149570754.png`)를 재생성했습니다.
* **16:9 와이드스크린 크롭 및 1080p 업스케일 자동화**: `crop_wide.py` 스크립트를 구동하여 생성된 1024x1024 raw 이미지를 16:9 가로형(1024x576)으로 종횡비를 맞춘 뒤 Lanczos 필터를 사용해 1920x1080 픽셀로 고해상도 변환하여 바탕화면에 저장했습니다.
* **한글 파일명 Windows 인코딩 이슈 해소**: Python의 Windows CP949 인코딩에 의해 mangled 되던 파일명을 Unicode renaming 코드를 구동하여 바탕화면에 `AI 스포츠_메디컬_트레이닝 센터_탑다운뷰_1920x1080.png`라는 깔끔한 한국어 파일명으로 성공적으로 안착시켰습니다.

"""
        updated_content = content[:idx] + new_entry + content[end_idx:]
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print("Successfully updated the patch entry in the report.")
    else:
        print("Could not find the end of the entry (---)")
else:
    print("Could not find the target entry in the report")
