import express from 'express';
import AlertRule from '../models/AlertRule';

const router = express.Router();

// GET all rules
router.get('/', async (req, res) => {
  try {
    const rules = await AlertRule.find().sort({ createdAt: -1 });
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE rule
router.post('/', async (req, res) => {
  try {
    const rule = await AlertRule.create(req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE rule
router.put('/:id', async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE rule
router.delete('/:id', async (req, res) => {
  try {
    await AlertRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;