from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit # Add these
import base64
import cv2
import numpy as np
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)
# Allow connections from your frontend
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading') 

yolo_model = YOLO('yolov8n.pt')

@socketio.on('video-frame')
def handle_video_frame(data):
    try:
        # 1. Decode the base64 frame from frontend
        frame_data = data['frame'].split(",")[1]
        img_bytes = base64.b64decode(frame_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # 2. Run YOLO Detection
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
                    'confidence': conf, # Frontend expects 'confidence' (decimal)
                    'bbox': {
                        'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2
                    }
                })

        # 3. Emit results BACK to the frontend via socket
        emit('detections', {'detections': detections})
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    # CRITICAL: Use socketio.run instead of app.run
    port = int(os.environ.get("PORT", 10000))
    socketio.run(app, host='0.0.0.0', port=port)