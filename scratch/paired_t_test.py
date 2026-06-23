import sys
import openpyxl
import math

sys.stdout.reconfigure(encoding='utf-8')

# We can use scipy if available, or write the math manually.
# Writing manually is 100% reliable and independent of installed packages.

def calculate_paired_t_test(pre_list, post_list):
    n = len(pre_list)
    if n < 2:
        return None, None, None, None, None
        
    diffs = [post - pre for pre, post in zip(pre_list, post_list)]
    mean_diff = sum(diffs) / n
    
    # Standard deviation of differences
    sq_diff_sum = sum((d - mean_diff) ** 2 for d in diffs)
    std_dev = math.sqrt(sq_diff_sum / (n - 1))
    
    # Standard error
    std_err = std_dev / math.sqrt(n)
    
    # T-statistic
    if std_err == 0:
        t_stat = 0.0
    else:
        t_stat = mean_diff / std_err
        
    # Approximation of p-value for df = 4 (Student's t-distribution)
    # df = 4: critical t-values:
    # t=1.53 -> p=0.20, t=2.13 -> p=0.10, t=2.776 -> p=0.05, t=3.747 -> p=0.02, t=4.604 -> p=0.01, t=8.61 -> p=0.001
    
    # Let's write a simple integrator or a lookup function for df=4 t-distribution
    # For df=4, the CDF of t is:
    # F(t) = 1/2 + 3/8 * (t / sqrt(t^2 + 4)) * (1 - t^2 / (3*(t^2 + 4))) # wait, this is not standard.
    # Let's use standard student-t CDF for df=4:
    # F(t) = 0.5 + (1 / (2 * math.pi)) * (theta + sin(theta) * cos(theta)) where theta = arctan(t / sqrt(df))
    # For df=4: theta = arctan(t / 2)
    # F(t) = 0.5 + (1 / math.pi) * (theta + sin(theta) * cos(theta)) is for df=2?
    # Actually, for df=4, standard analytical formula:
    # x = t / sqrt(t^2 + 4)
    # F(t) = 0.5 + 0.5 * (x + 0.5 * x * (1 - x^2))
    # Let's verify: if t=0, x=0 -> F(t)=0.5 (Correct)
    # If t -> infinity, x=1 -> F(t) = 0.5 + 0.5 * (1 + 0.5 * 0) = 1.0 (Correct)
    # Let's check t = 2.776 (p=0.05 two-tailed, so F(t)=0.975)
    # t^2 = 7.706 -> t^2 + 4 = 11.706 -> x = 2.776 / sqrt(11.706) = 2.776 / 3.421 = 0.811
    # F(t) = 0.5 + 0.5 * (0.811 + 0.5 * 0.811 * (1 - 0.658)) = 0.5 + 0.5 * (0.811 + 0.4055 * 0.342) = 0.5 + 0.5 * (0.811 + 0.138) = 0.5 + 0.5 * 0.949 = 0.9745 (Very close to 0.975!)
    # This formula is extremely accurate for df=4!
    
    t_abs = abs(t_stat)
    x = t_abs / math.sqrt(t_abs**2 + 4)
    p_val = 2.0 * (1.0 - (0.5 + 0.5 * (x + 0.5 * x * (1.0 - x**2))))
    
    return mean_diff, std_dev, std_err, t_stat, p_val

file_path = r"D:\Desktop\VITAL_Scan\4. 측정 데이터 입력서식(측정결과, 출석부, 만족도 조사)_출발마당.xlsx"

try:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb['사전사후측정결과(출석부 포함)']
    completed_rows = [13, 14, 15, 21, 23]
    
    data = {
        'Weight': ([], []),
        'Muscle': ([], []),
        'Fat': ([], []),
        'Waist': ([], []),
        'GPAQ': ([], [])
    }
    
    for r in completed_rows:
        row = [sheet.cell(row=r, column=col_idx).value for col_idx in range(1, 140)]
        
        # Parse metrics
        w_pre, w_post = row[7], row[13]
        m_pre, m_post = row[8], row[14]
        f_pre, f_post = row[9], row[15]
        waist_pre, waist_post = row[11], row[17]
        gpaq_pre = float(row[40]) if row[40] is not None else 0.0
        gpaq_post = float(row[66]) if row[66] is not None else 0.0
        
        if w_pre is not None and w_post is not None:
            data['Weight'][0].append(float(w_pre))
            data['Weight'][1].append(float(w_post))
            
        if m_pre is not None and m_post is not None:
            data['Muscle'][0].append(float(m_pre))
            data['Muscle'][1].append(float(m_post))
            
        if f_pre is not None and f_post is not None:
            data['Fat'][0].append(float(f_pre))
            data['Fat'][1].append(float(f_post))
            
        if waist_pre is not None and waist_post is not None:
            data['Waist'][0].append(float(waist_pre))
            data['Waist'][1].append(float(waist_post))
            
        data['GPAQ'][0].append(gpaq_pre)
        data['GPAQ'][1].append(gpaq_post)
        
    print("==========================================================================================")
    print("■ 사전/사후 신체지표 변화에 대한 대응표본 t-검정 (Paired t-test) 결과 (N = 5, df = 4)")
    print("==========================================================================================")
    print(f"{'평가 지표':<15}{'사전 평균':<12}{'사후 평균':<12}{'평균 변화량':<12}{'표준편차(diff)':<15}{'t-통계량':<12}{'p-value':<12}{'유의성 (p < 0.05)':<15}")
    print("-" * 105)
    
    for metric, (pre_vals, post_vals) in data.items():
        avg_pre = sum(pre_vals) / len(pre_vals)
        avg_post = sum(post_vals) / len(post_vals)
        mean_diff, std_dev, std_err, t_stat, p_val = calculate_paired_t_test(pre_vals, post_vals)
        
        sig_str = "유의함 (Significant)" if p_val is not None and p_val < 0.05 else "유의하지 않음"
        
        p_val_str = f"{p_val:.4f}" if p_val is not None else "N/A"
        t_stat_str = f"{t_stat:+.3f}" if t_stat is not None else "N/A"
        mean_diff_str = f"{mean_diff:+.2f}"
        
        print(f"{metric:<15}{avg_pre:<15.2f}{avg_post:<15.2f}{mean_diff_str:<15}{std_dev:<15.4f}{t_stat_str:<12}{p_val_str:<12}{sig_str:<15}")
    print("==========================================================================================")
    
except Exception as e:
    print(f"Error: {e}")
