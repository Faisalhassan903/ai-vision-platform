# AI Vision Platform

Real-time multi-camera computer vision stack: ingestion (Python/YOLO), REST + WebSockets (Node.js/MongoDB), and a React dashboard.

## Architecture

| Layer | Stack | Role |
|--------|-------|------|
| **ai-service** | Python, YOLO/TensorFlow | RTSP/HTTP streams, detection, inference |
| **backend** | Node.js, Express, MongoDB, Socket.io | API, persistence, live alerts |
| **frontend** | React, Tailwind | Multi-camera UI, analytics |

## Repo layout

```
ai-vision-platform/
├── ai-service/    # Inference service
├── backend/       # REST + Socket.io API
├── frontend/      # Web UI
├── docker-compose.yml
└── README.md
```

## Setup

### 1. AI service

Requires Python 3.9+.

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 2. Backend

Requires Node.js 18+ (recommended) and MongoDB.

```bash
cd backend
npm install
npm run build
# Configure .env (see /.env.example) — minimum: MONGODB_URI
npm start
```

For development:

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment

Create `.env` files as needed (`backend/`, `ai-service/`). Root `.env.example` lists common Telegram/Discord-related variables. Do not commit secrets.

## License

MIT.
