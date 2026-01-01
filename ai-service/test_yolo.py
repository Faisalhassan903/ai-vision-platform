from ultralytics import YOLO
import cv2

# Load pre-trained YOLOv8 model
print("🔄 Loading YOLOv8 model...")
model = YOLO('yolov8n.pt')  # 'n' = nano (smallest, fastest)
print("✅ Model loaded successfully!")

# Test on a sample image (YOLO will download a test image)
print("🔄 Running test detection...")
results = model('https://ultralytics.com/images/bus.jpg')

# Print what was detected
print("\n🎯 Detections:")
for result in results:
    boxes = result.boxes
    for box in boxes:
        # Get class name and confidence
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = model.names[class_id]
        
        print(f"  - {class_name}: {confidence*100:.2f}%")

print("\n✅ YOLO is working perfectly!")