
import mongoose from 'mongoose';
import AlertRule from './src/models/AlertRule';

async function cleanup() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ai_vision_security');
    console.log('🔧 Cleaning up alert rules...');
    
    const allRules = await AlertRule.find({});
    
    for (const rule of allRules) {
      let updated = false;
      
      if (rule.conditions?.timeRange) {
        const tr = rule.conditions.timeRange;
        if (!tr.start || !tr.end || typeof tr.start !== 'string' || typeof tr.end !== 'string') {
          console.log('  Removing invalid timeRange from: ' + rule.name);
          rule.conditions.timeRange = undefined;
          updated = true;
        }
      }
      
      if (rule.conditions.minConfidence === undefined || rule.conditions.minConfidence === null) {
        console.log('  Setting default confidence for: ' + rule.name);
        rule.conditions.minConfidence = 0.25;
        updated = true;
      }
      
      if (updated) {
        await rule.save();
      }
    }
    
    console.log('\n✅ Cleanup complete!\n\n📋 Current Rules:');
    const rules = await AlertRule.find({});
    rules.forEach(r => {
      console.log('  - ' + r.name);
      console.log('    Objects: ' + (r.conditions.objectClasses || []).join(', '));
      console.log('    Confidence: ' + ((r.conditions.minConfidence || 0) * 100).toFixed(0) + '%');
      console.log('    Time Range: ' + (r.conditions.timeRange ? 'Yes' : 'No'));
      console.log('');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
cleanup();
