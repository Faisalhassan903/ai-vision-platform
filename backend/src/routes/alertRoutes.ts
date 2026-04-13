import express, { Request, Response } from 'express';
import Alert from '../models/Alert';
import { requireDB } from '../config/db';

const router = express.Router();

// Apply DB connection check to ALL alert routes
router.use(requireDB);

/**
 * @route   POST /api/alerts
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ruleName, priority, message, cameraId, cameraName, analytics, detections } = req.body;

    if (!ruleName || !priority) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: ruleName and priority." 
      });
    }

    const validPriorities = ['info', 'warning', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
      });
    }

    const newAlert = new Alert({
      ruleName,
      priority,
      message: message || `Security trigger: ${ruleName}`,
      cameraId: cameraId || null,
      cameraName: cameraName || "Sentry_Node_01",
      timestamp: new Date(),
      acknowledged: false,
      analytics: {
        device_id: analytics?.device_id || "UNKNOWN_NODE",
        primary_target: analytics?.primary_target || detections?.[0]?.class || "unknown",
        confidence_avg: analytics?.confidence_avg || 0,
      },
      detections: (detections || []).map((d: any) => ({
        class: d.class || "unknown",
        confidence: typeof d.confidence === 'number' ? d.confidence : 0,
        bbox: d.bbox || null
      }))
    });

    const savedAlert = await newAlert.save();

    const io = req.app.get('socketio');
    if (io) io.emit('new-incident', savedAlert);

    res.status(201).json({ success: true, alert: savedAlert });

  } catch (error: any) {
    console.error("🚨 Alert Save Failure:", error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(f => {
        console.error(`  Field [${f}]:`, error.errors[f].message);
      });
    }
    res.status(500).json({ 
      success: false, 
      error: "Database rejection on incident log.",
      detail: error.message
    });
  }
});

/**
 * @route   GET /api/alerts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error: any) {
    console.error("GET /api/alerts failed:", error.message);
    res.status(500).json({ success: false, error: "Failed to retrieve incident logs." });
  }
});

/**
 * @route   PATCH /api/alerts/:id/acknowledge
 */
router.patch('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id, 
      { acknowledged: true, acknowledgedAt: new Date() }, 
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, error: "Incident not found." });
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;