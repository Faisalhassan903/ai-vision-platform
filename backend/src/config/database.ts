import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // This looks for the variable you set in Render's dashboard
    // If it's not found, it uses your local string as a backup
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_vision_security';

    const conn = await mongoose.connect(dbUri);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Optional: exit(1) if you want the app to crash when DB fails
  }
};

export default connectDB;