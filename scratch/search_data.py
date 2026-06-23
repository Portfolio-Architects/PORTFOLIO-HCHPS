import os
import json

data_dir = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\data"
output_path = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch\wiki_raw_inspect.txt"

# Let's inspect the files that had matches in the previous search
target_files = [
    "WIKI_DOC_custom-1775796286144.json",
    "WIKI_DOC_root-HCHPS.json",
    "WIKI_DOC_custom-1777279481151.json",
    "WIKI_DOC_custom-1775785898357.json"
]

results = []

for filename in target_files:
    filepath = os.path.join(data_dir, filename)
    if not os.path.exists(filepath):
        continue
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            results.append(f"=== File: {filename} ===")
            # Pretty print first few levels
            results.append(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
            results.append("=" * 80)
    except Exception as e:
        results.append(f"Error reading {filename}: {e}")

with open(output_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(results))

print(f"Inspection complete. Saved to {output_path}")
