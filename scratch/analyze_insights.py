import sys
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"D:\Desktop\VITAL_Scan\4. 측정 데이터 입력서식(측정결과, 출석부, 만족도 조사)_출발마당.xlsx"

try:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb['사전사후측정결과(출석부 포함)']
    
    # Let's inspect rows 13, 14, 15, 21, 23 (these correspond to the 5 members who have post-data)
    completed_rows = [13, 14, 15, 21, 23]
    
    print("====================================================================")
    print("■ 사전/사후 완수자 5인의 상세 건강 지표 비교 (측정서 원본 데이터)")
    print("====================================================================")
    
    for r in completed_rows:
        row = [sheet.cell(row=r, column=col_idx).value for col_idx in range(1, 140)]
        name = row[3] # Col D
        age = row[5] # Col F
        
        # Physical Composition
        pre_w, post_w = row[7], row[13] # Col H, N
        pre_m, post_m = row[8], row[14] # Col I, O
        pre_f, post_f = row[9], row[15] # Col J, P
        pre_bmi, post_bmi = row[10], row[16] # Col K, Q
        pre_waist, post_waist = row[11], row[17] # Col L, R
        
        # GPAQ (Physical Activity MET-minutes/week)
        # Col AO is 41 (pre_gpaq), Col BO is 67 (post_gpaq)
        pre_gpaq, post_gpaq = row[40], row[66] 
        # GPAQ Sedentary time (Col AM is 39, Col BM is 65)
        pre_sedentary, post_sedentary = row[38], row[64]
        
        # Blood pressure / Glucose / Metabolic (if any)
        # Col DD (108) / Col DI (113) - Blood Pressure
        # Col DF (110) / Col DK (115) - Fasting Glucose
        pre_bp, post_bp = row[107], row[112]
        pre_gl, post_gl = row[109], row[114]
        
        print(f"\n[회원: {name} (만 {age}세)]")
        print("-" * 50)
        print(f"1) 체격/신체조성:")
        print(f"   - 체중: {pre_w:.1f}kg -> {post_w:.1f}kg ({post_w - pre_w:+.1f}kg)")
        print(f"   - 골격근량: {pre_m:.1f}kg -> {post_m:.1f}kg ({post_m - pre_m:+.1f}kg)")
        print(f"   - 체지방률: {pre_f:.1f}% -> {post_f:.1f}% ({post_f - pre_f:+.1f}%)")
        if pre_waist and post_waist:
            print(f"   - 허리둘레: {pre_waist:.1f}cm -> {post_waist:.1f}cm ({post_waist - pre_waist:+.1f}cm)")
        else:
            print(f"   - 허리둘레: 사전 {pre_waist} / 사후 {post_waist}")
            
        print(f"2) 신체활동(GPAQ):")
        if pre_gpaq is not None or post_gpaq is not None:
            pre_g_val = float(pre_gpaq) if pre_gpaq else 0.0
            post_g_val = float(post_gpaq) if post_gpaq else 0.0
            print(f"   - 총 신체활동량: {pre_g_val:.1f} MET-min/주 -> {post_g_val:.1f} MET-min/주 ({post_g_val - pre_g_val:+.1f} MET-min/주)")
        else:
            print(f"   - 총 신체활동량: 사전 {pre_gpaq} / 사후 {post_gpaq}")
            
        if pre_sedentary is not None or post_sedentary is not None:
            print(f"   - 일평균 좌식 시간: {pre_sedentary}분 -> {post_sedentary}분")
            
        print(f"3) 임상/체력 지표:")
        if pre_bp or post_bp:
            print(f"   - 혈압: {pre_bp} -> {post_bp}")
        if pre_gl or post_gl:
            print(f"   - 공복혈당: {pre_gl} -> {post_gl}")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
