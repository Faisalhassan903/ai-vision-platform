import express, { Request, Response } from 'express';
import Alert from '../models/Alert';
import AlertRule from '../models/AlertRule';

const router = express.Router();

/**
 * @route   POST /api/alerts
 * @desc    Create new alert from AI Camera
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const newAlert = new Alert({
      ...req.body,
      timestamp: req.body.timestamp || new Date(),
      acknowledged: false
    });

    const savedAlert = await newAlert.save();

    // Trigger Real-time update via Socket
    const io = req.app.get('socketio');
    if (io) {
      io.emit('alert-triggered', savedAlert);
    }

    res.status(201).json({ success: true, alert: savedAlert });
  } catch (error: any) {
    console.error("POST /api/alerts error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts (with pagination/filtering)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = await Alert.find()
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.json({ success: true, alerts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/alerts/:id/acknowledge
 * @desc    Mark an alert as read
 */
router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { 
        acknowledged: true, 
        acknowledgedAt: new Date(),
        acknowledgedBy: req.body.user || 'Admin',
        notes: req.body.notes 
      },
      { new: true }
    );
    
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stats Route
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const unacknowledged = await Alert.countDocuments({ acknowledged: false });
    const total = await Alert.countDocuments();
    res.json({ success: true, stats: { unacknowledged, total } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;