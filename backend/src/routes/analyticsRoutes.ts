import express, { Request, Response } from 'express';
import Alert from '../models/Alert';

const router = express.Router();

// GET /api/analytics/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const total = await Alert.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Alert.countDocuments({ timestamp: { $gte: today } });

    // Top detected object classes across all alerts
    const byClass = await Alert.aggregate([
      { $unwind: '$detections' },
      {
        $group: {
          _id: '$detections.class',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$detections.confidence' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Alerts per camera
    const byCamera = await Alert.aggregate([
      {
        $group: {
          _id: '$cameraName',
          cameraName: { $first: '$cameraName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Alerts by priority
    const byPriority = await Alert.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Alerts by rule
    const byRule = await Alert.aggregate([
      {
        $group: {
          _id: '$ruleName',
          count: { $sum: 1 },
          lastTriggered: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: {
        total,
        today: todayCount,
        byClass,
        byCamera,
        byPriority,
        byRule,
      }
    });

  } catch (error: any) {
    console.error('Analytics stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/recent
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const alerts = await Alert.find()
      .sort({ timestamp: -1 })
      .limit(limit);

    // Shape response to match what Analytics.tsx expects
    const detections = alerts.map(a => ({
      _id: a._id,
      timestamp: a.timestamp,
      cameraId: (a as any).cameraId || 'cam_01',
      cameraName: (a as any).cameraName || 'Sentry_Node_01',
      detections: (a as any).detections || [],
      totalObjects: (a as any).detections?.length || 0,
      alertSent: true, // all records in Alert collection triggered an alert
    }));

    res.json({ success: true, count: detections.length, detections });

  } catch (error: any) {
    console.error('Analytics recent error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/timeline
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const timeline = await Alert.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' }
          },
          count: { $sum: 1 },
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, hours, timeline });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/search
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { ruleName, priority, startDate, endDate } = req.query;
    const query: any = {};

    if (ruleName)  query.ruleName = new RegExp(ruleName as string, 'i');
    if (priority)  query.priority = priority;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate)   query.timestamp.$lte = new Date(endDate as string);
    }

    const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, count: alerts.length, detections: alerts });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;