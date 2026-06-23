import os
from PIL import Image

# Path
src_image_path = r"C:\Users\user\.gemini\antigravity\brain\d05a464b-fea6-416e-b3aa-d924b8ee9a5e\medi_sports_rectangular_hall_real_photo_1781247577640.png"

if os.path.exists(src_image_path):
    img_orig = Image.open(src_image_path)
    width, height = img_orig.size # 1024x1024
    
    # 16:9 crop from center
    new_width = width
    new_height = int(width * 9 / 16) # 576
    left = 0
    top = (height - new_height) // 2 # 224
    right = width
    bottom = top + new_height # 800
    
    cropped = img_orig.crop((left, top, right, bottom))
    img_widescreen = cropped.resize((1920, 1080), Image.Resampling.LANCZOS).convert("RGB")
    
    # Let's crop the region around the middle guy
    # In 1024x576, he is roughly at x=340, y=288.
    # In 1920x1080, x = 340 * 1.875 = 637.5, y = 288 * 1.875 = 540.
    # We will crop x: [600, 680], y: [450, 750] and save it to inspect his exact vertical range.
    guy_crop = img_widescreen.crop((600, 450, 680, 750))
    guy_crop.save("scratch_guy.png")
    
    # Also find other standing people:
    # 1. Doctor in white coat (around x=600 in 1024x576 -> x=1125 in 1920)
    # y is around 380 in 1024x576 -> y=712 in 1920.
    # We will crop doctor at x: [1100, 1200], y: [600, 950]
    doctor_crop = img_widescreen.crop((1100, 600, 1200, 950))
    doctor_crop.save("scratch_doctor.png")
    
    # 2. Patient in grey t-shirt walking (around x=670 in 1024x576 -> x=1256 in 1920)
    # y is around 400 in 1024x576 -> y=750 in 1920.
    # We will crop patient at x: [1220, 1300], y: [680, 980]
    patient_crop = img_widescreen.crop((1220, 680, 1300, 980))
    patient_crop.save("scratch_patient.png")
    
    # 3. Person on the right posture grid (around x=770 in 1024x576 -> x=1443 in 1920)
    # y is around 400 in 1024x576 -> y=750 in 1920.
    # We will crop at x: [1400, 1480], y: [680, 980]
    posture_person = img_widescreen.crop((1400, 680, 1480, 980))
    posture_person.save("scratch_posture.png")
    
    print("Crops saved successfully.")
else:
    print("Source image not found")
