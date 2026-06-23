import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("All CSV and PDF files under C:\\Users\\user\\.gemini:")
for root, dirs, files in os.walk(r"C:\Users\user\.gemini"):
    for file in files:
        if file.lower().endswith('.csv') or file.lower().endswith('.pdf') or '체형' in file or '검진' in file:
            print(f"  [FILE] {os.path.join(root, file)} ({os.path.getsize(os.path.join(root, file))} bytes)")
