import mongoose from 'mongoose';
import AlertRule from './models/AlertRule';
import dotenv from 'dotenv';

dotenv.config();

async function updatePersonRule() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ai_vision_security');
    console.log('✅ Connected to MongoDB');

    // Update Person Detection to CRITICAL
    const result = await AlertRule.updateOne(
      { name: 'Person Detection' },
      {
        $set: {
          priority: 'critical',
          description: 'CRITICAL: Unauthorized person detected in restricted area',
          actions: {
            notification: true,
            audioAlert: true,
            saveSnapshot: true,
            discord: true,
            email: false
          },
          cooldownMinutes: 1
        }
      }
    );

    console.log('✅ Updated Person Detection to CRITICAL');
    console.log('Result:', result);

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updatePersonRule();