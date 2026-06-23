import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"D:\Desktop\VITAL_Scan\4. 측정 데이터 입력서식(측정결과, 출석부, 만족도 조사)_출발마당.xlsx"

try:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb['사전사후측정결과(출석부 포함)']
    
    completed_rows = [13, 14, 15, 21, 23]
    
    print("====================================================================")
    print("■ 사전/사후 완수자 5인의 PHQ-9(우울증 선별검사) 지표 비교")
    print("====================================================================")
    
    for r in completed_rows:
        row = [sheet.cell(row=r, column=col_idx).value for col_idx in range(1, 140)]
        name = row[3] # Col D
        
        # PHQ-9 - Col DN (118) and Col DX (128)
        pre_phq = row[117]
        post_phq = row[127]
        
        print(f"[회원: {name}]")
        print(f"  - PHQ-9 점수: 사전 {pre_phq} -> 사후 {post_phq} (변화: {f'{post_phq - pre_phq:+.2f}' if pre_phq is not None and post_phq is not None else '-'})")
        
except Exception as e:
    print(f"Error: {e}")
