import os

exclude_dirs = {'.git', '.agents', '.next', 'node_modules', 'out', 'build'}
files = []

for root, dirs, filenames in os.walk('.'):
    # modify dirs in-place to prune search
    dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
    for f in filenames:
        path = os.path.join(root, f)
        try:
            mtime = os.path.getmtime(path)
            files.append((path, mtime))
        except OSError:
            pass

files.sort(key=lambda x: x[1], reverse=True)
for path, mtime in files[:5]:
    print(os.path.abspath(path))
