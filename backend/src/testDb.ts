import mongoose from 'mongoose';
import Detection from '../models/Detection';

const testDB = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/ai_vision_security');
    console.log('✅ Connected to MongoDB\n');

    // Count total detections
    const count = await Detection.countDocuments();
    console.log(`📊 Total detections in database: ${count}\n`);

    // Get latest 5 detections
    const latestDetections = await Detection.find()
      .sort({ timestamp: -1 })
      .limit(5);

    console.log('🕐 Latest 5 detections:');
    latestDetections.forEach((det, idx) => {
      console.log(`\n${idx + 1}. Detection ID: ${det._id}`);
      console.log(`   Camera: ${det.cameraName}`);
      console.log(`   Time: ${det.timestamp}`);
      console.log(`   Objects: ${det.totalObjects}`);
      det.detections.forEach((obj, i) => {
        console.log(`     ${i + 1}) ${obj.class} - ${(obj.confidence * 100).toFixed(1)}%`);
      });
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

testDB();