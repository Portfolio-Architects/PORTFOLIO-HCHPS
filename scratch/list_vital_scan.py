import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

scan_dir = r"d:\Desktop\VITAL_Scan"
if os.path.exists(scan_dir):
    print(f"Files in {scan_dir}:")
    for root, dirs, files in os.walk(scan_dir):
        for file in files:
            print(f"  {os.path.join(root, file)} ({os.path.getsize(os.path.join(root, file))} bytes)")
else:
    print(f"Directory {scan_dir} does not exist.")
