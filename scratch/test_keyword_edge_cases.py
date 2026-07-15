import sys
import os

# Dynamically import organize-files
import importlib.util
spec = importlib.util.spec_from_file_location("organize_files", "scratch/organize-files.py")
org = importlib.util.module_from_spec(spec)
spec.loader.exec_module(org)

def test_keywords():
    test_cases = [
        ("학교에서부터 걸어왔다.", ["학교에서부터", "걸어왔다"]),
        ("서울역에서부터 출발했다.", ["서울역에서부터", "출발했다"]),
    ]
    
    for text, expected in test_cases:
        keywords = org.extract_korean_keywords(text)
        print(f"Text: '{text}'")
        print(f"Extracted: {keywords}")
        print("-" * 40)

if __name__ == "__main__":
    test_keywords()
