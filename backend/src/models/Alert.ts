import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  ruleId?: mongoose.Types.ObjectId | string;
  ruleName: string;
  priority: 'info' | 'warning' | 'critical';
  message: string;
  cameraId?: string;
  cameraName?: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: any;
  }>;
  // NEW: Critical for the Analytics Mission
  analytics?: {
    device_id: string;
    primary_target: string;
    confidence_avg: number;
  };
  snapshot?: string; 
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
  timestamp: Date;
}

const AlertSchema: Schema = new Schema({
  ruleId: {
    type: Schema.Types.Mixed, // More flexible for AI triggers
    ref: 'AlertRule',
    required: false
  },
  ruleName: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  cameraId: {
    type: String,
    required: false // Fixed: Don't crash if ID isn't ready
  },
  cameraName: {
    type: String,
    default: "Default Node"
  },
  detections: [{
    class: { type: String, index: true }, // Index this for faster "Top Detections" queries
    confidence: Number,
    bbox: Schema.Types.Mixed
  }],
  // --- ADDED FOR ANALYTICS MISSION ---
  analytics: {
    device_id: { type: String, index: true },
    primary_target: { type: String, index: true },
    confidence_avg: Number
  },
  snapshot: {
    type: String
  },
  acknowledged: {
    type: Boolean,
    default: false,
    index: true
  },
  acknowledgedBy: {
    type: String
  },
  acknowledgedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Optimized compound indexes for the dashboard
AlertSchema.index({ 'analytics.primary_target': 1, timestamp: -1 });
AlertSchema.index({ priority: 1, timestamp: -1 });

export default mongoose.model<IAlert>('Alert', AlertSchema);