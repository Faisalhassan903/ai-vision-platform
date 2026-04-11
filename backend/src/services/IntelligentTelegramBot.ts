import TelegramBot from 'node-telegram-bot-api';
import Alert from '../models/Alert';
import Camera from '../models/Camera';
import AlertRule from '../models/AlertRule';
import User from '../models/User';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

export class IntelligentTelegramBot {
  
  private static userSessions = new Map<number, any>();
  
  static initialize() {
    console.log('🤖 Intelligent Telegram Bot starting...');
    
    // /start WITH token — links account
    bot.onText(/\/start (.+)/, (msg, match) => this.handleStartWithToken(msg, match));
    // /start alone
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
    
    console.log('✅ Intelligent Bot ready!');
  }

  // NEW: Link Telegram to user account via token
  private static async handleStartWithToken(
    msg: TelegramBot.Message,
    match: RegExpExecArray | null
  ) {
    const chatId = msg.chat.id;
    const token = match?.[1];

    try {
      const user = await User.findOne({ telegramLinkToken: token });

      if (!user) {
        await bot.sendMessage(chatId, '❌ Invalid or expired link. Please generate a new one from your dashboard.');
        return;
      }

      user.telegramChatId = chatId.toString();
      user.telegramConnected = true;
      user.telegramLinkToken = null;
      await user.save();

      await bot.sendMessage(chatId, `
🎉 *Telegram Successfully Linked!*

✅ Account: ${user.email}
🛡️ You will now receive YOUR security alerts here.

Use /help to see available commands.
      `.trim(), { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Token link error:', error);
      await bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
    }
  }

  // Generic /start
  private static async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `
🛡️ *Welcome to SENTRY\\_AI Security Bot*

To receive your personal alerts:
1. Log into your dashboard
2. Click *"Connect Telegram"*
3. Open the link it gives you

Already linked? Use /help to see commands.
    `.trim(), { parse_mode: 'Markdown' });
  }
  
  // Send alert to a specific user's chatId
  static async sendSecurityAlert(
    chatId: string,
    alertData: {
      priority: string;
      ruleName: string;
      message: string;
      cameraName: string;
      alertId: string;
      detections: any[];
      snapshot?: string;
    }
  ) {
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
        await bot.sendPhoto(chatId, buffer, { 
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
      
      console.log(`✅ Alert sent to chatId: ${chatId}`);
      
    } catch (error) {
      console.error(`❌ Failed to send alert to ${chatId}:`, error);
    }
  }

  // Broadcast to ALL connected users
  static async broadcastToAllUsers(alertData: any) {
    try {
      const users = await User.find({ 
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
          await this.sendSecurityAlert(user.telegramChatId, alertData);
        }
      }

    } catch (error) {
      console.error('❌ Broadcast error:', error);
    }
  }

  // /status
  private static async handleStatus(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const cameras = await Camera.find({});
      const alerts = await Alert.find({ acknowledged: false });
      const criticalAlerts = alerts.filter(a => a.priority === 'critical').length;
      const rules = await AlertRule.find({ enabled: true });

      const statusMsg = `
📊 *System Status*

✅ Status: Operational
📹 Cameras: ${cameras.length} active
🚨 Unacknowledged Alerts: ${alerts.length}
${criticalAlerts > 0 ? `🔴 Critical Alerts: ${criticalAlerts}\n` : ''}⚙️ Active Rules: ${rules.length}

_Last updated: ${new Date().toLocaleTimeString()}_
      `.trim();

      await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, '❌ Error fetching status.');
    }
  }

  // /cameras
  private static async handleCameras(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const cameras = await Camera.find({});
      if (cameras.length === 0) {
        await bot.sendMessage(chatId, 'ℹ️ No cameras configured yet.');
        return;
      }
      let list = '📹 *Camera List:*\n\n';
      cameras.forEach((cam, i) => {
        list += `${i + 1}. 🟢 *${cam.name}*\n`;
        list += `   ID: ${cam.cameraId}\n`;
        list += `   Location: ${cam.location || 'Not set'}\n\n`;
      });
      await bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, '❌ Error fetching cameras');
    }
  }

  // /alerts
  private static async handleAlerts(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts = await Alert.find({ timestamp: { $gte: today } })
        .sort({ timestamp: -1 }).limit(10);

      if (alerts.length === 0) {
        await bot.sendMessage(chatId, '✅ No alerts today. All systems secure! 🛡️');
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

      await bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, '❌ Error fetching alerts');
    }
  }

  // /rules
  private static async handleRules(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const rules = await AlertRule.find({});
      if (rules.length === 0) {
        await bot.sendMessage(chatId, 'ℹ️ No security rules configured.');
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
      await bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, '❌ Error fetching rules');
    }
  }

  // /stats
  private static async handleStats(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alerts = await Alert.find({ timestamp: { $gte: today } });
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
      await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
    } catch {
      await bot.sendMessage(chatId, '❌ Error generating statistics');
    }
  }

  // /help
  private static async handleHelp(msg: TelegramBot.Message) {
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
    await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  }

  // /test
  private static async handleTest(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    await this.sendSecurityAlert(chatId.toString(), {
      priority: 'warning',
      ruleName: 'System Test',
      message: '✅ Test alert — notifications are working!',
      cameraName: 'Test Camera',
      alertId: 'test_' + Date.now(),
      detections: [{ class: 'person', confidence: 0.95, bbox: {} }]
    });
  }

  // /arm
  private static async handleArm(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const result = await AlertRule.updateMany({}, { enabled: true });
    await bot.sendMessage(chatId, `✅ Armed ${result.modifiedCount} security rules. 🛡️`);
  }

  // /disarm
  private static async handleDisarm(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const result = await AlertRule.updateMany({}, { enabled: false });
    await bot.sendMessage(chatId, `⏸️ Paused ${result.modifiedCount} security rules.`);
  }

  // Callback buttons
  private static async handleCallback(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    if (!chatId) return;
    const data = query.data || '';

    try {
      if (data.startsWith('ack_')) {
        const alertId = data.replace('ack_', '');
        await Alert.findByIdAndUpdate(alertId, { acknowledged: true });
        await bot.answerCallbackQuery(query.id, { text: '✅ Alert acknowledged' });
        await bot.sendMessage(chatId, '✅ Alert acknowledged and logged.');
      } else if (data.startsWith('false_')) {
        const alertId = data.replace('false_', '');
        await Alert.findByIdAndUpdate(alertId, { 
          acknowledged: true, 
          notes: 'Marked as false alarm' 
        });
        await bot.answerCallbackQuery(query.id, { text: '✅ Marked as false alarm' });
        await bot.sendMessage(chatId, '✅ Marked as false alarm.');
      } else if (data.startsWith('info_')) {
        const alertId = data.replace('info_', '');
        const alert = await Alert.findById(alertId);
        if (alert) {
          const infoMsg = `
📋 *Alert Details*

*Rule:* ${alert.ruleName}
*Priority:* ${alert.priority.toUpperCase()}
*Camera:* ${alert.cameraName}
*Time:* ${new Date(alert.timestamp).toLocaleString()}
*Objects:* ${alert.detections.map((d: any) => `${d.class} (${(d.confidence * 100).toFixed(0)}%)`).join(', ')}
*Status:* ${alert.acknowledged ? '✅ Acknowledged' : '⏳ Pending'}
          `.trim();
          await bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
        }
      }
    } catch {
      await bot.answerCallbackQuery(query.id, { text: '❌ Error processing' });
    }
  }
}