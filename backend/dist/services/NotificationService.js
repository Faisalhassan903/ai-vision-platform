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
exports.NotificationService = void 0;
const axios_1 = __importDefault(require("axios"));
const User_1 = __importDefault(require("../models/User"));
const IntelligentTelegramBot_1 = require("./IntelligentTelegramBot");
class NotificationService {
    // Send to a specific user by their userId
    static sendTelegramToUser(userId, alert) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield User_1.default.findById(userId);
                if (!(user === null || user === void 0 ? void 0 : user.telegramConnected) || !(user === null || user === void 0 ? void 0 : user.telegramChatId)) {
                    console.log(`⚠️ User ${userId} has no Telegram linked`);
                    return;
                }
                yield IntelligentTelegramBot_1.IntelligentTelegramBot.sendSecurityAlert(user.telegramChatId, {
                    priority: alert.priority,
                    ruleName: alert.ruleName,
                    message: alert.message,
                    cameraName: alert.cameraName,
                    alertId: alert._id.toString(),
                    detections: alert.detections,
                    snapshot: alert.snapshot
                });
                console.log(`✅ Alert sent to user ${user.email}`);
            }
            catch (error) {
                console.error('❌ sendTelegramToUser failed:', error.message);
            }
        });
    }
    // Broadcast to ALL users who have linked Telegram
    static broadcastTelegram(alert) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield User_1.default.find({
                    telegramConnected: true,
                    telegramChatId: { $ne: null }
                });
                if (users.length === 0) {
                    console.log('⚠️ No Telegram-linked users found');
                    return;
                }
                console.log(`📨 Sending to ${users.length} user(s)`);
                for (const user of users) {
                    yield IntelligentTelegramBot_1.IntelligentTelegramBot.sendSecurityAlert(user.telegramChatId, {
                        priority: alert.priority,
                        ruleName: alert.ruleName,
                        message: alert.message,
                        cameraName: alert.cameraName,
                        alertId: alert._id.toString(),
                        detections: alert.detections,
                        snapshot: alert.snapshot
                    });
                }
            }
            catch (error) {
                console.error('❌ broadcastTelegram failed:', error.message);
            }
        });
    }
    // Discord notification
    static sendDiscord(alert, webhookUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!webhookUrl) {
                console.log('⚠️ Discord webhook not configured');
                return;
            }
            try {
                yield axios_1.default.post(webhookUrl, {
                    embeds: [{
                            title: `${this.getPriorityEmoji(alert.priority)} ${alert.ruleName}`,
                            description: alert.message,
                            color: this.getPriorityColor(alert.priority),
                            fields: [
                                { name: 'Camera', value: alert.cameraName, inline: true },
                                { name: 'Priority', value: alert.priority.toUpperCase(), inline: true },
                                {
                                    name: 'Objects',
                                    value: alert.detections.map((d) => `${d.class} (${(d.confidence * 100).toFixed(1)}%)`).join('\n'),
                                    inline: false
                                }
                            ],
                            timestamp: alert.timestamp.toISOString(),
                            footer: { text: 'SENTRY AI' }
                        }]
                });
                console.log('✅ Discord notification sent');
            }
            catch (error) {
                console.error('❌ Discord failed:', error.message);
            }
        });
    }
    static getPriorityColor(priority) {
        switch (priority) {
            case 'critical': return 0xff0000;
            case 'warning': return 0xffa500;
            case 'info': return 0x0099ff;
            default: return 0x808080;
        }
    }
    static getPriorityEmoji(priority) {
        switch (priority) {
            case 'critical': return '🔴';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📌';
        }
    }
}
exports.NotificationService = NotificationService;
