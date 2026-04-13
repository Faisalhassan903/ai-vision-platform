"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Route Imports
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const cameraRoutes_1 = __importDefault(require("./routes/cameraRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const visionRoutes_1 = __importDefault(require("./routes/visionRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 10000;
// --- 1. SOCKET.IO OPTIMIZATION ---
const io = new socket_io_1.Server(httpServer, {
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
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' })); // Support image uploads
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static uploads if you're storing images locally
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// --- 3. SOCKET EVENTS ---
io.on('connection', (socket) => {
    console.log(`📡 New Client: ${socket.id}`);
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Client Left: ${socket.id} (${reason})`);
    });
});
// --- 4. ROUTE REGISTRATION ---
app.use('/api/alerts', alertRoutes_1.default);
app.use('/api/cameras', cameraRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/vision', visionRoutes_1.default);
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date() });
});
app.get('/', (req, res) => {
    res.json({ message: "Sentry Hub API Online" });
});
// --- 5. GLOBAL 404 HANDLER ---
app.use((req, res) => {
    const logMsg = `❌ 404: ${req.method} ${req.originalUrl}`;
    console.warn(logMsg);
    res.status(404).json({
        error: "Endpoint not found",
        method: req.method,
        path: req.originalUrl
    });
});
// --- 6. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
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
