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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
// Routes
const alertRoutes_1 = __importDefault(require("./routes/alertRoutes"));
const cameraRoutes = require('./routes/cameraRoutes').default;
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const visionRoutes_1 = __importDefault(require("./routes/visionRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const ruleRoutes_1 = __importDefault(require("./routes/ruleRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error("❌ MONGODB_URI missing");
    process.exit(1);
}
// ==============================
// CORS CONFIG
// ==============================
const allowedOrigins = ["http://localhost:5173"];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin ||
            allowedOrigins.includes(origin) ||
            origin.includes(".vercel.app")) {
            callback(null, true);
        }
        else {
            console.log("❌ Blocked by CORS:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
};
// ==============================
// SOCKET.IO
// ==============================
const io = new socket_io_1.Server(httpServer, {
    cors: corsOptions,
});
app.set('socketio', io);
// ==============================
// MIDDLEWARE
// ==============================
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ==============================
// STATIC UPLOADS
// ==============================
const uploadPath = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadPath)) {
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadPath));
// ==============================
// ROUTES
// ==============================
app.use('/api/alerts', alertRoutes_1.default);
app.use('/api/cameras', cameraRoutes);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/vision', visionRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/rules', ruleRoutes_1.default); // ✅ FIXED (was missing /)
// ==============================
// HEALTH CHECK
// ==============================
app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        db: mongoose_1.default.connection.readyState === 1,
    });
});
// ==============================
// 404 HANDLER
// ==============================
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});
// ==============================
// ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.message);
    res.status(500).json({ error: err.message });
});
// ==============================
// START SERVER
// ==============================
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoose_1.default.connect(MONGO_URI);
        console.log("✅ DB connected");
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ Startup error:", err.message);
        process.exit(1);
    }
});
start();
