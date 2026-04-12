import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database';

// Import existing routes
import visionRoutes from './routes/visionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import alertRoutes from './routes/alertRoutes';
import authRoutes from './routes/authRoutes';

const app = express();
const PORT = process.env.PORT || 10000;
const httpServer = createServer(app);

// 1. Optimized Socket Setup
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// 2. The "Smart" Alert Listener (Zero CPU Overhead)
io.on('connection', (socket) => {
  console.log(`📡 New Client Connected: ${socket.id}`);

  // Listen for the Edge-AI alarm trigger
  socket.on('alarm-trigger', (alertData) => {
    console.log(`🚨 ALARM: ${alertData.label} at ${alertData.timestamp}`);
    
    // Broadcast to all other connected clients (Security Dashboard)
    socket.broadcast.emit('broadcast-alarm', alertData);
    
    // INTEGRATION POINT: Add Telegram or Email notification here
    // Example: TelegramBot.sendMessage(`Movement detected: ${alertData.label}`);
  });

  socket.on('disconnect', () => console.log('🔌 Client Disconnected'));
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'online', mode: 'Edge-AI Hub' });
});

app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/auth', authRoutes);

// Server Startup
httpServer.listen(PORT, async () => {
  console.log(`✅ Edge-AI Hub running on port ${PORT}`);
  try {
    await connectDB();
  } catch (err) {
    console.error('❌ DB Connection failed');
  }
});