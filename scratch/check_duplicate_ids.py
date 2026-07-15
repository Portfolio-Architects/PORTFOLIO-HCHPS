import os, zipfile
from collections import Counter
import re

desktop = 'd:/Desktop'
files = os.listdir(desktop)
template_path = next((os.path.join(desktop, f) for f in files if f.endswith('.bak') and '복사본' not in f and '계획.hwpx' in f), None)

zt = zipfile.ZipFile(template_path, 'r')
g_xml = zt.read('Contents/section0.xml').decode('utf-8')

p_ids = re.findall(r'<hp:p[^>]*id="([^"]+)"', g_xml)
print(f'Total <hp:p> tags with id: {len(p_ids)}')
counts = Counter(p_ids)
duplicates = {k: v for k, v in counts.items() if v > 1}
if duplicates:
    print('FOUND DUPLICATE hp:p IDs!')
    print(duplicates)
else:
    print('No duplicate hp:p IDs.')
