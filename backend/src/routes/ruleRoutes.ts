import express from 'express';
import AlertRule from '../models/AlertRule';

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
  console.log("Data received from frontend:", req.body); // Check this in your terminal
  try {
    const newRule = new AlertRule(req.body);
    await newRule.save();
    res.status(201).json(newRule);
  } catch (err: any) {
    console.error("Mongoose Validation Error:", err.message); // This tells you WHY it failed
    res.status(400).json({ message: err.message });
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