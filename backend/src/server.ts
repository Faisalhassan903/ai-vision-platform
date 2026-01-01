import dotenv from 'dotenv';
dotenv.config(); // Load .env FIRST!

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import alertRoutes from './routes/alertRoutes';
import connectDB from './config/database';
import { setupLiveRoutes } from './routes/liveRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

setupLiveRoutes(io);

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'AI Vision Platform Backend is running! 🚀',
    endpoints: {
      vision: '/api/vision',
      analytics: '/api/analytics',
      alerts: '/api/alerts',
      socket: 'Socket.io enabled'
    }
  });
});

app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);

// Start server and THEN initialize bot
httpServer.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready for connections`);
  
  // Connect to database first
  await connectDB();
  
  // THEN initialize Telegram bot (after 2 seconds to be safe)
  setTimeout(() => {
    try {
      console.log('🤖 Initializing Telegram Bot...');
      const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
      IntelligentTelegramBot.initialize();
    } catch (error: any) {
      console.error('❌ Telegram Bot initialization failed:', error.message);
      console.log('⚠️ System will continue without Telegram bot');
    }
  }, 2000);
});