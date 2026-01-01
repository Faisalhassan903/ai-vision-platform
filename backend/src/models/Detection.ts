import mongoose, { Schema, Document } from 'mongoose';

// TypeScript interface for type safety
export interface IDetection extends Document {
  timestamp: Date;
  cameraId: string;
  cameraName: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    };
  }>;
  totalObjects: number;
  alertSent: boolean;
  alertType?: string;
  imageUrl?: string;
}

// MongoDB Schema - defines structure and validation
const DetectionSchema: Schema = new Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true  // Index for fast date queries
  },
  cameraId: {
    type: String,
    required: true,
    index: true  // Index for fast camera queries
  },
  cameraName: {
    type: String,
    required: true
  },
  detections: [{
    class: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    bbox: {
      x1: { type: Number, required: true },
      y1: { type: Number, required: true },
      x2: { type: Number, required: true },
      y2: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true }
    }
  }],
  totalObjects: {
    type: Number,
    required: true,
    default: 0
  },
  alertSent: {
    type: Boolean,
    default: false
  },
  alertType: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  }
}, {
  timestamps: true  // Automatically adds createdAt and updatedAt fields
});

// Create indexes for better query performance
DetectionSchema.index({ timestamp: -1, cameraId: 1 });  // Compound index

export default mongoose.model<IDetection>('Detection', DetectionSchema);