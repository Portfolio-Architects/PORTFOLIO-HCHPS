import os

path1 = r"C:\Users\user\.gemini\antigravity\brain\05a6beb4-b68a-4abe-b884-18e2496bc40b\media__1781249084991.jpg"
path2 = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\media__1781247982080.jpg"

if os.path.exists(path1) and os.path.exists(path2):
    size1 = os.path.getsize(path1)
    size2 = os.path.getsize(path2)
    print(f"Size 1: {size1}, Size 2: {size2}")
    
    with open(path1, "rb") as f1, open(path2, "rb") as f2:
        content1 = f1.read()
        content2 = f2.read()
        print("Identical bytes:", content1 == content2)
else:
    print("One of the files not found")
