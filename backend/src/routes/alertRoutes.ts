import express, { Request, Response } from 'express';
import AlertRule from '../models/AlertRule';
import Alert from '../models/Alert';

const router = express.Router();

// GET /api/alerts - Get recent alerts
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const priority = req.query.priority as string;
    const acknowledged = req.query.acknowledged as string;
    
    const query: any = {};
    
    if (priority) {
      query.priority = priority;
      
    }
    
    if (acknowledged !== undefined) {
      query.acknowledged = acknowledged === 'true';
    }
    
    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/alerts/:id/acknowledge - Acknowledge alert
router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = req.body.user || 'User';
    alert.notes = req.body.notes;
    
    await alert.save();
    
    res.json({
      success: true,
      alert: alert
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/rules - Get all alert rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const rules = await AlertRule.find().sort({ priority: -1, name: 1 });
    
    res.json({
      success: true,
      count: rules.length,
      rules: rules
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/alerts/rules - Create alert rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const rule = new AlertRule(req.body);
    await rule.save();
    
    res.json({
      success: true,
      rule: rule
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/rules/:id - Update alert rule
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    res.json({
      success: true,
      rule: rule
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/alerts/rules/:id - Delete alert rule
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const rule = await AlertRule.findByIdAndDelete(req.params.id);
    
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    res.json({
      success: true,
      message: 'Rule deleted'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/stats - Get alert statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const total = await Alert.countDocuments();
    const unacknowledged = await Alert.countDocuments({ acknowledged: false });
    const critical = await Alert.countDocuments({ priority: 'critical' });
    const warning = await Alert.countDocuments({ priority: 'warning' });
    const info = await Alert.countDocuments({ priority: 'info' });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Alert.countDocuments({ timestamp: { $gte: today } });
    
    res.json({
      success: true,
      stats: {
        total,
        unacknowledged,
        todayCount,
        byPriority: {
          critical,
          warning,
          info
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;