import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

// --- SERVICE & CONFIG IMPORTS ---
import connectDB from './config/database';
// Ensure these files exist in your /routes folder
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import alertRoutes from './routes/alertRoutes';
import authRoutes from './routes/authRoutes';
import cameraRoutes from './routes/cameraRoutes'; // Fixed the require() issue
import { setupLiveRoutes } from './routes/liveRoutes';

const app = express();
const PORT = process.env.PORT || 10000;
const httpServer = createServer(app);

// --- SOCKET.IO CONFIGURATION (Optimized for Render Free Tier) ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allows your frontend to connect regardless of the URL
    methods: ["GET", "POST"],
    credentials: true
  },
  // Adding these 3 lines fixes the "WebSocket closed before established" error
  transports: ['polling', 'websocket'], 
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
connectDB().catch(err => console.error("Database connection failed:", err));

// --- ROUTES ---
// Base Health Check
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'online', 
    mode: 'Edge-AI Alert Hub',
    timestamp: new Date().toISOString()
  });
});

// API Endpoints
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes); // This 404 is now fixed
app.use('/api/auth', authRoutes);

// Initialize Live Socket Routes
setupLiveRoutes(io);

// --- ALARM LOGIC (Edge-AI Signal Receiver) ---
io.on('connection', (socket) => {
  console.log(`📡 New Client Connected: ${socket.id}`);

  // Listen for the "Person Detected" signal from the browser
  socket.on('alarm-trigger', (data) => {
    console.log('🚨 ALARM SIGNAL RECEIVED:', data);
    
    // Broadcast the alarm to all other connected web pages
    io.emit('remote-alert', {
      ...data,
      serverId: 'RENDER_SENTRY_01'
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client Disconnected: ${socket.id} (${reason})`);
  });
});

// --- TELEGRAM / EXTERNAL SERVICES ---
// Use a safe try/catch for the Telegram bot to prevent server crashes
setTimeout(() => {
  try {
    const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
    if (IntelligentTelegramBot?.initialize) {
      IntelligentTelegramBot.initialize();
    }
  } catch (error) {
    console.warn('⚠️ Telegram service skipped (check your BOT_TOKEN)');
  }
}, 5000);

// --- START SERVER ---
httpServer.listen(PORT, () => {
  console.log(`
  🚀 SERVER 100% OPERATIONAL
  ---------------------------------
  Port: ${PORT}
  Mode: Edge-AI Hub
  CORS: Enabled (All Origins)
  ---------------------------------
  `);
});