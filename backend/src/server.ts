import 'dotenv/config'; // Shorthand for import + config()
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import alertRoutes from './routes/alertRoutes';
import authRoutes from './routes/authRoutes';
import { setupLiveRoutes } from './routes/liveRoutes';

// The Troubleshooting Import
// If this still fails, try renaming the actual file to 'cam-routes.ts' 
// and updating the string below to match.
const cameraRoutes = require('./routes/cameraRoutes').default;

// Services
import connectDB from './config/database';
import { rtspProxy } from './services/rtspProxy';

const app = express();
const PORT = process.env.PORT || 10000; // Use 10000 for Render compatibility

const httpServer = createServer(app);

// Socket.io Setup
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Set to '*' for easier testing on Render
    methods: ['GET', 'POST']
  }
});

// Initialize Services
rtspProxy.initialize(io);
setupLiveRoutes(io);

// Middleware
app.use(cors());
app.use(express.json());

// Base Route
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'online',
    message: 'AI Vision Platform Backend is running!' 
  });
});

// Route Definitions
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);

// Server Startup
httpServer.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  
  // Database Connection
  try {
    await connectDB();
  } catch (dbError) {
    console.error('❌ Database connection failed during startup');
  }

  // Telegram Bot Initialization (Delayed to ensure DB is ready)
  setTimeout(() => {
    try {
      const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
      if (IntelligentTelegramBot && typeof IntelligentTelegramBot.initialize === 'function') {
        IntelligentTelegramBot.initialize();
      }
    } catch (error: any) {
      console.error('❌ Telegram Bot failed to initialize:', error.message);
    }
  }, 3000);
});