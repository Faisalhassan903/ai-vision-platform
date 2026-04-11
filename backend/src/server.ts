import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import alertRoutes from './routes/alertRoutes';
import connectDB from './config/database';
import { setupLiveRoutes } from './routes/liveRoutes';
import cameraRoutes from './routes/cameraRoutes'
import { rtspProxy } from './services/rtspProxy';
import authRoutes from './routes/authRoutes'; 

const app = express();
const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

rtspProxy.initialize(io);
setupLiveRoutes(io);

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'AI Vision Platform Backend is running! 🚀' });
});

app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes); // ADD

httpServer.listen(PORT, async () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  await connectDB();

  setTimeout(() => {
    try {
      const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
      IntelligentTelegramBot.initialize();
    } catch (error: any) {
      console.error('❌ Telegram Bot failed:', error.message);
    }
  }, 2000);
});