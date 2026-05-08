"use strict";
// ===========================================
// CAMERA ROUTES
// ===========================================
// REST API for camera management
// Endpoints: CRUD + stream control + testing
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
const Camera_1 = __importDefault(require("../models/Camera"));
const rtspProxy_1 = require("../services/rtspProxy");
const router = express_1.default.Router();
// -------------------------------------------
// GET /api/cameras - List all cameras
// -------------------------------------------
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cameras = yield Camera_1.default.find().sort({ createdAt: -1 });
        // Add stream status to each camera
        const camerasWithStatus = cameras.map((cam) => {
            const streamStatus = rtspProxy_1.rtspProxy.getStreamStatus(cam.cameraId);
            return Object.assign(Object.assign({}, cam.toObject()), { streamStatus: streamStatus || { isRunning: false, viewers: 0 } });
        });
        res.json({
            success: true,
            count: cameras.length,
            cameras: camerasWithStatus
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// GET /api/cameras/:id - Get single camera
// -------------------------------------------
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const camera = yield Camera_1.default.findOne({ cameraId: req.params.id });
        if (!camera) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        const streamStatus = rtspProxy_1.rtspProxy.getStreamStatus(camera.cameraId);
        res.json({
            success: true,
            camera: Object.assign(Object.assign({}, camera.toObject()), { streamStatus: streamStatus || { isRunning: false, viewers: 0 } })
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// POST /api/cameras - Create new camera
// -------------------------------------------
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, type, streamUrl, username, password, location, group, enabled = true, fps = 5, resolution } = req.body;
        // Generate unique camera ID
        const cameraId = `cam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const camera = new Camera_1.default({
            cameraId,
            name: name || `Camera ${cameraId.slice(0, 8)}`,
            type: type || 'rtsp',
            streamUrl,
            username,
            password,
            location,
            group,
            enabled,
            status: 'offline',
            settings: {
                fps,
                resolution
            }
        });
        yield camera.save();
        console.log(`[Camera] Created: ${camera.name} (${camera.cameraId})`);
        res.status(201).json({
            success: true,
            camera: camera.toObject()
        });
    }
    catch (error) {
        console.error('[Camera] Create error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// PUT /api/cameras/:id - Update camera
// -------------------------------------------
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const camera = yield Camera_1.default.findOneAndUpdate({ cameraId: req.params.id }, Object.assign(Object.assign({}, req.body), { updatedAt: new Date() }), { new: true, runValidators: true });
        if (!camera) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        // If stream URL changed and stream is running, restart it
        if (req.body.streamUrl) {
            const status = rtspProxy_1.rtspProxy.getStreamStatus(camera.cameraId);
            if (status === null || status === void 0 ? void 0 : status.isRunning) {
                rtspProxy_1.rtspProxy.stopStream(camera.cameraId);
                // Stream will be restarted when viewers reconnect
            }
        }
        res.json({
            success: true,
            camera: camera.toObject()
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// DELETE /api/cameras/:id - Delete camera
// -------------------------------------------
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Stop stream if running
        rtspProxy_1.rtspProxy.stopStream(req.params.id);
        const camera = yield Camera_1.default.findOneAndDelete({ cameraId: req.params.id });
        if (!camera) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        console.log(`[Camera] Deleted: ${camera.name}`);
        res.json({
            success: true,
            message: 'Camera deleted'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// POST /api/cameras/:id/test - Test camera connection
// -------------------------------------------
router.post('/:id/test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const camera = yield Camera_1.default.findOne({ cameraId: req.params.id });
        if (!camera) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        if (camera.type !== 'rtsp' || !camera.streamUrl) {
            return res.json({
                success: true,
                message: 'Non-RTSP camera - cannot test remotely'
            });
        }
        // Build full RTSP URL with credentials
        let testUrl = camera.streamUrl;
        if (camera.username && camera.password) {
            const urlObj = new URL(camera.streamUrl);
            urlObj.username = camera.username;
            urlObj.password = camera.password;
            testUrl = urlObj.toString();
        }
        const result = yield rtspProxy_1.rtspProxy.testConnection(testUrl);
        // Update camera status
        yield Camera_1.default.updateOne({ cameraId: camera.cameraId }, {
            status: result.success ? 'online' : 'error',
            lastError: result.error,
            lastTested: new Date()
        });
        res.json({
            success: result.success,
            error: result.error,
            message: result.success ? 'Connection successful' : 'Connection failed'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// POST /api/cameras/:id/start - Start stream
// -------------------------------------------
router.post('/:id/start', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const camera = yield Camera_1.default.findOne({ cameraId: req.params.id });
        if (!camera) {
            return res.status(404).json({ success: false, error: 'Camera not found' });
        }
        if (camera.type !== 'rtsp') {
            return res.json({
                success: true,
                message: 'Non-RTSP camera - stream handled by client'
            });
        }
        // Build full RTSP URL with credentials
        let streamUrl = camera.streamUrl || '';
        if (camera.username && camera.password && streamUrl) {
            try {
                const urlObj = new URL(streamUrl);
                urlObj.username = camera.username;
                urlObj.password = camera.password;
                streamUrl = urlObj.toString();
            }
            catch (_c) {
                // If URL parsing fails, try simple string replacement
                streamUrl = streamUrl.replace('rtsp://', `rtsp://${camera.username}:${camera.password}@`);
            }
        }
        const result = yield rtspProxy_1.rtspProxy.startStream({
            cameraId: camera.cameraId,
            rtspUrl: streamUrl,
            fps: ((_a = camera.settings) === null || _a === void 0 ? void 0 : _a.fps) || 5,
            resolution: (_b = camera.settings) === null || _b === void 0 ? void 0 : _b.resolution
        });
        if (result.success) {
            yield Camera_1.default.updateOne({ cameraId: camera.cameraId }, { status: 'online' });
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// POST /api/cameras/:id/stop - Stop stream
// -------------------------------------------
router.post('/:id/stop', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stopped = rtspProxy_1.rtspProxy.stopStream(req.params.id);
        if (stopped) {
            yield Camera_1.default.updateOne({ cameraId: req.params.id }, { status: 'offline' });
        }
        res.json({
            success: true,
            message: stopped ? 'Stream stopped' : 'Stream was not running'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// GET /api/cameras/streams/active - Get active streams
// -------------------------------------------
router.get('/streams/active', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const activeStreams = rtspProxy_1.rtspProxy.getActiveStreams();
        res.json({
            success: true,
            count: activeStreams.length,
            streams: activeStreams
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// -------------------------------------------
// POST /api/cameras/test-url - Test RTSP URL directly
// -------------------------------------------
router.post('/test-url', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { url, username, password } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }
        // Build full URL with credentials
        let testUrl = url;
        if (username && password) {
            try {
                const urlObj = new URL(url);
                urlObj.username = username;
                urlObj.password = password;
                testUrl = urlObj.toString();
            }
            catch (_a) {
                testUrl = url.replace('rtsp://', `rtsp://${username}:${password}@`);
            }
        }
        const result = yield rtspProxy_1.rtspProxy.testConnection(testUrl);
        res.json({
            success: result.success,
            error: result.error,
            message: result.success ? 'Connection successful!' : 'Connection failed'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;
