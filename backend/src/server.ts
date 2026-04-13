import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

// Route Imports
import alertRoutes from './routes/alertRoutes';
import cameraRoutes from './routes/cameraRoutes';
import authRoutes from './routes/authRoutes';
import visionRoutes from './routes/visionRoutes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 10000;

// --- 1. SOCKET.IO OPTIMIZATION ---
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", // Secure this in production
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, // Handle slow mobile/render connections
  pingInterval: 25000,
  transports: ['websocket', 'polling'] // Allow fallback but prefer WS
});

app.set('socketio', io);

// --- 2. MIDDLEWARE ---
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Support image uploads
app.use(express.urlencoded({ extended: true }));

// Serve static uploads if you're storing images locally
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- 3. SOCKET EVENTS ---
io.on('connection', (socket) => {
  console.log(`📡 New Client: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client Left: ${socket.id} (${reason})`);
  });
});

// --- 4. ROUTE REGISTRATION ---
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.json({ message: "Sentry Hub API Online" });
});

// --- 5. GLOBAL 404 HANDLER ---
app.use((req: Request, res: Response) => {
  const logMsg = `❌ 404: ${req.method} ${req.originalUrl}`;
  console.warn(logMsg);
  res.status(404).json({ 
    error: "Endpoint not found", 
    method: req.method,
    path: req.originalUrl 
  });
});

// --- 6. GLOBAL ERROR HANDLER ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// --- 7. GRACEFUL SHUTDOWN (The Telegram 409 Fix) ---
const shutDown = () => {
  console.log('🛑 SIGTERM received: Closing HTTP server & Bot...');
  httpServer.close(() => {
    console.log('HTTP server closed.');
    // If you have your bot instance exported from a service:
    // bot.stopPolling().then(() => process.exit(0)); 
    process.exit(0);
  });
};

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

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