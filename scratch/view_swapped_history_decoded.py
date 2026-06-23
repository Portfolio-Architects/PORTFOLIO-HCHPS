import os
import json
import sys

log_file = r"C:\Users\user\.gemini\antigravity\brain\c36768e1-c5d8-4c57-a408-37cc121ba020\.system_generated\logs\transcript_full.jsonl"
sys.stdout.reconfigure(encoding='utf-8')

if os.path.exists(log_file):
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            if obj.get("source") == "USER_EXPLICIT":
                content = obj.get("content", "")
                # Clean up xml tags
                if "<USER_REQUEST>" in content:
                    content = content.split("<USER_REQUEST>")[1].split("</USER_REQUEST>")[0].strip()
                print(f"Step {obj.get('step_index')}: {content}")
else:
    print("Transcript not found")
