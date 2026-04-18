import express from 'express';
import Alert from '../models/Alert'; // ← CORRECT

const router = express.Router();

// GET all rules
router.get('/', async (req, res) => {
  try {
    const rules = await AlertRule.find();
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new rule
router.post('/', async (req, res) => {
  console.log('Data received from frontend:', req.body);
  try {
    const newRule = new AlertRule(req.body);
    await newRule.save();
    res.status(201).json(newRule);
  } catch (err: any) {
    console.error('Mongoose Validation Error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// PATCH update a rule
router.patch('/:id', async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /:id/trigger — called by LiveCamera when a rule fires
// Increments triggerCount and updates lastTriggered timestamp
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
    res.json({ success: true, triggerCount: rule.triggerCount, lastTriggered: rule.lastTriggered });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a rule
router.delete('/:id', async (req, res) => {
  try {
    await AlertRule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rule deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;