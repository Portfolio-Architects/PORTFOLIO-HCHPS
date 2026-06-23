import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

brain_dir = r"C:\Users\user\.gemini\antigravity\brain"
print("Conversations:")
for folder in os.listdir(brain_dir):
    folder_path = os.path.join(brain_dir, folder)
    if os.path.isdir(folder_path):
        # Print size and modified time
        mtime = os.path.getmtime(folder_path)
        print(f"  {folder} (mtime: {mtime})")
