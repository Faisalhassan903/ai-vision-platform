import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  ruleId: mongoose.Types.ObjectId;
  ruleName: string;
  priority: 'info' | 'warning' | 'critical';
  message: string;
  cameraId: string;
  cameraName: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: any;
  }>;
  snapshot?: string; // base64 or URL
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
  timestamp: Date;
}

const AlertSchema: Schema = new Schema({
  ruleId: {
    type: Schema.Types.ObjectId,
    ref: 'AlertRule',
    required: true
  },
  ruleName: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  cameraId: {
    type: String,
    required: true
  },
  cameraName: {
    type: String,
    required: true
  },
  detections: [{
    class: String,
    confidence: Number,
    bbox: Schema.Types.Mixed
  }],
  snapshot: {
    type: String
  },
  acknowledged: {
    type: Boolean,
    default: false
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
});

AlertSchema.index({ priority: 1, timestamp: -1 });
AlertSchema.index({ acknowledged: 1, timestamp: -1 });

export default mongoose.model<IAlert>('Alert', AlertSchema);