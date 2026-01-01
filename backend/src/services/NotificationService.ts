import axios from 'axios';
import { IAlert } from '../models/Alert';

export class NotificationService {
  
  // Send Discord notification
  static async sendDiscord(alert: IAlert, webhookUrl?: string) {
    if (!webhookUrl) {
      console.log('⚠️ Discord webhook URL not configured');
      return;
    }
    
    try {
      const emoji = this.getPriorityEmoji(alert.priority);
      const color = this.getPriorityColor(alert.priority);
      
      await axios.post(webhookUrl, {
        embeds: [{
          title: `${emoji} ${alert.ruleName}`,
          description: alert.message,
          color: color,
          fields: [
            {
              name: 'Camera',
              value: alert.cameraName,
              inline: true
            },
            {
              name: 'Priority',
              value: alert.priority.toUpperCase(),
              inline: true
            },
            {
              name: 'Objects',
              value: alert.detections.map(d => 
                `${d.class} (${(d.confidence * 100).toFixed(1)}%)`
              ).join('\n'),
              inline: false
            }
          ],
          timestamp: alert.timestamp.toISOString(),
          footer: {
            text: 'AI Vision Security'
          }
        }]
      });
      
      console.log('✅ Discord notification sent');
    } catch (error: any) {
      console.error('❌ Discord notification failed:', error.message);
    }
  }
  
  // Send email notification (placeholder)
  static async sendEmail(alert: IAlert, emailConfig?: any) {
    console.log('📧 Email notification:', alert.message);
    // TODO: Implement with nodemailer or SendGrid
  }
  
  // Get priority color for Discord
  private static getPriorityColor(priority: string): number {
    switch (priority) {
      case 'critical': return 0xff0000; // Red
      case 'warning': return 0xffa500;  // Orange
      case 'info': return 0x0099ff;     // Blue
      default: return 0x808080;         // Gray
    }
  }
  
  // Get priority emoji
  private static getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📌';
    }
  }
}