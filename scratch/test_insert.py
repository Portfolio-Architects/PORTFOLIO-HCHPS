import win32com.client as win32
import os
import sys

def main():
    try:
        hwp = win32.gencache.EnsureDispatch("HWPFrame.HwpObject")
        hwp.XHwpWindows.Item(0).Visible = False
        hwp.Run("FileNew")
        
        # InsertText 액션 테스트
        act = hwp.CreateAction("InsertText")
        pset = act.CreateSet()
        pset.SetItem("Text", "Hello 한글!")
        act.Execute(pset)
        
        target_path = r"d:\Desktop\test_output.hwp"
        hwp.SaveAs(target_path)
        hwp.Quit()
        print("SUCCESS: HWP InsertText test completed.")
        
        # 파일이 생성되었는지 확인 후 삭제
        if os.path.exists(target_path):
            os.remove(target_path)
            print("Cleanup done.")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
