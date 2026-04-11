"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // Shorthand for import + config()
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
// Routes
const visionRoutes_1 = __importDefault(require("./routes/visionRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const liveRoutes_1 = require("./routes/liveRoutes");
// The Troubleshooting Import
// If this still fails, try renaming the actual file to 'cam-routes.ts' 
// and updating the string below to match.
const cameraRoutes_1 = __importDefault(require("./routes/cameraRoutes"));
// Services
const database_1 = __importDefault(require("./config/database"));
const rtspProxy_1 = require("./services/rtspProxy");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 10000; // Use 10000 for Render compatibility
const httpServer = (0, http_1.createServer)(app);
// Socket.io Setup
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*', // Set to '*' for easier testing on Render
        methods: ['GET', 'POST']
    }
});
// Initialize Services
rtspProxy_1.rtspProxy.initialize(io);
(0, liveRoutes_1.setupLiveRoutes)(io);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Base Route
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'AI Vision Platform Backend is running!'
    });
});
// Route Definitions
app.use('/api/vision', visionRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/alerts', alertRoutes_1.default);
app.use('/api/cameras', cameraRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
// Server Startup
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`✅ Server running on port ${PORT}`);
    // Database Connection
    try {
        yield (0, database_1.default)();
    }
    catch (dbError) {
        console.error('❌ Database connection failed during startup');
    }
    // Telegram Bot Initialization (Delayed to ensure DB is ready)
    setTimeout(() => {
        try {
            const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
            if (IntelligentTelegramBot && typeof IntelligentTelegramBot.initialize === 'function') {
                IntelligentTelegramBot.initialize();
            }
        }
        catch (error) {
            console.error('❌ Telegram Bot failed to initialize:', error.message);
        }
    }, 3000);
}));
