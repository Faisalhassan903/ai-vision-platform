"use strict";
// ===========================================
// RTSP STREAM PROXY SERVICE
// ===========================================
// Handles RTSP stream connections and converts to WebSocket frames
// Requires: fluent-ffmpeg, @ffmpeg-installer/ffmpeg
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rtspProxy = void 0;
const child_process_1 = require("child_process");
// -------------------------------------------
// RTSP PROXY CLASS
// -------------------------------------------
class RtspProxyService {
    constructor() {
        this.streams = new Map();
        this.io = null;
    }
    /**
     * Initialize with Socket.io server
     */
    initialize(io) {
        this.io = io;
        console.log('[RTSP Proxy] Initialized');
        // Handle client connections
        io.on('connection', (socket) => {
            // Client wants to view a stream
            socket.on('view-rtsp-stream', (cameraId) => {
                this.addViewer(cameraId, socket.id);
            });
            // Client stops viewing
            socket.on('stop-rtsp-stream', (cameraId) => {
                this.removeViewer(cameraId, socket.id);
            });
            // Client disconnects
            socket.on('disconnect', () => {
                this.removeViewerFromAll(socket.id);
            });
        });
    }
    /**
     * Start streaming from an RTSP camera
     */
    startStream(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const { cameraId, rtspUrl, fps = 5, resolution } = config;
            // Check if already streaming
            if (this.streams.has(cameraId)) {
                const stream = this.streams.get(cameraId);
                if (stream.isRunning) {
                    return { success: true };
                }
            }
            console.log(`[RTSP Proxy] Starting stream: ${cameraId}`);
            console.log(`[RTSP Proxy] URL: ${rtspUrl.replace(/\/\/.*:.*@/, '//***:***@')}`);
            try {
                // Build FFmpeg command
                const ffmpegArgs = [
                    '-rtsp_transport', 'tcp', // Use TCP for reliability
                    '-i', rtspUrl, // Input URL
                    '-f', 'image2pipe', // Output format
                    '-vcodec', 'mjpeg', // JPEG codec
                    '-vf', `fps=${fps}`, // Frame rate
                    '-q:v', '5', // Quality (1-31, lower = better)
                    '-' // Output to stdout
                ];
                // Add resolution scaling if specified
                if (resolution) {
                    const scaleIndex = ffmpegArgs.indexOf('-vf');
                    ffmpegArgs[scaleIndex + 1] = `fps=${fps},scale=${resolution.width}:${resolution.height}`;
                }
                // Spawn FFmpeg process
                const ffmpegProcess = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs);
                // Create stream entry
                const stream = {
                    id: cameraId,
                    name: cameraId,
                    rtspUrl,
                    process: ffmpegProcess,
                    isRunning: true,
                    viewers: new Set(),
                    lastFrame: null,
                    fps,
                    errors: []
                };
                this.streams.set(cameraId, stream);
                // Handle stdout (JPEG frames)
                let frameBuffer = Buffer.alloc(0);
                const SOI = Buffer.from([0xFF, 0xD8]); // JPEG Start Of Image
                const EOI = Buffer.from([0xFF, 0xD9]); // JPEG End Of Image
                ffmpegProcess.stdout.on('data', (data) => {
                    frameBuffer = Buffer.concat([frameBuffer, data]);
                    // Look for complete JPEG frames
                    let soiIndex = frameBuffer.indexOf(SOI);
                    let eoiIndex = frameBuffer.indexOf(EOI);
                    while (soiIndex !== -1 && eoiIndex !== -1 && eoiIndex > soiIndex) {
                        // Extract complete frame
                        const frame = frameBuffer.slice(soiIndex, eoiIndex + 2);
                        const base64Frame = `data:image/jpeg;base64,${frame.toString('base64')}`;
                        // Store and broadcast
                        stream.lastFrame = base64Frame;
                        this.broadcastFrame(cameraId, base64Frame);
                        // Remove processed frame from buffer
                        frameBuffer = frameBuffer.slice(eoiIndex + 2);
                        soiIndex = frameBuffer.indexOf(SOI);
                        eoiIndex = frameBuffer.indexOf(EOI);
                    }
                    // Prevent buffer overflow
                    if (frameBuffer.length > 10 * 1024 * 1024) {
                        frameBuffer = Buffer.alloc(0);
                    }
                });
                // Handle stderr (FFmpeg logs)
                ffmpegProcess.stderr.on('data', (data) => {
                    const message = data.toString();
                    // Only log errors, not progress
                    if (message.includes('error') || message.includes('Error')) {
                        console.error(`[RTSP ${cameraId}] ${message}`);
                        stream.errors.push(message);
                    }
                });
                // Handle process exit
                ffmpegProcess.on('close', (code) => {
                    var _a;
                    console.log(`[RTSP ${cameraId}] FFmpeg process exited with code ${code}`);
                    stream.isRunning = false;
                    // Notify viewers
                    (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(`camera-${cameraId}`).emit('rtsp-stream-ended', {
                        cameraId,
                        code
                    });
                });
                ffmpegProcess.on('error', (err) => {
                    console.error(`[RTSP ${cameraId}] FFmpeg error:`, err.message);
                    stream.isRunning = false;
                    stream.errors.push(err.message);
                });
                return { success: true };
            }
            catch (error) {
                console.error(`[RTSP Proxy] Failed to start stream ${cameraId}:`, error.message);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Stop a stream
     */
    stopStream(cameraId) {
        const stream = this.streams.get(cameraId);
        if (!stream)
            return false;
        if (stream.process) {
            stream.process.kill('SIGTERM');
            stream.isRunning = false;
        }
        this.streams.delete(cameraId);
        console.log(`[RTSP Proxy] Stopped stream: ${cameraId}`);
        return true;
    }
    /**
     * Add a viewer to a stream
     */
    addViewer(cameraId, socketId) {
        var _a, _b, _c;
        const stream = this.streams.get(cameraId);
        if (!stream)
            return;
        stream.viewers.add(socketId);
        (_b = (_a = this.io) === null || _a === void 0 ? void 0 : _a.sockets.sockets.get(socketId)) === null || _b === void 0 ? void 0 : _b.join(`camera-${cameraId}`);
        // Send last frame immediately if available
        if (stream.lastFrame) {
            (_c = this.io) === null || _c === void 0 ? void 0 : _c.to(socketId).emit('rtsp-frame', {
                cameraId,
                frame: stream.lastFrame
            });
        }
        console.log(`[RTSP ${cameraId}] Viewer added: ${socketId} (${stream.viewers.size} total)`);
    }
    /**
     * Remove a viewer from a stream
     */
    removeViewer(cameraId, socketId) {
        var _a, _b;
        const stream = this.streams.get(cameraId);
        if (!stream)
            return;
        stream.viewers.delete(socketId);
        (_b = (_a = this.io) === null || _a === void 0 ? void 0 : _a.sockets.sockets.get(socketId)) === null || _b === void 0 ? void 0 : _b.leave(`camera-${cameraId}`);
        // Stop stream if no viewers
        if (stream.viewers.size === 0) {
            console.log(`[RTSP ${cameraId}] No viewers, stopping stream`);
            this.stopStream(cameraId);
        }
    }
    /**
     * Remove viewer from all streams (on disconnect)
     */
    removeViewerFromAll(socketId) {
        this.streams.forEach((stream, cameraId) => {
            if (stream.viewers.has(socketId)) {
                this.removeViewer(cameraId, socketId);
            }
        });
    }
    /**
     * Broadcast frame to all viewers
     */
    broadcastFrame(cameraId, frame) {
        var _a;
        (_a = this.io) === null || _a === void 0 ? void 0 : _a.to(`camera-${cameraId}`).emit('rtsp-frame', {
            cameraId,
            frame,
            timestamp: Date.now()
        });
    }
    /**
     * Get stream status
     */
    getStreamStatus(cameraId) {
        const stream = this.streams.get(cameraId);
        if (!stream)
            return null;
        return {
            isRunning: stream.isRunning,
            viewers: stream.viewers.size,
            fps: stream.fps
        };
    }
    /**
     * Get all active streams
     */
    getActiveStreams() {
        return Array.from(this.streams.values()).map((s) => ({
            id: s.id,
            viewers: s.viewers.size,
            isRunning: s.isRunning
        }));
    }
    /**
     * Test RTSP connection without starting full stream
     */
    testConnection(rtspUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    testProcess.kill();
                    resolve({ success: false, error: 'Connection timeout (10s)' });
                }, 10000);
                const testProcess = (0, child_process_1.spawn)('ffprobe', [
                    '-rtsp_transport', 'tcp',
                    '-v', 'error',
                    '-show_entries', 'stream=width,height,codec_name',
                    '-of', 'json',
                    rtspUrl
                ]);
                let output = '';
                testProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });
                testProcess.stderr.on('data', (data) => {
                    console.error(`[RTSP Test] ${data.toString()}`);
                });
                testProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0) {
                        try {
                            const info = JSON.parse(output);
                            resolve({
                                success: true,
                                error: undefined
                            });
                        }
                        catch (_a) {
                            resolve({ success: true });
                        }
                    }
                    else {
                        resolve({ success: false, error: `FFprobe exited with code ${code}` });
                    }
                });
                testProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    resolve({ success: false, error: err.message });
                });
            });
        });
    }
}
// -------------------------------------------
// SINGLETON EXPORT
// -------------------------------------------
exports.rtspProxy = new RtspProxyService();
exports.default = exports.rtspProxy;
