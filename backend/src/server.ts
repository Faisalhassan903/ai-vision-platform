import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Route Imports
import alertRoutes from './routes/alertRoutes';
import cameraRoutes from './routes/cameraRoutes';
import authRoutes from './routes/authRoutes';
import visionRoutes from './routes/visionRoutes';

dotenv.config();
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 10000;

// Socket.io initialization
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Attach io to app so routes can use it
app.set('socketio', io);

app.use(cors());
app.use(express.json());

// --- ROUTE REGISTRATION ---
// We use a prefix to ensure no collision
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);

// --- DEBUGGING: Check registered routes ---
console.log("✅ Routes Loaded: /alerts, /cameras, /auth, /vision");

app.get('/', (req, res) => {
  res.json({ message: "Sentry Hub Online" });
});

// --- GLOBAL 404 HANDLER ---
// If the code reaches here, it means the route above didn't catch it
app.use((req: Request, res: Response) => {
  console.log(`❌ 404 at ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Endpoint not found", 
    received: { method: req.method, path: req.url } 
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server monitoring on port ${PORT}`);
});