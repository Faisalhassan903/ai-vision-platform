import axios from 'axios';
import { IAlert } from '../models/Alert';
import User from '../models/User';
import { IntelligentTelegramBot } from './IntelligentTelegramBot';

export class NotificationService {

  // Send to a specific user by their userId
  static async sendTelegramToUser(userId: string, alert: IAlert) {
    try {
      const user = await User.findById(userId);

      if (!user?.telegramConnected || !user?.telegramChatId) {
        console.log(`⚠️ User ${userId} has no Telegram linked`);
        return;
      }

      await IntelligentTelegramBot.sendSecurityAlert(user.telegramChatId, {
        priority: alert.priority,
        ruleName: alert.ruleName,
        message: alert.message,
        cameraName: alert.cameraName,
        alertId: alert._id.toString(),
        detections: alert.detections,
        snapshot: alert.snapshot
      });

      console.log(`✅ Alert sent to user ${user.email}`);
    } catch (error: any) {
      console.error('❌ sendTelegramToUser failed:', error.message);
    }
  }

  // Broadcast to ALL users who have linked Telegram
  static async broadcastTelegram(alert: IAlert) {
    try {
      const users = await User.find({
        telegramConnected: true,
        telegramChatId: { $ne: null }
      });

      if (users.length === 0) {
        console.log('⚠️ No Telegram-linked users found');
        return;
      }

      console.log(`📨 Sending to ${users.length} user(s)`);

      for (const user of users) {
        await IntelligentTelegramBot.sendSecurityAlert(user.telegramChatId!, {
          priority: alert.priority,
          ruleName: alert.ruleName,
          message: alert.message,
          cameraName: alert.cameraName,
          alertId: alert._id.toString(),
          detections: alert.detections,
          snapshot: alert.snapshot
        });
      }
    } catch (error: any) {
      console.error('❌ broadcastTelegram failed:', error.message);
    }
  }

  // Discord notification
  static async sendDiscord(alert: IAlert, webhookUrl?: string) {
    if (!webhookUrl) {
      console.log('⚠️ Discord webhook not configured');
      return;
    }
    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: `${this.getPriorityEmoji(alert.priority)} ${alert.ruleName}`,
          description: alert.message,
          color: this.getPriorityColor(alert.priority),
          fields: [
            { name: 'Camera', value: alert.cameraName, inline: true },
            { name: 'Priority', value: alert.priority.toUpperCase(), inline: true },
            {
              name: 'Objects',
              value: alert.detections.map((d: any) =>
                `${d.class} (${(d.confidence * 100).toFixed(1)}%)`
              ).join('\n'),
              inline: false
            }
          ],
          timestamp: alert.timestamp.toISOString(),
          footer: { text: 'SENTRY AI' }
        }]
      });
      console.log('✅ Discord notification sent');
    } catch (error: any) {
      console.error('❌ Discord failed:', error.message);
    }
  }

  private static getPriorityColor(priority: string): number {
    switch (priority) {
      case 'critical': return 0xff0000;
      case 'warning': return 0xffa500;
      case 'info': return 0x0099ff;
      default: return 0x808080;
    }
  }

  private static getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📌';
    }
  }
}