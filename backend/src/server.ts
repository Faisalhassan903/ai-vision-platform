import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Route Imports - Ensure these files have "export default router"
import alertRoutes from './routes/alertRoutes';
import cameraRoutes from './routes/cameraRoutes';
import authRoutes from './routes/authRoutes';
import visionRoutes from './routes/visionRoutes';

dotenv.config();
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 10000;

// Socket.io Setup
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.set('socketio', io); // Accessible in routes via req.app.get('socketio')

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'online', timestamp: new Date() });
});

// EMERGENCY CATCH: This prevents the 404 (Not Found) 
// if a route isn't caught by the files above
app.use((req, res) => {
  console.log(`⚠️ Route Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Path ${req.url} not found` });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});