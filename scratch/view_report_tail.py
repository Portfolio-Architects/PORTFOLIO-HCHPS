import os

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\PORTFOLIO VITAL - Engineering Report.md"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\report_tail.txt"

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    tail_lines = lines[-150:] # last 150 lines
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(tail_lines)
        
    print(f"Tail saved to {output_path}")
    
except Exception as e:
    print(f"Error: {e}")
