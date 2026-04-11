"use strict";
// ===========================================
// LIVE ROUTES - UPDATED WITH ZONE SUPPORT
// ===========================================
// Add this zone-intrusion handler to your existing liveRoutes.ts
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
exports.setupLiveRoutes = setupLiveRoutes;
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
const Detection_1 = __importDefault(require("../models/Detection"));
const AlertEngine_1 = require("../services/AlertEngine");
const NotificationService_1 = require("../services/NotificationService");
let processingQueue = 0;
// Rate limiter for zone intrusion alerts
const zoneAlertCooldown = new Map();
const ZONE_ALERT_COOLDOWN_MS = 15000; // 15 seconds
function setupLiveRoutes(io) {
    io.on('connection', (socket) => {
        console.log('🎥 Camera client connected:', socket.id);
        // -------------------------------------------
        // VIDEO FRAME PROCESSING (existing)
        // -------------------------------------------
        socket.on('video-frame', (data) => __awaiter(this, void 0, void 0, function* () {
            if (processingQueue > 2) {
                console.log('⏸️ Skipping frame (queue full)');
                return;
            }
            processingQueue++;
            try {
                const base64Data = data.frame.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const formData = new form_data_1.default();
                formData.append('image', buffer, {
                    filename: 'frame.jpg',
                    contentType: 'image/jpeg'
                });
                const aiResponse = yield axios_1.default.post('http://localhost:5001/detect-live', formData, {
                    headers: Object.assign({}, formData.getHeaders()),
                    timeout: 3000
                });
                const detections = aiResponse.data.detections || [];
                const totalObjects = aiResponse.data.total_objects || 0;
                // Log detections
                if (detections.length > 0) {
                    console.log('✅ AI:', detections.map((d) => `${d.class}(${(d.confidence * 100).toFixed(0)}%)`).join(', '));
                }
                socket.emit('detections', {
                    detections: detections,
                    totalObjects: totalObjects,
                    timestamp: Date.now(),
                    processingTime: aiResponse.data.processing_time || 0
                });
                if (totalObjects > 0) {
                    saveDetectionAsync(data.cameraId, detections, totalObjects);
                }
                // Alert evaluation via existing AlertEngine
                if (detections.length > 0) {
                    const alerts = yield AlertEngine_1.AlertEngine.evaluateDetection(data.cameraId, 'Live Webcam', detections, data.frame);
                    if (alerts.length > 0) {
                        console.log('🚨 ALERTS TRIGGERED:', alerts.length);
                        alerts.forEach(alert => {
                            // Emit to ALL connected clients
                            io.emit('alert-triggered', {
                                alert: {
                                    _id: alert._id,
                                    ruleName: alert.ruleName,
                                    priority: alert.priority,
                                    message: alert.message,
                                    cameraName: alert.cameraName,
                                    detections: alert.detections,
                                    timestamp: alert.timestamp,
                                    acknowledged: alert.acknowledged
                                },
                                priority: alert.priority,
                                message: alert.message
                            });
                            // Telegram notification via IntelligentTelegramBot
                            const telegramChatId = process.env.TELEGRAM_CHAT_ID;
                            if (telegramChatId) {
                                try {
                                    const { IntelligentTelegramBot } = require('../services/IntelligentTelegramBot');
                                    IntelligentTelegramBot.sendSecurityAlert(telegramChatId, {
                                        priority: alert.priority,
                                        ruleName: alert.ruleName,
                                        message: alert.message,
                                        cameraName: alert.cameraName,
                                        alertId: alert._id.toString(),
                                        detections: detections,
                                        snapshot: data.frame
                                    });
                                }
                                catch (e) {
                                    console.error('Telegram error:', e.message);
                                }
                            }
                            // Discord notification
                            const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
                            if (alert.priority === 'critical' && discordWebhook) {
                                NotificationService_1.NotificationService.sendDiscord(alert, discordWebhook);
                            }
                        });
                    }
                }
            }
            catch (error) {
                if (error.code !== 'ECONNABORTED') {
                    console.error('❌ Frame error:', error.message);
                }
            }
            finally {
                processingQueue--;
            }
        }));
        // -------------------------------------------
        // NEW: ZONE INTRUSION HANDLER
        // -------------------------------------------
        socket.on('zone-intrusion', (data) => __awaiter(this, void 0, void 0, function* () {
            const alertKey = `zone-${data.cameraId}-${data.zoneName}`;
            const lastAlert = zoneAlertCooldown.get(alertKey);
            const now = Date.now();
            // Check cooldown
            if (lastAlert && now - lastAlert < ZONE_ALERT_COOLDOWN_MS) {
                console.log(`⏸️ Zone alert on cooldown: ${data.zoneName}`);
                return;
            }
            zoneAlertCooldown.set(alertKey, now);
            console.log(`🚷 ZONE INTRUSION: ${data.zoneName} (${(data.confidence * 100).toFixed(0)}%)`);
            // Send Telegram notification
            const telegramChatId = process.env.TELEGRAM_CHAT_ID;
            if (telegramChatId) {
                try {
                    const { IntelligentTelegramBot } = require('../services/IntelligentTelegramBot');
                    yield IntelligentTelegramBot.sendSecurityAlert(telegramChatId, {
                        priority: 'critical',
                        ruleName: `🚷 ZONE INTRUSION: ${data.zoneName}`,
                        message: `⚠️ Unauthorized person detected in restricted zone "${data.zoneName}"`,
                        cameraName: data.cameraId === 'webcam-01' ? 'Main Camera' : data.cameraId,
                        alertId: `zone-${Date.now()}`,
                        detections: [{
                                class: 'person',
                                confidence: data.confidence,
                                bbox: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 }
                            }]
                    });
                    console.log('✅ Telegram zone alert sent!');
                }
                catch (e) {
                    console.error('❌ Telegram zone alert failed:', e.message);
                }
            }
            // Broadcast to all clients
            io.emit('zone-alert-broadcast', {
                type: 'zone_intrusion',
                zoneName: data.zoneName,
                cameraId: data.cameraId,
                confidence: data.confidence,
                timestamp: data.timestamp
            });
        }));
        // -------------------------------------------
        // TEST TELEGRAM HANDLER
        // -------------------------------------------
        socket.on('test-telegram', () => __awaiter(this, void 0, void 0, function* () {
            console.log('🧪 Testing Telegram...');
            const telegramChatId = process.env.TELEGRAM_CHAT_ID;
            if (!telegramChatId) {
                socket.emit('telegram-test-result', {
                    success: false,
                    message: 'TELEGRAM_CHAT_ID not configured'
                });
                return;
            }
            try {
                const { IntelligentTelegramBot } = require('../services/IntelligentTelegramBot');
                yield IntelligentTelegramBot.sendSecurityAlert(telegramChatId, {
                    priority: 'info',
                    ruleName: '🧪 Test Alert',
                    message: 'This is a test notification from SENTRY AI monitoring system.',
                    cameraName: 'System Test',
                    alertId: `test-${Date.now()}`,
                    detections: []
                });
                socket.emit('telegram-test-result', {
                    success: true,
                    message: 'Test message sent successfully!'
                });
                console.log('✅ Telegram test sent!');
            }
            catch (e) {
                socket.emit('telegram-test-result', {
                    success: false,
                    message: e.message
                });
                console.error('❌ Telegram test failed:', e.message);
            }
        }));
        // -------------------------------------------
        // DISCONNECT
        // -------------------------------------------
        socket.on('disconnect', () => {
            console.log('🎥 Camera client disconnected:', socket.id);
        });
    });
}
// -------------------------------------------
// SAVE DETECTION TO DB
// -------------------------------------------
function saveDetectionAsync(cameraId, detections, totalObjects) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const detectionRecord = new Detection_1.default({
                timestamp: new Date(),
                cameraId: cameraId,
                cameraName: cameraId === 'webcam-01' ? 'Live Webcam' : cameraId,
                detections: detections.map((det) => ({
                    class: det.class,
                    confidence: det.confidence,
                    bbox: det.bbox
                })),
                totalObjects: totalObjects,
                alertSent: false
            });
            yield detectionRecord.save();
        }
        catch (error) {
            console.error('❌ Failed to save detection:', error.message);
        }
    });
}
