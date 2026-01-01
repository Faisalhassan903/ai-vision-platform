import mongoose, { Schema, Document } from 'mongoose';

export interface ICamera extends Document {
  cameraId: string;
  name: string;
  location?: string;
  status?: string;
}

const CameraSchema = new Schema({
  cameraId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String },
  status: { type: String, default: 'online' }
});

export default mongoose.model<ICamera>('Camera', CameraSchema);