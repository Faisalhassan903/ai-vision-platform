# AGENTS.md

## Cursor Cloud specific instructions

### Overview

SENTRY AI is a real-time AI-powered security surveillance platform with three services:

| Service | Directory | Dev Command | Port |
|---------|-----------|-------------|------|
| Frontend (React/Vite) | `frontend/` | `npm run dev` | 5173 |
| Backend (Node.js/Express/TS) | `backend/` | `npm run dev` | 10000 |
| AI Service (Python/Flask/YOLO) | `ai-service/` | `python main.py` | 5001 |

MongoDB is required on port 27017. The AI service is optional (frontend falls back to browser-based TensorFlow.js COCO-SSD).

### Starting services

1. **MongoDB**: `mongod --dbpath /tmp/mongodb --fork --logpath /tmp/mongodb/mongod.log`
2. **Backend**: `cd backend && npm run dev` (requires `.env` with `MONGODB_URI=mongodb://localhost:27017/sentry_ai`)
3. **Frontend**: `cd frontend && npm run dev`
4. **AI Service** (optional): `cd ai-service && source .venv/bin/activate && python main.py`

### Known issues (Linux/case-sensitive filesystem)

- The file `backend/src/routes/Cameraroutes.ts` must be named `cameraRoutes.ts` for the import in `server.ts` to resolve. This has been fixed in this branch.

### Lint / Build / Test

- **Frontend lint**: `cd frontend && npm run lint` — pre-existing `no-explicit-any` warnings exist
- **Frontend build**: `cd frontend && npm run build`
- **Backend build**: `cd backend && npx tsc`
- **Backend dev**: `cd backend && npm run dev` (nodemon + ts-node)

### Environment variables

Backend requires a `.env` in `backend/` with at minimum:
```
MONGODB_URI=mongodb://localhost:27017/sentry_ai
PORT=10000
TELEGRAM_ENABLED=false
```

### AI Service Python environment

The AI service uses a Python venv at `ai-service/.venv`. The `requirements.txt` pins `torch==2.1.2` which is incompatible with Python 3.12+. Install with relaxed versions:
```
pip install flask==3.0.0 flask-cors==4.0.0 opencv-python-headless gunicorn "numpy<2.0.0" flask-socketio==5.3.6 python-socketio==5.10.0 python-engineio==4.8.0 ultralytics
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```
