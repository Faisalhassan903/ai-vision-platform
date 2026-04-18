import express from 'express';
import AlertRule from '../models/AlertRule';

const router = express.Router();

// ─── GET all rules ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rules = await AlertRule.find().sort({ createdAt: -1 });
    res.json(rules); // plain array — frontend uses Array.isArray()
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST create new rule ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  console.log('📥 New rule received:', req.body?.name);
  try {
    const newRule = new AlertRule(req.body);
    await newRule.save();
    res.status(201).json(newRule);
  } catch (err: any) {
    console.error('❌ Rule save failed:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// ─── PATCH /:id/trigger ───────────────────────────────────────────────────────
// IMPORTANT: must be registered BEFORE /:id — otherwise Express matches /:id first
router.patch('/:id/trigger', async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { triggerCount: 1 },
        lastTriggered: new Date(),
      },
      { new: true }
    );
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({
      success: true,
      triggerCount: rule.triggerCount,
      lastTriggered: rule.lastTriggered,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PATCH /:id (general update — enable/disable, edit) ──────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await AlertRule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rule deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;