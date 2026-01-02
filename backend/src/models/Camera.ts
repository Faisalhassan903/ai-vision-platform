// ===========================================
// CAMERA MODEL - UPDATED
// ===========================================
// Full support for RTSP, Webcam, HTTP streams

import mongoose, { Schema, Document } from 'mongoose';

export interface ICamera extends Document {
  cameraId: string;
  name: string;
  type: 'webcam' | 'rtsp' | 'http' | 'file';
  
  // Connection
  streamUrl?: string;
  username?: string;
  password?: string;
  deviceId?: string;  // For webcams
  
  // Location
  location?: string;
  group?: string;
  
  // Status
  enabled: boolean;
  status: 'online' | 'offline' | 'connecting' | 'error';
  lastSeen?: Date;
  lastError?: string;
  lastTested?: Date;
  
  // Settings
  settings?: {
    fps?: number;
    resolution?: {
      width: number;
      height: number;
    };
    recordEnabled?: boolean;
    motionDetection?: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const CameraSchema = new Schema({
  cameraId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  name: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['webcam', 'rtsp', 'http', 'file'],
    default: 'rtsp'
  },
  
  // Connection
  streamUrl: { 
    type: String 
  },
  username: { 
    type: String 
  },
  password: { 
    type: String 
  },
  deviceId: { 
    type: String 
  },
  
  // Location
  location: { 
    type: String 
  },
  group: { 
    type: String 
  },
  
  // Status
  enabled: { 
    type: Boolean, 
    default: true 
  },
  status: { 
    type: String, 
    enum: ['online', 'offline', 'connecting', 'error'],
    default: 'offline' 
  },
  lastSeen: { 
    type: Date 
  },
  lastError: { 
    type: String 
  },
  lastTested: { 
    type: Date 
  },
  
  // Settings
  settings: {
    fps: { type: Number, default: 5 },
    resolution: {
      width: { type: Number },
      height: { type: Number }
    },
    recordEnabled: { type: Boolean, default: false },
    motionDetection: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes
CameraSchema.index({ status: 1 });
CameraSchema.index({ group: 1 });
CameraSchema.index({ enabled: 1 });

export default mongoose.model<ICamera>('Camera', CameraSchema);