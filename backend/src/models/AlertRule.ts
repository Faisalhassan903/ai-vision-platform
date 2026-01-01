import mongoose, { Schema, Document } from 'mongoose';

export interface IAlertRule extends Document {
  name: string;
  description: string;
  enabled: boolean;
  priority: 'info' | 'warning' | 'critical';
  conditions: {
    objectClasses: string[];
    minConfidence: number;
    timeRange?: {
      start: string; // "22:00"
      end: string;   // "06:00"
    };
    zones?: Array<{
      name: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }>;
  };
  actions: {
    notification: boolean;
    audioAlert: boolean;
    saveSnapshot: boolean;
    discord: boolean;
    email: boolean;
  };
  cooldownMinutes: number;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlertRuleSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    required: true
  },
  conditions: {
    objectClasses: {
      type: [String],
      required: true
    },
    minConfidence: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    },
    timeRange: {
      start: String,
      end: String
    },
    zones: [{
      name: String,
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number
    }]
  },
  actions: {
    notification: {
      type: Boolean,
      default: true
    },
    audioAlert: {
      type: Boolean,
      default: false
    },
    saveSnapshot: {
      type: Boolean,
      default: true
    },
    discord: {
      type: Boolean,
      default: false
    },
    email: {
      type: Boolean,
      default: false
    }
  },
  cooldownMinutes: {
    type: Number,
    default: 5
  },
  lastTriggered: {
    type: Date
  },
  triggerCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model<IAlertRule>('AlertRule', AlertRuleSchema);