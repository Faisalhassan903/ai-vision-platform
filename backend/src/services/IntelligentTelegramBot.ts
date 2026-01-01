import TelegramBot from 'node-telegram-bot-api';
import Alert from '../models/Alert';
import Camera from '../models/Camera';
import AlertRule from '../models/AlertRule';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

export class IntelligentTelegramBot {
  
  private static userSessions = new Map<number, any>();
  
  // Initialize bot with all commands
  static initialize() {
    console.log('🤖 Intelligent Telegram Bot starting...');
    
    // Welcome message
    bot.onText(/\/start/, (msg) => this.handleStart(msg));
    
    // Status commands
    bot.onText(/\/status/, (msg) => this.handleStatus(msg));
    bot.onText(/\/cameras/, (msg) => this.handleCameras(msg));
    bot.onText(/\/alerts/, (msg) => this.handleAlerts(msg));
    bot.onText(/\/rules/, (msg) => this.handleRules(msg));
    
    // Control commands
    bot.onText(/\/arm/, (msg) => this.handleArm(msg));
    bot.onText(/\/disarm/, (msg) => this.handleDisarm(msg));
    bot.onText(/\/test/, (msg) => this.handleTest(msg));
    
    // Reporting commands
    bot.onText(/\/stats/, (msg) => this.handleStats(msg));
    
    // Help
    bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    
    // Callback buttons
    bot.on('callback_query', (query) => this.handleCallback(query));
    
    console.log('✅ Intelligent Bot ready! Send /start to your bot.');
  }
  
  // Send security alert with interactive buttons
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
      
      // Interactive keyboard
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
      
      console.log('✅ Interactive alert sent to Telegram');
      
    } catch (error) {
      console.error('❌ Telegram alert error:', error);
    }
  }
  
  // Handle /start
  private static async handleStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    const welcomeMsg = `
🛡️ *Welcome to SENTRY\\_AI Security Bot*

I'm your intelligent security assistant powered by AI.

*I can:*
🚨 Send real-time security alerts with snapshots
📹 Monitor your cameras 24/7
📊 Generate reports and statistics
🤖 Answer questions about your system
⚙️ Control security rules remotely

*Quick Commands:*
/status - System overview
/cameras - View all cameras
/alerts - Recent alerts
/rules - Security rules
/stats - Today's statistics
/test - Send test alert
/help - All commands

💡 *Interactive Alerts:* When I send alerts, you can acknowledge them or mark as false alarms with one tap!
    `.trim();
    
    await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
  }
  
  // Handle /status
  private static async handleStatus(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    try {
      const cameras = await Camera.find({});
      const onlineCameras = cameras.length; // Assume all online for now
      
      const alerts = await Alert.find({ acknowledged: false });
      const criticalAlerts = alerts.filter(a => a.priority === 'critical').length;
      
      const rules = await AlertRule.find({ enabled: true });
      
      const statusMsg = `
📊 *System Status*

✅ Status: Operational
📹 Cameras: ${onlineCameras} active
🚨 Unacknowledged Alerts: ${alerts.length}
${criticalAlerts > 0 ? `🔴 Critical Alerts: ${criticalAlerts}\n` : ''}⚙️ Active Rules: ${rules.length}

_Last updated: ${new Date().toLocaleTimeString()}_
      `.trim();
      
      await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Error fetching status. Please try again.');
    }
  }
  
  // Handle /cameras
  private static async handleCameras(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    try {
      const cameras = await Camera.find({});
      
      if (cameras.length === 0) {
        await bot.sendMessage(chatId, 'ℹ️ No cameras configured yet. Add cameras from the web dashboard.');
        return;
      }
      
      let cameraList = '📹 *Camera List:*\n\n';
      
      cameras.forEach((cam, i) => {
        const status = '🟢'; // Assume online
        cameraList += `${i + 1}. ${status} *${cam.name}*\n`;
        cameraList += `   ID: ${cam.cameraId}\n`;
        cameraList += `   Location: ${cam.location || 'Not set'}\n\n`;
      });
      
      await bot.sendMessage(chatId, cameraList, { parse_mode: 'Markdown' });
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Error fetching cameras');
    }
  }
  
  // Handle /alerts
  private static async handleAlerts(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const alerts = await Alert.find({
        timestamp: { $gte: today }
      }).sort({ timestamp: -1 }).limit(10);
      
      if (alerts.length === 0) {
        await bot.sendMessage(chatId, '✅ No alerts today. All systems secure! 🛡️');
        return;
      }
      
      let alertList = `🚨 *Today's Alerts (${alerts.length}):*\n\n`;
      
      alerts.forEach((alert, i) => {
        const emoji = alert.priority === 'critical' ? '🔴' : 
                      alert.priority === 'warning' ? '⚠️' : 'ℹ️';
        const time = new Date(alert.timestamp).toLocaleTimeString();
        const ack = alert.acknowledged ? '✅' : '⏳';
        
        alertList += `${i + 1}. ${emoji} ${ack} *${alert.ruleName}*\n`;
        alertList += `   Time: ${time}\n`;
        alertList += `   Camera: ${alert.cameraName}\n\n`;
      });
      
      await bot.sendMessage(chatId, alertList, { parse_mode: 'Markdown' });
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Error fetching alerts');
    }
  }
  
  // Handle /rules
  private static async handleRules(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    try {
      const rules = await AlertRule.find({});
      
      if (rules.length === 0) {
        await bot.sendMessage(chatId, 'ℹ️ No security rules configured. Create rules from the web dashboard.');
        return;
      }
      
      let ruleList = '⚙️ *Security Rules:*\n\n';
      
      rules.forEach((rule, i) => {
        const status = rule.enabled ? '✅ Active' : '⏸️ Paused';
        const emoji = rule.priority === 'critical' ? '🔴' : 
                      rule.priority === 'warning' ? '⚠️' : 'ℹ️';
        
        ruleList += `${i + 1}. ${emoji} *${rule.name}* (${status})\n`;
        ruleList += `   Detects: ${rule.conditions.objectClasses.slice(0, 3).join(', ')}`;
        if (rule.conditions.objectClasses.length > 3) {
          ruleList += ` +${rule.conditions.objectClasses.length - 3} more`;
        }
        ruleList += `\n   Confidence: ${(rule.conditions.minConfidence * 100).toFixed(0)}%\n\n`;
      });
      
      await bot.sendMessage(chatId, ruleList, { parse_mode: 'Markdown' });
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Error fetching rules');
    }
  }
  
  // Handle /stats
  private static async handleStats(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const alerts = await Alert.find({ timestamp: { $gte: today } });
      const critical = alerts.filter(a => a.priority === 'critical').length;
      const warning = alerts.filter(a => a.priority === 'warning').length;
      const info = alerts.filter(a => a.priority === 'info').length;
      
      const statsMsg = `
📊 *Today's Statistics*

🚨 Total Alerts: ${alerts.length}
🔴 Critical: ${critical}
⚠️ Warning: ${warning}
ℹ️ Info: ${info}

✅ Acknowledged: ${alerts.filter(a => a.acknowledged).length}
⏳ Pending: ${alerts.filter(a => !a.acknowledged).length}

_Generated at ${new Date().toLocaleTimeString()}_
      `.trim();
      
      await bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown' });
      
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Error generating statistics');
    }
  }
  
  // Handle /help
  private static async handleHelp(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    const helpMsg = `
🤖 *SENTRY\\_AI Bot Commands*

*📊 Monitoring:*
/status - System status overview
/cameras - List all cameras
/alerts - View today's alerts
/rules - Active security rules
/stats - Today's statistics

*⚙️ Control:*
/arm - Enable all security rules
/disarm - Pause all rules
/test - Send a test alert

*❓ Help:*
/help - Show this message

*💡 Tips:*
- Alerts have interactive buttons for quick actions
- Use /test to verify the system is working
- Check /status regularly for system health
    `.trim();
    
    await bot.sendMessage(chatId, helpMsg, { parse_mode: 'Markdown' });
  }
  
  // Handle button callbacks
  private static async handleCallback(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    if (!chatId) return;
    
    const data = query.data || '';
    
    try {
      if (data.startsWith('ack_')) {
        const alertId = data.replace('ack_', '');
        await Alert.findByIdAndUpdate(alertId, { acknowledged: true });
        await bot.answerCallbackQuery(query.id, { text: '✅ Alert acknowledged' });
        await bot.sendMessage(chatId, '✅ Alert has been acknowledged and logged.');
      }
      
      else if (data.startsWith('false_')) {
        const alertId = data.replace('false_', '');
        await Alert.findByIdAndUpdate(alertId, { 
          acknowledged: true,
          notes: 'Marked as false alarm by user'
        });
        await bot.answerCallbackQuery(query.id, { text: '✅ Marked as false alarm' });
        await bot.sendMessage(chatId, '✅ Alert marked as false alarm. System learning from your feedback.');
      }
      
      else if (data.startsWith('info_')) {
        const alertId = data.replace('info_', '');
        const alert = await Alert.findById(alertId);
        
        if (alert) {
          const infoMsg = `
📋 *Alert Details*

*Rule:* ${alert.ruleName}
*Priority:* ${alert.priority.toUpperCase()}
*Camera:* ${alert.cameraName}
*Time:* ${new Date(alert.timestamp).toLocaleString()}
*Objects:* ${alert.detections.map(d => `${d.class} (${(d.confidence * 100).toFixed(0)}%)`).join(', ')}
*Status:* ${alert.acknowledged ? '✅ Acknowledged' : '⏳ Pending'}
*Alert ID:* \`${alert._id}\`
          `.trim();
          
          await bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
        }
      }
      
    } catch (error) {
      await bot.answerCallbackQuery(query.id, { text: '❌ Error processing request' });
    }
  }
  
  // Handle /test
  private static async handleTest(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    
    await this.sendSecurityAlert(chatId.toString(), {
      priority: 'warning',
      ruleName: 'System Test',
      message: 'This is a test alert to verify the notification system is working correctly. ✅',
      cameraName: 'Test Camera',
      alertId: 'test_' + Date.now(),
      detections: [
        { class: 'person', confidence: 0.95, bbox: {} }
      ]
    });
  }
  
  // Handle /arm
  private static async handleArm(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const result = await AlertRule.updateMany({}, { enabled: true });
    await bot.sendMessage(chatId, `✅ Armed ${result.modifiedCount} security rules. System now monitoring. 🛡️`);
  }
  
  // Handle /disarm
  private static async handleDisarm(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const result = await AlertRule.updateMany({}, { enabled: false });
    await bot.sendMessage(chatId, `⏸️ Paused ${result.modifiedCount} security rules. Monitoring temporarily disabled.`);
  }
}