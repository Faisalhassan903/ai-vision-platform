import express, { Request, Response } from 'express';
import Alert from '../models/Alert';

const router = express.Router();

// 1. THIS WAS MISSING: Handles POST https://.../api/alerts
router.post('/', async (req: Request, res: Response) => {
  try {
    const newAlert = new Alert({
      ...req.body,
      timestamp: req.body.timestamp || new Date(),
      acknowledged: false
    });

    const savedAlert = await newAlert.save();

    // Push to Socket.io for real-time dashboard update
    const io = req.app.get('socketio');
    if (io) io.emit('alert-triggered', savedAlert);

    res.status(201).json({ success: true, alert: savedAlert });
  } catch (error: any) {
    console.error("Alert Save Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/alerts
router.get('/', async (req: Request, res: Response) => {
  try {
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(50);
    res.json({ success: true, alerts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/alerts/:id/acknowledge
router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id, 
      { acknowledged: true }, 
      { new: true }
    );
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;