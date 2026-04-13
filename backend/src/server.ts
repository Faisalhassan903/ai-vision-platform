import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import fs from 'fs';

// Routes
import alertRoutes from './routes/alertRoutes';
const cameraRoutes = require('./routes/cameraRoutes').default;
import authRoutes from './routes/authRoutes';
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import ruleRoutes from './routes/ruleRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 10000;

const MONGO_URI = process.env.MONGODB_URI;
const AI_URL = process.env.AI_SERVICE_URL;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI missing");
  process.exit(1);
}

// ✅ Dynamic CORS (supports Vercel preview URLs)
const allowedOrigins = ["http://localhost:5173"];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.includes(".vercel.app")
    ) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
};

// --- SOCKET ---
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.includes(".vercel.app")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    }
  }
});

app.set('socketio', io);

// --- MIDDLEWARE ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// uploads fix
const uploadPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
app.use('/uploads', express.static(uploadPath));

// --- ROUTES ---
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rules', ruleRoutes);

// --- HEALTH ---
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1
  });
});

// --- ERRORS ---
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

// --- START ---
const start = async () => {
  try {
    await mongoose.connect(MONGO_URI!);
    console.log("✅ DB connected");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
};

start();