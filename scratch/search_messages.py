import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
messages_dir = r"C:\Users\user\.gemini\antigravity\brain\5d855805-4f15-491f-ad73-2701c6b1a755\.system_generated\messages"

print("Searching message JSON files for clinical terms...")

keywords = ['체질량지수', 'CVA', '머리척추각', '수축기', '이완기', '체형불균형', '검진결과']

for filename in os.listdir(messages_dir):
    if not filename.endswith('.json') or filename == 'cursor.json' or filename == 'read.json':
        continue
    filepath = os.path.join(messages_dir, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Try to see if any keyword is in this message content
            found = [kw for kw in keywords if kw in content]
            if found:
                print(f"=== Message File: {filename} | KWs: {found} ===")
                try:
                    obj = json.loads(content)
                    # Let's inspect the keys and content
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            val_str = str(v)
                            matched_kws = [kw for kw in keywords if kw in val_str]
                            if matched_kws:
                                print(f"Key '{k}' contains keywords: {matched_kws}")
                                print("Value snippet:")
                                print(val_str[:1500])
                                print("-" * 40)
                    else:
                        print("List content snippet:")
                        print(str(obj)[:1500])
                except Exception as e:
                    print("Could not load as JSON, raw snippet:")
                    print(content[:1500])
                print("=" * 80)
    except Exception as e:
        print(f"Error reading {filename}: {e}")
