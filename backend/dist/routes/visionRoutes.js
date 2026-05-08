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
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
// Multer — temp storage for any direct uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + unique + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({ storage });
/**
 * @route  GET /api/vision/status
 * @desc   Check if AI service is reachable (used for health dashboard)
 */
router.get('/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const AI_URL = process.env.AI_SERVICE_URL;
    if (!AI_URL) {
        return res.json({
            mode: 'browser',
            aiService: false,
            message: 'No AI_SERVICE_URL set. Using browser-based COCO-SSD detection.',
        });
    }
    try {
        const axios = require('axios');
        yield axios.get(`${AI_URL}/health`, { timeout: 5000 });
        res.json({ mode: 'server', aiService: true, url: AI_URL });
    }
    catch (_a) {
        res.json({
            mode: 'browser',
            aiService: false,
            message: 'AI service unreachable. Frontend is using browser COCO-SSD.',
        });
    }
}));
/**
 * @route  POST /api/vision/detect
 * @desc   Server-side detection via Python AI service.
 *         NOTE: Frontend now uses browser-based COCO-SSD directly.
 *         This route is kept for future RTSP / server-push use cases.
 */
router.post('/detect', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const AI_URL = process.env.AI_SERVICE_URL;
    // Clean up uploaded file if we're going to error out
    const cleanup = () => {
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (_a) { }
        }
    };
    if (!AI_URL) {
        cleanup();
        return res.status(503).json({
            success: false,
            error: 'Server-side AI not configured.',
            hint: 'Set AI_SERVICE_URL env var on Render, or use browser-based detection.',
        });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded.' });
    }
    try {
        const axios = require('axios');
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('image', fs_1.default.createReadStream(req.file.path));
        const aiResponse = yield axios.post(`${AI_URL}/detect`, formData, {
            headers: formData.getHeaders(),
            timeout: 20000,
        });
        cleanup();
        res.json(Object.assign({ success: true }, aiResponse.data));
    }
    catch (error) {
        cleanup();
        console.error('❌ Vision detect error:', error.message);
        res.status(500).json({
            success: false,
            error: 'AI service detection failed.',
            detail: error.message,
        });
    }
}));
exports.default = router;
