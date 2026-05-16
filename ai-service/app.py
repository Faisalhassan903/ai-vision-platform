from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import time
import base64
import cv2
import numpy as np
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)
# Allow connections from your frontend

# app.py
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode='threading', 
    logger=True, 
    engineio_logger=True  # This will show us EXACTLY why frames fail in Render logs
)
yolo_model = YOLO('yolov8n.pt')


def run_detection(img):
    """Run YOLO on a BGR image; return detection list."""
    results = yolo_model(img, verbose=False)
    detections = []
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = yolo_model.names[cls_id]
            detections.append({
                'class': label,
                'confidence': conf,
                'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
            })
    return detections


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'yolov8n'})


@app.route('/detect', methods=['POST'])
def detect():
    """REST detection for backend RTSP / upload pipelines."""
    start = time.time()
    try:
        img = None
        if 'image' in request.files:
            file_bytes = request.files['image'].read()
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        elif request.is_json and request.json.get('frame'):
            frame_data = request.json['frame']
            if ',' in frame_data:
                frame_data = frame_data.split(',')[1]
            img_bytes = base64.b64decode(frame_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        detections = run_detection(img)
        return jsonify({
            'success': True,
            'detections': detections,
            'total_objects': len(detections),
            'processing_time': round(time.time() - start, 3),
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@socketio.on('video-frame')
def handle_video_frame(data):
    try:
        # 1. Decode the base64 frame from frontend
        frame_data = data['frame'].split(",")[1]
        img_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        detections = run_detection(img)

        # Emit results back to the frontend via socket
        emit('detections', {'detections': detections})
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    # Add allow_unsafe_werkzeug=True to bypass the production safety check
    port = int(os.environ.get("PORT", 10000))
    print(f"🚀 AI Service launching on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)