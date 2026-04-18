import express from 'express';
import mongoose from 'mongoose';
import AlertRule from '../models/AlertRule';

const router = express.Router();

// 🟢 GET ALL RULES
router.get('/', async (req, res) => {
  try {
    const rules = await AlertRule.find().sort({ createdAt: -1 });
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 🟡 TRIGGER UPDATE (The 404 Fix)
router.patch('/:id/trigger', async (req, res) => {
  const { id } = req.params;

  // 1. Check if the ID is a valid MongoDB ObjectId
  // This prevents the 404 when the frontend sends "fallback"
  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.log(`⚠️ Ignored trigger for non-DB rule: ${id}`);
    return res.status(200).json({ 
      success: true, 
      message: "Local rule triggered, no DB update needed." 
    });
  }

  try {
    const rule = await AlertRule.findByIdAndUpdate(
      id,
      { 
        $set: { lastTriggered: new Date() },
        $inc: { triggerCount: 1 } 
      },
      { new: true }
    );

    if (!rule) return res.status(404).json({ error: 'Rule not found in database' });
    
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 🔵 CREATE RULE
router.post('/', async (req, res) => {
  try {
    const newRule = new AlertRule(req.body);
    await newRule.save();
    res.status(201).json(newRule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// 🔴 DELETE RULE
router.delete('/:id', async (req, res) => {
  try {
    await AlertRule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rule deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;