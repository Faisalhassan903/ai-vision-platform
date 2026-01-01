AI Vision Platform 👁️🚀
A comprehensive, real-time computer vision system that processes multiple camera streams, performs object detection, and visualizes analytics through a modern web dashboard.

🏗️ System Architecture
The platform is divided into three core layers as shown in the system design:

Data Ingestion (Python AI Service): Uses TensorFlow/YOLO to process RTSP/HTTP streams from IP cameras. It handles object detection, tracking, and metadata extraction, pushing data to Kafka/Redis Streams.

Core Services (Node.js & MongoDB): The Backend API manages data persistence, provides REST endpoints (/detections, /cameras), and pushes real-time alerts via Socket.io.

Frontend UI (React): A responsive web dashboard featuring a multi-camera grid, real-time video feeds, and a comprehensive analytics reporting suite.

🛠️ Project Structure
Plaintext

ai-vision-platform/
├── ai-service/       # Python, YOLO, TensorFlow, Kafka/Redis
├── backend/          # Node.js, Express, MongoDB, Socket.io
├── frontend/         # React.js, Tailwind CSS, WebSockets
└── .gitignore        # Optimized for monorepo
🚀 Installation & Setup
1. Python AI Service
Prerequisites: Python 3.9+, Virtual Environment.

Bash

cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate | Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python main.py
2. Node.js Backend
Prerequisites: Node.js 16+, MongoDB instance.

Bash

cd backend
npm install
# Configure your .env with MONGODB_URI
npm start
3. React Frontend
Bash

cd frontend
npm install
npm run dev
✨ Core Features
Multi-Stream Processing: Handle multiple RTSP IP camera feeds simultaneously.

Real-time Object Detection: Powered by YOLO/TensorFlow for high-accuracy tracking.

Live WebSockets: Instant alerts and video feed updates using Socket.io.

Data Analytics: Historical reporting of detections stored in MongoDB.

C

🔒 Environment Variables
Ensure you create a .env file in both the /backend and /ai-service directories. Refer to the .env.example files (if provided) for the required keys like Database URLs and API Secret Keys.

📜 License
This project is delivered under the MIT License.
