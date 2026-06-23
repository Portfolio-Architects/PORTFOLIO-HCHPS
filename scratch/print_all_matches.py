import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
brain_dir = r"C:\Users\user\.gemini\antigravity\brain"
output_file = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\all_convs_matches.txt"

keywords = ['김광숙', '체질량지수', 'CVA', '머리척추각', '수축기', '이완기']

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("Searching all conversations transcripts for keywords...\n")
    for folder in os.listdir(brain_dir):
        folder_path = os.path.join(brain_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        # Also check all files inside this folder, not just transcript.jsonl
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.endswith('.jsonl') or file.endswith('.json') or file.endswith('.md') or file.endswith('.txt'):
                    path = os.path.join(root, file)
                    try:
                        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                            text = f.read()
                            found = [kw for kw in keywords if kw in text]
                            if len(found) >= 3:
                                out.write(f"\n=========================================\n")
                                out.write(f"FILE: {path} | Matches: {found}\n")
                                out.write(f"=========================================\n")
                                # Write first 4000 characters of the file content
                                out.write(text[:4000])
                                out.write("\n... [TRUNCATED] ...\n" if len(text) > 4000 else "\n")
                    except Exception as e:
                        out.write(f"Error reading {path}: {e}\n")

print("Completed. Output written to scratch/all_convs_matches.txt")
