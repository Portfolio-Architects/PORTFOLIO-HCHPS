import os
from PIL import Image

uploaded_in_brain = r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614\media__1781252444253.jpg"
uploaded_in_workspace = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\scratch_uploaded.png"

# Copy from brain to workspace scratch_uploaded.png to ensure it's the latest
if os.path.exists(uploaded_in_brain):
    img = Image.open(uploaded_in_brain)
    img.save(uploaded_in_workspace)
    print("Copied uploaded image from brain to workspace scratch_uploaded.png. Size:", img.size)
else:
    print("Uploaded image not found in brain!")
