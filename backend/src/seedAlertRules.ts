import mongoose from 'mongoose';
import AlertRule from './models/AlertRule';
import dotenv from 'dotenv';

dotenv.config();

const defaultRules = [
  {
    name: 'Person Detection',
    description: 'Alert when any person is detected',
    enabled: true,
    priority: 'warning',
    conditions: {
      objectClasses: ['person'],
      minConfidence: 0.6
    },
    actions: {
      notification: true,
      audioAlert: true,
      saveSnapshot: true,
      discord: false,
      email: false
    },
    cooldownMinutes: 2
  },
  {
    name: 'Weapon Detection - CRITICAL',
    description: 'Immediate alert for weapons or dangerous objects',
    enabled: true,
    priority: 'critical',
    conditions: {
      objectClasses: ['knife', 'scissors', 'baseball bat', 'tennis racket'],
      minConfidence: 0.5
    },
    actions: {
      notification: true,
      audioAlert: true,
      saveSnapshot: true,
      discord: true,
      email: false
    },
    cooldownMinutes: 1
  },
  {
    name: 'Suspicious Items',
    description: 'Alert for backpacks, bags, and luggage',
    enabled: true,
    priority: 'warning',
    conditions: {
      objectClasses: ['backpack', 'handbag', 'suitcase'],
      minConfidence: 0.65
    },
    actions: {
      notification: true,
      audioAlert: false,
      saveSnapshot: true,
      discord: false,
      email: false
    },
    cooldownMinutes: 3
  },
  {
    name: 'Night Time Person Detection',
    description: 'Alert if person detected between 10 PM and 6 AM',
    enabled: true,
    priority: 'critical',
    conditions: {
      objectClasses: ['person'],
      minConfidence: 0.6,
      timeRange: {
        start: '22:00',
        end: '06:00'
      }
    },
    actions: {
      notification: true,
      audioAlert: true,
      saveSnapshot: true,
      discord: true,
      email: false
    },
    cooldownMinutes: 5
  },
  {
    name: 'Vehicle Detection',
    description: 'Alert when vehicles are detected',
    enabled: false,
    priority: 'info',
    conditions: {
      objectClasses: ['car', 'truck', 'bus', 'motorcycle'],
      minConfidence: 0.7
    },
    actions: {
      notification: true,
      audioAlert: false,
      saveSnapshot: true,
      discord: false,
      email: false
    },
    cooldownMinutes: 10
  }
];

async function seedAlertRules() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ai_vision_security');
    console.log('✅ Connected to MongoDB');

    // Clear existing rules (optional)
    // await AlertRule.deleteMany({});
    // console.log('🗑️ Cleared existing rules');

    // Check if rules already exist
    const existingCount = await AlertRule.countDocuments();
    
    if (existingCount > 0) {
      console.log(`ℹ️ Found ${existingCount} existing rules. Skipping seed.`);
      console.log('💡 To reset rules, uncomment deleteMany() in the script.');
    } else {
      // Insert default rules
      await AlertRule.insertMany(defaultRules);
      console.log(`✅ Created ${defaultRules.length} default alert rules!`);
      
      console.log('\n📋 Default Rules Created:');
      defaultRules.forEach((rule, idx) => {
        console.log(`${idx + 1}. ${rule.name} (${rule.priority})`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedAlertRules();