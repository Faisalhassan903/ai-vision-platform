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
exports.IntelligentTelegramBot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const Alert_1 = __importDefault(require("../models/Alert"));
const Camera_1 = __importDefault(require("../models/Camera"));
const AlertRule_1 = __importDefault(require("../models/AlertRule"));
const User_1 = __importDefault(require("../models/User"));
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
// Create bot WITHOUT polling — we start it manually in initialize()
const bot = new node_telegram_bot_api_1.default(TELEGRAM_TOKEN, { polling: false });
class IntelligentTelegramBot {
    static initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            // Prevent running twice
            if (this.initialized) {
                console.log('⚠️ Bot already initialized, skipping');
                return;
            }
            console.log('🤖 Intelligent Telegram Bot starting...');
            try {
                // Delete webhook first — clears any conflicts
                yield bot.deleteWebHook();
                console.log('✅ Webhook cleared');
                // Stop any existing polling
                yield bot.stopPolling();
                // Wait a moment then start fresh
                yield new Promise(resolve => setTimeout(resolve, 1000));
                yield bot.startPolling();
                console.log('✅ Polling started');
            }
            catch (err) {
                console.log('⚠️ Polling reset error (non-fatal):', err);
            }
            // Register handlers
            bot.onText(/\/start (.+)/, (msg, match) => this.handleStartWithToken(msg, match));
            bot.onText(/\/start$/, (msg) => this.handleStart(msg));
            bot.onText(/\/status/, (msg) => this.handleStatus(msg));
            bot.onText(/\/cameras/, (msg) => this.handleCameras(msg));
            bot.onText(/\/alerts/, (msg) => this.handleAlerts(msg));
            bot.onText(/\/rules/, (msg) => this.handleRules(msg));
            bot.onText(/\/arm/, (msg) => this.handleArm(msg));
            bot.onText(/\/disarm/, (msg) => this.handleDisarm(msg));
            bot.onText(/\/test/, (msg) => this.handleTest(msg));
            bot.onText(/\/stats/, (msg) => this.handleStats(msg));
            bot.onText(/\/help/, (msg) => this.handleHelp(msg));
            bot.on('callback_query', (query) => this.handleCallback(query));
            // Suppress polling error noise
            bot.on('polling_error', (error) => {
                var _a;
                if ((error === null || error === void 0 ? void 0 : error.code) === 'ETELEGRAM' && ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('409'))) {
                    console.log('⚠️ Telegram 409 — another instance still shutting down, retrying...');
                }
                else {
                    console.error('❌ Polling error:', error === null || error === void 0 ? void 0 : error.message);
                }
            });
            this.initialized = true;
            console.log('✅ Intelligent Bot ready!');
        });
    }
    // ... rest of your file stays exactly the same
    // NEW: Link Telegram to user account via token
    static handleStartWithToken(msg, match) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const token = match === null || match === void 0 ? void 0 : match[1];
            try {
                const user = yield User_1.default.findOne({ telegramLinkToken: token });
                if (!user) {
                    yield bot.sendMessage(chatId, '❌ Invalid or expired link. Please generate a new one from your dashboard.');
                    return;
                }
                user.telegramChatId = chatId.toString();
                user.telegramConnected = true;
                user.telegramLinkToken = null;
                yield user.save();
                yield bot.sendMessage(chatId, `
🎉 *Telegram Successfully Linked!*

✅ Account: ${user.email}
🛡️ You will now receive YOUR security alerts here.

Use /help to see available commands.
      `.trim(), { parse_mode: 'Markdown' });
            }
            catch (error) {
                console.error('❌ Token link error:', error);
                yield bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
            }
        });
    }
    // Generic /start
    static handleStart(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            yield bot.sendMessage(chatId, `
🛡️ *Welcome to SENTRY\\_AI Security Bot*

To receive your personal alerts:
1. Log into your dashboard
2. Click *"Connect Telegram"*
3. Open the link it gives you

Already linked? Use /help to see commands.
    `.trim(), { parse_mode: 'Markdown' });
        });
    }
    // Send alert to a specific user's chatId
    static sendSecurityAlert(chatId, alertData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const emoji = alertData.priority === 'critical' ? '🔴' :
                    alertData.priority === 'warning' ? '⚠️' : 'ℹ️';
                const detectedObjects = alertData.detections
                    .map(d => `${d.class} (${(d.confidence * 100).toFixed(0)}%)`)
                    .join(', ');
                const caption = `
${emoji} *SECURITY ALERT*

*Rule:* ${alertData.ruleName}
*Priority:* ${alertData.priority.toUpperCase()}
*Camera:* ${alertData.cameraName}
*Detected:* ${detectedObjects}
*Time:* ${new Date().toLocaleTimeString()}

${alertData.message}
      `.trim();
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '✅ Acknowledge', callback_data: `ack_${alertData.alertId}` },
                            { text: '❌ False Alarm', callback_data: `false_${alertData.alertId}` }
                        ],
                        [
                            { text: '📊 More Info', callback_data: `info_${alertData.alertId}` }
                        ]
                    ]
                };
                if (alertData.snapshot) {
                    const imageData = alertData.snapshot.replace(/^data:image\/\w+;base64,/, '');
                    const buffer = Buffer.from(imageData, 'base64');
                    yield bot.sendPhoto(chatId, buffer, {
                        caption,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
                else {
                    yield bot.sendMessage(chatId, caption, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
                console.log(`✅ Alert sent to chatId: ${chatId}`);
            }
            catch (error) {
                console.error(`❌ Failed to send alert to ${chatId}:`, error);
            }
        });
    }
    // Broadcast to ALL connected users
    static broadcastToAllUsers(alertData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield User_1.default.find({
                    telegramConnected: true,
                    telegramChatId: { $ne: null }
                });
                if (users.length === 0) {
                    console.log('⚠️ No users have linked Telegram yet');
                    return;
                }
                console.log(`📨 Broadcasting alert to ${users.length} user(s)`);
                for (const user of users) {
                    if (user.telegramChatId) {
                        yield this.sendSecurityAlert(user.telegramChatId, alertData);
                    }
                }
            }
            catch (error) {
                console.error('❌ Broadcast error:', error);
            }
        });
    }
    // /status
    static handleStatus(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const cameras = yield Camera_1.default.find({});
                const alerts = yield Alert_1.default.find({ acknowledged: false });
                const criticalAlerts = alerts.filter(a => a.priority === 'critical').length;
                const rules = yield AlertRule_1.default.find({ enabled: true });
                const statusMsg = `
📊 *System Status*

✅ Status: Operational
📹 Cameras: ${cameras.length} active
🚨 Unacknowledged Alerts: ${alerts.length}
${criticalAlerts > 0 ? `🔴 Critical Alerts: ${criticalAlerts}\n` : ''}⚙️ Active Rules: ${rules.length}

_Last updated: ${new Date().toLocaleTimeString()}_
      `.trim();
                yield bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
            }
            catch (_a) {
                yield bot.sendMessage(chatId, '❌ Error fetching status.');
            }
        });
    }
    // /cameras
    static handleCameras(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const cameras = yield Camera_1.default.find({});
                if (cameras.length === 0) {
                    yield bot.sendMessage(chatId, 'ℹ️ No cameras configured yet.');
                    return;
                }
                let list = '📹 *Camera List:*\n\n';
                cameras.forEach((cam, i) => {
                    list += `${i + 1}. 🟢 *${cam.name}*\n`;
                    list += `   ID: ${cam.cameraId}\n`;
                    list += `   Location: ${cam.location || 'Not set'}\n\n`;
                });
                yield bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
            }
            catch (_a) {
                yield bot.sendMessage(chatId, '❌ Error fetching cameras');
            }
        });
    }
    // /alerts
    static handleAlerts(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const alerts = yield Alert_1.default.find({ timestamp: { $gte: today } })
                    .sort({ timestamp: -1 }).limit(10);
                if (alerts.length === 0) {
                    yield bot.sendMessage(chatId, '✅ No alerts today. All systems secure! 🛡️');
                    return;
                }
                let list = `🚨 *Today's Alerts (${alerts.length}):*\n\n`;
                alerts.forEach((alert, i) => {
                    const emoji = alert.priority === 'critical' ? '🔴' : alert.priority === 'warning' ? '⚠️' : 'ℹ️';
                    const time = new Date(alert.timestamp).toLocaleTimeString();
                    const ack = alert.acknowledged ? '✅' : '⏳';
                    list += `${i + 1}. ${emoji} ${ack} *${alert.ruleName}*\n`;
                    list += `   Time: ${time}\n`;
                    list += `   Camera: ${alert.cameraName}\n\n`;
                });
                yield bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
            }
            catch (_a) {
                yield bot.sendMessage(chatId, '❌ Error fetching alerts');
            }
        });
    }
    // /rules
    static handleRules(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const rules = yield AlertRule_1.default.find({});
                if (rules.length === 0) {
                    yield bot.sendMessage(chatId, 'ℹ️ No security rules configured.');
                    return;
                }
                let list = '⚙️ *Security Rules:*\n\n';
                rules.forEach((rule, i) => {
                    const status = rule.enabled ? '✅ Active' : '⏸️ Paused';
                    const emoji = rule.priority === 'critical' ? '🔴' : rule.priority === 'warning' ? '⚠️' : 'ℹ️';
                    list += `${i + 1}. ${emoji} *${rule.name}* (${status})\n`;
                    list += `   Detects: ${rule.conditions.objectClasses.slice(0, 3).join(', ')}\n`;
                    list += `   Confidence: ${(rule.conditions.minConfidence * 100).toFixed(0)}%\n\n`;
                });
                yield bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
            }
            catch (_a) {
                yield bot.sendMessage(chatId, '❌ Error fetching rules');
            }
        });
    }
    // /stats
    static handleStats(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const alerts = yield Alert_1.default.find({ timestamp: { $gte: today } });
                const statsMsg = `
📊 *Today's Statistics*

🚨 Total Alerts: ${alerts.length}
🔴 Critical: ${alerts.filter(a => a.priority === 'critical').length}
⚠️ Warning: ${alerts.filter(a => a.priority === 'warning').length}
ℹ️ Info: ${alerts.filter(a => a.priority === 'info').length}

✅ Acknowledged: ${alerts.filter(a => a.acknowledged).length}
⏳ Pending: ${alerts.filter(a => !a.acknowledged).length}

_Generated at ${new Date().toLocaleTimeString()}_
      `.trim();
                yield bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
            }
            catch (_a) {
                yield bot.sendMessage(chatId, '❌ Error generating statistics');
            }
        });
    }
    // /help
    static handleHelp(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const helpMsg = `
🤖 *SENTRY\\_AI Bot Commands*

*📊 Monitoring:*
/status - System status
/cameras - List cameras
/alerts - Today's alerts
/rules - Security rules
/stats - Statistics

*⚙️ Control:*
/arm - Enable all rules
/disarm - Pause all rules
/test - Send test alert

/help - Show this message
    `.trim();
            yield bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
        });
    }
    // /test
    static handleTest(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            yield this.sendSecurityAlert(chatId.toString(), {
                priority: 'warning',
                ruleName: 'System Test',
                message: '✅ Test alert — notifications are working!',
                cameraName: 'Test Camera',
                alertId: 'test_' + Date.now(),
                detections: [{ class: 'person', confidence: 0.95, bbox: {} }]
            });
        });
    }
    // /arm
    static handleArm(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const result = yield AlertRule_1.default.updateMany({}, { enabled: true });
            yield bot.sendMessage(chatId, `✅ Armed ${result.modifiedCount} security rules. 🛡️`);
        });
    }
    // /disarm
    static handleDisarm(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const result = yield AlertRule_1.default.updateMany({}, { enabled: false });
            yield bot.sendMessage(chatId, `⏸️ Paused ${result.modifiedCount} security rules.`);
        });
    }
    // Callback buttons
    static handleCallback(query) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const chatId = (_a = query.message) === null || _a === void 0 ? void 0 : _a.chat.id;
            if (!chatId)
                return;
            const data = query.data || '';
            try {
                if (data.startsWith('ack_')) {
                    const alertId = data.replace('ack_', '');
                    yield Alert_1.default.findByIdAndUpdate(alertId, { acknowledged: true });
                    yield bot.answerCallbackQuery(query.id, { text: '✅ Alert acknowledged' });
                    yield bot.sendMessage(chatId, '✅ Alert acknowledged and logged.');
                }
                else if (data.startsWith('false_')) {
                    const alertId = data.replace('false_', '');
                    yield Alert_1.default.findByIdAndUpdate(alertId, {
                        acknowledged: true,
                        notes: 'Marked as false alarm'
                    });
                    yield bot.answerCallbackQuery(query.id, { text: '✅ Marked as false alarm' });
                    yield bot.sendMessage(chatId, '✅ Marked as false alarm.');
                }
                else if (data.startsWith('info_')) {
                    const alertId = data.replace('info_', '');
                    const alert = yield Alert_1.default.findById(alertId);
                    if (alert) {
                        const infoMsg = `
📋 *Alert Details*

*Rule:* ${alert.ruleName}
*Priority:* ${alert.priority.toUpperCase()}
*Camera:* ${alert.cameraName}
*Time:* ${new Date(alert.timestamp).toLocaleString()}
*Objects:* ${alert.detections.map((d) => `${d.class} (${(d.confidence * 100).toFixed(0)}%)`).join(', ')}
*Status:* ${alert.acknowledged ? '✅ Acknowledged' : '⏳ Pending'}
          `.trim();
                        yield bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
                    }
                }
            }
            catch (_b) {
                yield bot.answerCallbackQuery(query.id, { text: '❌ Error processing' });
            }
        });
    }
}
exports.IntelligentTelegramBot = IntelligentTelegramBot;
IntelligentTelegramBot.initialized = false; // prevent double init
IntelligentTelegramBot.userSessions = new Map();
