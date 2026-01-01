import AlertRule, { IAlertRule } from '../models/AlertRule';
import Alert from '../models/Alert';

interface Detection {
  class: string;
  confidence: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export class AlertEngine {
  
  // Evaluate if detection triggers any rules
  static async evaluateDetection(
    cameraId: string,
    cameraName: string,
    detections: Detection[],
    frameData?: string
  ) {
    try {
      // Get all enabled rules
      const rules = await AlertRule.find({ enabled: true });
      
      const triggeredAlerts = [];
      
      for (const rule of rules) {
        // Check if rule should be triggered
        if (await this.shouldTrigger(rule, detections)) {
          
          // Check cooldown
          if (this.isInCooldown(rule)) {
            console.log(`⏸️ Rule "${rule.name}" in cooldown`);
            continue;
          }
          
          // Create alert
          const alert = await this.createAlert(
            rule,
            cameraId,
            cameraName,
            detections,
            frameData
          );
          
          // Update rule
          rule.lastTriggered = new Date();
          rule.triggerCount += 1;
          await rule.save();
          
          triggeredAlerts.push(alert);
          
          console.log(`🚨 Alert triggered: ${rule.name} (${rule.priority})`);
        }
      }
      
      return triggeredAlerts;
    } catch (error) {
      console.error('❌ AlertEngine error:', error);
      return [];
    }
  }
  
  // Check if detection matches rule conditions
  private static async shouldTrigger(
    rule: IAlertRule,
    detections: Detection[]
  ): Promise<boolean> {
    
    try {
      for (const detection of detections) {
        // Check object class
        if (!rule.conditions.objectClasses.includes(detection.class)) {
          continue;
        }
        
        // Check confidence
        if (detection.confidence < rule.conditions.minConfidence) {
          console.log(`  ⏭️ ${detection.class} confidence too low: ${(detection.confidence * 100).toFixed(0)}% < ${(rule.conditions.minConfidence * 100).toFixed(0)}%`);
          continue;
        }
        
        // Check time range
        if (rule.conditions.timeRange) {
          if (!this.isInTimeRange(rule.conditions.timeRange)) {
            console.log(`  ⏭️ Outside time range for rule: ${rule.name}`);
            continue;
          }
        }
        
        // Check zones (if defined)
        if (rule.conditions.zones && rule.conditions.zones.length > 0) {
          if (!this.isInZone(detection.bbox, rule.conditions.zones)) {
            console.log(`  ⏭️ Outside zone for rule: ${rule.name}`);
            continue;
          }
        }
        
        // All conditions met!
        console.log(`  ✅ Rule matched: ${rule.name} for ${detection.class}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error in shouldTrigger:', error);
      return false;
    }
  }
  
  // Check if current time is in range
  private static isInTimeRange(timeRange: { start: string; end: string }): boolean {
    // Safety check
    if (!timeRange || !timeRange.start || !timeRange.end) {
      console.warn('⚠️ Invalid time range:', timeRange);
      return true; // If invalid, always allow
    }

    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = timeRange.start.split(':').map(Number);
      const [endHour, endMin] = timeRange.end.split(':').map(Number);
      
      // Check if parsing failed
      if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
        console.warn('⚠️ Invalid time values in range');
        return true;
      }
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      // Handle overnight ranges (e.g., 22:00 - 06:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      }
      
      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      console.error('❌ Error checking time range:', error);
      return true; // On error, allow alert
    }
  }
  
  // Check if detection is in any zone
  private static isInZone(
    bbox: { x1: number; y1: number; x2: number; y2: number },
    zones: Array<{ x1: number; y1: number; x2: number; y2: number }>
  ): boolean {
    
    try {
      const centerX = (bbox.x1 + bbox.x2) / 2;
      const centerY = (bbox.y1 + bbox.y2) / 2;
      
      for (const zone of zones) {
        if (
          centerX >= zone.x1 &&
          centerX <= zone.x2 &&
          centerY >= zone.y1 &&
          centerY <= zone.y2
        ) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking zone:', error);
      return true; // On error, allow alert
    }
  }
  
  // Check if rule is in cooldown period
  private static isInCooldown(rule: IAlertRule): boolean {
    try {
      if (!rule.lastTriggered) return false;
      
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
      
      return timeSinceLastTrigger < cooldownMs;
    } catch (error) {
      console.error('❌ Error checking cooldown:', error);
      return false; // On error, allow alert
    }
  }
  
  // Create alert in database
  private static async createAlert(
    rule: IAlertRule,
    cameraId: string,
    cameraName: string,
    detections: Detection[],
    frameData?: string
  ) {
    
    try {
      const message = this.generateMessage(rule, detections);
      
      const alert = new Alert({
        ruleId: rule._id,
        ruleName: rule.name,
        priority: rule.priority,
        message: message,
        cameraId: cameraId,
        cameraName: cameraName,
        detections: detections.map(d => ({
          class: d.class,
          confidence: d.confidence,
          bbox: d.bbox
        })),
        snapshot: rule.actions.saveSnapshot ? frameData : undefined,
        acknowledged: false,
        timestamp: new Date()
      });
      
      await alert.save();
      
      return alert;
    } catch (error) {
      console.error('❌ Error creating alert:', error);
      throw error;
    }
  }
  
  // Generate alert message
  private static generateMessage(rule: IAlertRule, detections: Detection[]): string {
    try {
      const objectList = detections.map(d => d.class).join(', ');
      const timeStr = new Date().toLocaleTimeString();
      
      return `${rule.name}: Detected ${objectList} at ${timeStr}`;
    } catch (error) {
      console.error('❌ Error generating message:', error);
      return `${rule.name}: Alert triggered`;
    }
  }
  
  // Get priority emoji
  static getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📌';
    }
  }
}