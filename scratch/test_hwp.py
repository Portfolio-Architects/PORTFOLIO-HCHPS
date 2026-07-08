import win32com.client as win32
import sys

try:
    hwp = win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
    print("SUCCESS: HWP Object created.")
    hwp.Quit()
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
