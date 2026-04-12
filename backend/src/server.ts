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

// Initialize Socket.io with Polling Fallback
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Essential for Render Free Tier stability
  allowEIO3: true
});

// Alarm Event Management
io.on('connection', (socket) => {
  console.log(`📡 Client Linked: ${socket.id} via ${socket.conn.transport.name}`);

  // Receives tiny text alerts from the browser
  socket.on('alarm-trigger', (data) => {
    console.log(`🚨 TARGET DETECTED: ${data.label} (${data.timestamp})`);
    
    // Broadcast the alert to all other connected dashboards
    socket.broadcast.emit('remote-alert', data);
    
    // Future expansion: Trigger SMS, Telegram, or Email here
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client Disconnected: ${socket.id} (${reason})`);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'online', 
    architecture: 'Edge-AI Hub',
    uptime: process.uptime() 
  });
});

app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/auth', authRoutes);

// Database & Server Launch
const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`🚀 Sentry Hub Active on Port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Critical Startup Failure:', err);
    process.exit(1);
  }
};

startServer();