import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

// Route Imports
import alertRoutes from './routes/alertRoutes';
const cameraRoutes = require('./routes/cameraRoutes').default;
import authRoutes from './routes/authRoutes';
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 10000;

// --- 1. SOCKET.IO ---
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.set('socketio', io);

// --- 2. MIDDLEWARE ---
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- 3. SOCKET EVENTS ---
io.on('connection', (socket) => {
  console.log(`📡 New Client: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client Left: ${socket.id} (${reason})`);
  });
});

// --- 4. ROUTES ---
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date() 
  });
});

app.get('/', (req, res) => {
  res.json({ message: "Sentry Hub API Online" });
});

// --- 5. 404 HANDLER ---
app.use((req: Request, res: Response) => {
  console.warn(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Endpoint not found", path: req.originalUrl });
});

// --- 6. ERROR HANDLER ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// --- 7. GRACEFUL SHUTDOWN ---
const shutDown = () => {
  console.log('🛑 Shutting down...');
  httpServer.close(() => {
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

// --- 8. CONNECT DB THEN START SERVER ---
// THIS WAS THE BUG: server was starting without waiting for MongoDB
const startServer = async () => {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_vision_security';

    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 15000,  // Give Atlas 15s to respond on cold start
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      maxPoolSize: 5,
    });
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);

    // Only start listening AFTER DB is confirmed connected
    httpServer.listen(PORT, () => {
      console.log(`
  🚀 SYSTEM READY
  -------------------------------
  Port:    ${PORT}
  Mode:    ${process.env.NODE_ENV || 'development'}
  Routes:  /api/alerts, /api/cameras, /api/auth, /api/vision
  -------------------------------
      `);
    });

  } catch (error: any) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1); // Crash on startup failure — Render will restart automatically
  }
};

// Handle MongoDB disconnections after startup
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected.');
});

startServer();