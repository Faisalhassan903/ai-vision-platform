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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const visionRoutes_1 = __importDefault(require("./routes/visionRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const database_1 = __importDefault(require("./config/database"));
const liveRoutes_1 = require("./routes/liveRoutes");
const cameraRoutes_1 = __importDefault(require("./routes/cameraRoutes"));
const rtspProxy_1 = require("./services/rtspProxy");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});
rtspProxy_1.rtspProxy.initialize(io);
(0, liveRoutes_1.setupLiveRoutes)(io);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.json({ message: 'AI Vision Platform Backend is running! 🚀' });
});
app.use('/api/vision', visionRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/alerts', alertRoutes_1.default);
app.use('/api/cameras', cameraRoutes_1.default);
app.use('/api/auth', authRoutes_1.default); // ADD
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    yield (0, database_1.default)();
    setTimeout(() => {
        try {
            const { IntelligentTelegramBot } = require('./services/IntelligentTelegramBot');
            IntelligentTelegramBot.initialize();
        }
        catch (error) {
            console.error('❌ Telegram Bot failed:', error.message);
        }
    }, 2000);
}));
