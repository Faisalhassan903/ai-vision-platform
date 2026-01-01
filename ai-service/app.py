from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision.models import resnet50, ResNet50_Weights
import io
import json

from ultralytics import YOLO
import cv2
import numpy as np
import base64
from threading import Lock

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Load pre-trained ResNet50 model
print("🔄 Loading ResNet50 model (PyTorch)...")
weights = ResNet50_Weights.IMAGENET1K_V2
model = resnet50(weights=weights)
model.eval()
print("✅ Model loaded successfully!")

# Load YOLO model for object detection
print("🔄 Loading YOLOv8 model...")
yolo_model = YOLO('yolov8s.pt')
print("✅ YOLOv8 model loaded successfully!")

# Thread lock to prevent concurrent processing
processing_lock = Lock()
is_processing = False

# Load ImageNet class labels
class_labels = weights.meta["categories"]

# Image preprocessing pipeline
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Health check endpoint
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'running',
        'message': 'AI Vision Service is ready! 🧠',
        'model': 'YOLOv8n + ResNet50',
        'python_version': '3.14',
        'classes': len(class_labels)
    })

# Prediction endpoint
@app.route('/predict', methods=['POST'])
def predict():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        img = Image.open(io.BytesIO(img_bytes))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img_tensor = preprocess(img)
        img_batch = img_tensor.unsqueeze(0)
        
        with torch.no_grad():
            output = model(img_batch)
        
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
        top3_prob, top3_idx = torch.topk(probabilities, 3)
        
        results = []
        for i in range(3):
            idx = top3_idx[i].item()
            prob = top3_prob[i].item()
            label = class_labels[idx]
            
            results.append({
                'rank': i + 1,
                'label': label.replace('_', ' ').title(),
                'confidence': float(prob),
                'confidence_percent': f"{float(prob) * 100:.2f}%"
            })
        
        return jsonify({
            'success': True,
            'predictions': results,
            'top_prediction': results[0]['label'],
            'top_confidence': results[0]['confidence_percent']
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Object Detection endpoint with drawn boxes
@app.route('/detect', methods=['POST'])
def detect_objects():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        img_with_boxes = img.copy()
        
        results = yolo_model(img, verbose=False)
        
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = yolo_model.names[class_id]
                
                cv2.rectangle(img_with_boxes, (x1, y1), (x2, y2), (0, 0, 255), 3)
                
                label = f"{class_name} {confidence*100:.1f}%"
                
                (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(img_with_boxes, (x1, y1 - label_height - 10), (x1 + label_width, y1), (0, 0, 255), -1)
                
                cv2.putText(img_with_boxes, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                detections.append({
                    'class': class_name,
                    'confidence': confidence,
                    'confidence_percent': f"{confidence * 100:.2f}%",
                    'bbox': {
                        'x1': x1,
                        'y1': y1,
                        'x2': x2,
                        'y2': y2,
                        'width': x2 - x1,
                        'height': y2 - y1
                    }
                })
        
        detections.sort(key=lambda x: x['confidence'], reverse=True)
        
        _, buffer = cv2.imencode('.jpg', img_with_boxes)
        img_base64 = buffer.tobytes()
        import base64
        img_base64_str = base64.b64encode(img_base64).decode('utf-8')
        
        return jsonify({
            'success': True,
            'detections': detections,
            'total_objects': len(detections),
            'image_with_boxes': f"data:image/jpeg;base64,{img_base64_str}"
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# LIVE STREAM ENDPOINT (FIXED & OPTIMIZED!)
@app.route('/detect-live', methods=['POST'])
def detect_live():
    global is_processing
    
    # Skip if already processing a frame
    if not processing_lock.acquire(blocking=False):
        return jsonify({
            'success': True,
            'detections': [],
            'total_objects': 0
        }), 200
    
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        
        # Decode image
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Get original dimensions
        original_height, original_width = img.shape[:2]
        
        # Run YOLO detection on ORIGINAL size (better accuracy!)
        results = yolo_model(
            img,
            conf=0.25,      # Lower confidence for more detections
            iou=0.45,       
            max_det=20,     # Allow more detections
            verbose=False
        )
        
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Get coordinates in ORIGINAL image size
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                class_name = yolo_model.names[class_id]
                
                # Scale to 416x416 (what frontend expects)
                scale_x = 416 / original_width
                scale_y = 416 / original_height
                
                detections.append({
                    'class': class_name,
                    'confidence': confidence,
                    'confidence_percent': f"{confidence * 100:.2f}%",
                    'bbox': {
                        'x1': int(x1 * scale_x),
                        'y1': int(y1 * scale_y),
                        'x2': int(x2 * scale_x),
                        'y2': int(y2 * scale_y),
                        'width': int((x2 - x1) * scale_x),
                        'height': int((y2 - y1) * scale_y)
                    }
                })
        
        detections.sort(key=lambda x: x['confidence'], reverse=True)
        
        if len(detections) > 0:
            detected_objects = ', '.join([f"{d['class']}({int(d['confidence']*100)}%)" for d in detections])
            print(f"✅ Detected: {detected_objects}")
        else:
            print(f"✅ Processed frame - found 0 objects")
        
        return jsonify({
            'success': True,
            'detections': detections,
            'total_objects': len(detections)
        })
        
    except Exception as e:
        print(f"❌ Live detection error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        processing_lock.release()

# Start server
if __name__ == '__main__':
    print("🚀 Starting AI Vision Service on http://localhost:5001")
    print("📊 Detection Settings:")
    print("   - Confidence threshold: 25%")
    print("   - Max detections: 20")
    print("   - Image size: Original (no resize)")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)