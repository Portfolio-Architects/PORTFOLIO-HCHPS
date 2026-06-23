import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"

print("Searching all transcripts for PDF file contents...")

for folder in os.listdir(brain_dir):
    folder_path = os.path.join(brain_dir, folder)
    if not os.path.isdir(folder_path):
        continue
    log_file = os.path.join(folder_path, ".system_generated", "logs", "transcript.jsonl")
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    obj = json.loads(line)
                    content = obj.get('content', '')
                    calls = str(obj.get('tool_calls', ''))
                    step_idx = obj.get('step_index')
                    
                    if '검진결과설명서.pdf' in calls or '검진결과설명서.pdf' in content:
                        # Print step details
                        print(f"=== Conv: {folder} | Step: {step_idx} | Type: {obj.get('type')} ===")
                        if obj.get('source') == 'SYSTEM':
                            print(content[:3000])
                            print("=" * 80)
                        elif obj.get('source') == 'MODEL':
                            print("Model calls:", calls[:500])
                            print("Model content:", content[:1000])
                            print("=" * 80)
        except Exception as e:
            pass
