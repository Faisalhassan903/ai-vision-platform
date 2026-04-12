require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

// --- SERVICE & CONFIG ---
const connectDB = require('./config/database').default || require('./config/database');

// --- ROUTE IMPORTS (Fixed require logic) ---
// We use .default fallback because TypeScript transpilations often wrap exports
const visionRoutes = require('./routes/visionRoutes').default || require('./routes/visionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes').default || require('./routes/analyticsRoutes');
const alertRoutes = require('./routes/alertRoutes').default || require('./routes/alertRoutes');
const authRoutes = require('./routes/authRoutes').default || require('./routes/authRoutes');
const cameraRoutes = require('./routes/cameraRoutes').default || require('./routes/cameraRoutes');
const { setupLiveRoutes } = require('./routes/liveRoutes');

const app = express();
const PORT = process.env.PORT || 10000;
const httpServer = createServer(app);

// --- SOCKET.IO CONFIG (Render Free Tier Optimization) ---
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Force polling first to prevent the "closed before established" error
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE ---
if (typeof connectDB === 'function') {
    connectDB().catch(err => console.error("Database connection failed:", err));
}

// --- ROUTES ---
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    mode: 'Edge-AI Hub',
    uptime: process.uptime() 
  });
});

// API Endpoints - If these were 404ing, this new require logic fixes it
app.use('/api/vision', visionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes);

// Initialize Live Socket Routes
if (typeof setupLiveRoutes === 'function') {
    setupLiveRoutes(io);
}

// --- ALARM SIGNAL RECEIVER ---
io.on('connection', (socket) => {
  console.log(`📡 Socket Connected: ${socket.id} [${socket.conn.transport.name}]`);

  socket.on('alarm-trigger', (data) => {
    console.log('🚨 ALARM RECEIVED:', data);
    // Send to all connected clients
    io.emit('remote-alert', {
      ...data,
      server_timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket Disconnected: ${socket.id} (${reason})`);
  });
});

// --- TELEGRAM SERVICE ---
setTimeout(() => {
  try {
    const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
    if (IntelligentTelegramBot && typeof IntelligentTelegramBot.initialize === 'function') {
      IntelligentTelegramBot.initialize();
    }
  } catch (error) {
    console.log('⚠️ Telegram Bot check skipped.');
  }
}, 5000);

// --- START ---
httpServer.listen(PORT, () => {
  console.log(`🚀 Sentry Hub ready on Port ${PORT}`);
});