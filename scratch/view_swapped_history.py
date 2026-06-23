import os

log_file = r"C:\Users\user\.gemini\antigravity\brain\c36768e1-c5d8-4c57-a408-37cc121ba020\.system_generated\logs\transcript_full.jsonl"
if os.path.exists(log_file):
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if '"source":"USER_EXPLICIT"' in line:
                print(line[:500])
else:
    print("Transcript not found")
