import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'admin' | 'user';
  telegramChatId: string | null;
  telegramConnected: boolean;
  telegramLinkToken: string | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  telegramChatId: { type: String, default: null },
  telegramConnected: { type: Boolean, default: false },
  telegramLinkToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// REMOVED 'next' from the arguments to stop the TS error
UserSchema.pre<IUser>('save', async function () {
  // If password isn't modified, just return (resolves the promise)
  if (!this.isModified('password')) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    // Re-throw the error so Mongoose catches it
    throw err;
  }
});

export default mongoose.model<IUser>('User', UserSchema);