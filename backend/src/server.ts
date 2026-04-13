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

// ✅ ENV
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI missing");
  process.exit(1);
}

// --- 1. SOCKET.IO ---
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set('socketio', io);

// --- 2. MIDDLEWARE ---
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Ensure uploads folder exists (Render fix)
const uploadPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

app.use('/uploads', express.static(uploadPath));

// --- 3. SOCKET EVENTS ---
io.on('connection', (socket) => {
  console.log(`📡 Client Connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

// --- 4. ROUTES ---
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rules', ruleRoutes);

// --- 5. HEALTH ---
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get('/', (req, res) => {
  res.json({ message: "API running" });
});

// --- 6. ERROR HANDLING ---
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Error:", err.message);
  res.status(500).json({ error: "Server error" });
});

// --- 7. START SERVER AFTER DB ---
const start = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err: any) {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  }
};

start();

// --- 8. GRACEFUL SHUTDOWN ---
process.on('SIGINT', async () => {
  console.log("🛑 Shutting down...");
  await mongoose.connection.close();
  process.exit(0);
});