import express, { Request, Response } from 'express';
import Alert from '../models/Alert';

const router = express.Router();

/**
 * @route   POST /api/alerts
 * @desc    Log a new AI security incident and trigger real-time alerts
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ruleName, priority, message, analytics, detections } = req.body;

    // 1. DATA VALIDATION: Ensure the mission-critical fields exist
    if (!ruleName || !priority) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: ruleName and priority are mandatory." 
      });
    }

    // 2. CREATE INCIDENT: Mapping data for Analytics
    const newAlert = new Alert({
      ruleName,
      priority,
      message: message || `Security trigger: ${ruleName}`,
      timestamp: new Date(),
      acknowledged: false,
      // Nesting analytics data for the dashboard charts
      analytics: {
        device_id: analytics?.device_id || "UNKNOWN_NODE",
        primary_target: analytics?.primary_target || (detections?.[0]?.class),
        confidence_avg: analytics?.confidence_avg || 0,
      },
      detections: detections || []
    });

    const savedAlert = await newAlert.save();

    // 3. REAL-TIME EMIT: Use volatile for high-frequency alerts to prevent socket lag
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-incident', savedAlert); // Match this string in your frontend hook
    }

    // 4. TELEGRAM NOTIFICATION (Optional Hook)
    // If you have a telegram service, call it here:
    // telegramService.sendAlert(savedAlert);

    res.status(201).json({ success: true, alert: savedAlert });
  } catch (error: any) {
    console.error("🚨 CRITICAL: Alert Save Failure:", error.message);
    res.status(500).json({ success: false, error: "Database rejection on incident log." });
  }
});

/**
 * @route   GET /api/alerts
 * @desc    Fetch recent incidents for analytics and logging
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Pagination: Only get last 100 to keep the dashboard fast
    const alerts = await Alert.find()
      .sort({ timestamp: -1 })
      .limit(100);
      
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Failed to retrieve incident logs." });
  }
});

/**
 * @route   PATCH /api/alerts/:id/acknowledge
 * @desc    Mark incident as handled
 */
router.patch('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id, 
      { acknowledged: true, handledAt: new Date() }, 
      { new: true }
    );
    
    if (!alert) return res.status(404).json({ success: false, error: "Incident not found." });
    
    res.json({ success: true, alert });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;