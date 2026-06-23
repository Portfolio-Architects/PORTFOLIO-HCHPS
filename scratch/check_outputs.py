import os

paths = [
    r"D:\Desktop\AI 스포츠_메디컬_트레이닝 센터_45도 사선구도_실사진_현판_모던_1920x1080.png",
    r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614\AI_sports_medical_center_signboards_modern_close.png",
    r"C:\Users\user\.gemini\antigravity\brain\bdfeb9bb-6a3d-46bf-9590-3d6351385614\media__1781252444253.jpg"
]

for p in paths:
    print(f"Path: {p} | Exists: {os.path.exists(p)} | Size: {os.path.getsize(p) if os.path.exists(p) else 0}")
