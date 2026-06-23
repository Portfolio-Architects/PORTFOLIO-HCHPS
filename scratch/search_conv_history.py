import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\logs\transcript.jsonl"

print("Searching current conversation transcript...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과']

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        content = obj.get('content', '')
        calls = str(obj.get('tool_calls', ''))
        step_idx = obj.get('step_index')
        source = obj.get('source')
        type_ = obj.get('type')
        
        found = [kw for kw in keywords if kw in content or kw in calls]
        if found:
            # We want to print user requests or system command results that might have the raw text of the document
            if source == 'USER_EXPLICIT' or source == 'SYSTEM' or type_ == 'RUN_COMMAND':
                print(f"=== Step {step_idx} | Source: {source} | Type: {type_} | KWs: {found} ===")
                print(content[:1000])
                print("-" * 80)
            elif source == 'MODEL' and ('체중' in content or '혈압' in content or 'BMI' in content):
                # Also print model planning responses that might summarize or have the extracted text
                print(f"=== Step {step_idx} | Source: {source} | Type: {type_} | KWs: {found} ===")
                print(content[:1000])
                print("-" * 80)
