import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"D:\Desktop\VITAL_Scan\4. 측정 데이터 입력서식(측정결과, 출석부, 만족도 조사)_출발마당.xlsx"

try:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb['사전사후측정결과(출석부 포함)']
    
    completed_rows = [13, 14, 15, 21, 23]
    
    print("====================================================================")
    print("■ 사전/사후 완수자 5인의 악력(체력) 지표 비교")
    print("====================================================================")
    
    for r in completed_rows:
        row = [sheet.cell(row=r, column=col_idx).value for col_idx in range(1, 140)]
        name = row[3] # Col D
        
        # Grip Strength (악력) - Col BV (74) and Col CM (91)
        # Relative Grip Strength (상대악력) - Col BW (75) and Col CN (92)
        pre_grip = row[73]
        post_grip = row[90]
        pre_rel = row[74]
        post_rel = row[91]
        
        print(f"[회원: {name}]")
        print(f"  - 악력(kg): 사전 {pre_grip} -> 사후 {post_grip} (변화: {f'{post_grip - pre_grip:+.2f}' if pre_grip is not None and post_grip is not None else '-'})")
        print(f"  - 상대악력(%): 사전 {pre_rel} -> 사후 {post_rel} (변화: {f'{post_rel - pre_rel:+.2f}' if pre_rel is not None and post_rel is not None else '-'})")
        
except Exception as e:
    print(f"Error: {e}")
