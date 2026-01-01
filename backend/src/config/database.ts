import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // CHANGE: Replace 'localhost' with '127.0.0.1'
    const conn = await mongoose.connect('mongodb://127.0.0.1:27017/ai_vision_security');
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // STRATEGY: During development, you might want to comment out process.exit(1)
    // so the server stays alive even if the DB is temporarily down.
    // process.exit(1); 
  }
};

export default connectDB;