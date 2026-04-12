from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision.models import resnet50, ResNet50_Weights
import io
import os
import json
import base64
import numpy as np
import cv2
from ultralytics import YOLO
from threading import Lock

# Initialize Flask app
app = Flask(__name__)
# Enable CORS so your Vercel frontend can talk to this Render backend
CORS(app)

# --- MODEL LOADING ---

print("🔄 Loading ResNet50 model (PyTorch)...")
weights = ResNet50_Weights.IMAGENET1K_V2
classifier_model = resnet50(weights=weights)
classifier_model.eval()
class_labels = weights.meta["categories"]
print("✅ ResNet50 loaded!")

print("🔄 Loading YOLOv8 Nano model...")
# Using Nano version for faster inference on Render's free/starter tiers
yolo_model = YOLO('yolov8n.pt') 
print("✅ YOLOv8n loaded!")

# --- UTILS ---

preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# --- ROUTES ---

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'online',
        'message': 'AI Vision Service is active!',
        'models': ['ResNet50', 'YOLOv8n']
    })

# Unified route for Classification
@app.route('/api/vision/classify', methods=['POST'])
def classify_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        img = Image.open(io.BytesIO(file.read())).convert('RGB')
        
        # Inference
        img_tensor = preprocess(img).unsqueeze(0)
        with torch.no_grad():
            output = classifier_model(img_tensor)
        
        # Formatting results
        probs = torch.nn.functional.softmax(output[0], dim=0)
        top_probs, top_idxs = torch.topk(probs, 3)
        
        predictions = []
        for i in range(3):
            label = class_labels[top_idxs[i].item()].replace('_', ' ').title()
            conf = float(top_probs[i].item())
            predictions.append({
                'label': label,
                'confidence_percent': f"{conf * 100:.2f}%"
            })
            
        return jsonify({
            'success': True,
            'topPrediction': predictions[0]['label'],
            'topConfidence': predictions[0]['confidence_percent'],
            'predictions': predictions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Unified route for Object Detection
@app.route('/api/vision/detect', methods=['POST'])
def detect_objects():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        file_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        # Run YOLOv8
        results = yolo_model(img, verbose=False)
        detections = []
        annotated_img = img.copy()

        for result in results:
            for box in result.boxes:
                # Get coordinates
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = yolo_model.names[cls_id]

                # Draw Bounding Box (Green)
                cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(annotated_img, f"{label} {conf:.2f}", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                detections.append({
                    'class': label,
                    'confidence_percent': f"{conf * 100:.1f}%",
                    'bbox': {
                        'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                        'width': x2 - x1, 'height': y2 - y1
                    }
                })

        # Encode annotated image to Base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        return jsonify({
            'success': True,
            'detections': detections,
            'totalObjects': len(detections), # Matches frontend key
            'image_with_boxes': f"data:image/jpeg;base64,{img_base64}"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- STARTUP ---

if __name__ == '__main__':
    # PORT is provided by Render, default to 10000 for local testing
    port = int(os.environ.get("PORT", 10000))
    print(f"🚀 AI Service launching on port {port}...")
    app.run(host='0.0.0.0', port=port)