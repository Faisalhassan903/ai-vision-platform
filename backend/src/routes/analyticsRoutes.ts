import express, { Request, Response } from 'express';
import Detection from '../models/Detection';

const router = express.Router();

// GET /api/analytics/recent - Get recent detections
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const detections = await Detection.find()
      .sort({ timestamp: -1 })  // Newest first
      .limit(limit);
    
    res.json({
      success: true,
      count: detections.length,
      detections: detections
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/analytics/stats - Get statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Total detections
    const totalDetections = await Detection.countDocuments();
    
    // Detections today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const detectionsToday = await Detection.countDocuments({
      timestamp: { $gte: today }
    });
    
    // Detections by class
    const byClass = await Detection.aggregate([
      { $unwind: '$detections' },
      { 
        $group: { 
          _id: '$detections.class',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$detections.confidence' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Detections by camera
    const byCamera = await Detection.aggregate([
      { 
        $group: { 
          _id: '$cameraId',
          cameraName: { $first: '$cameraName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      stats: {
        total: totalDetections,
        today: detectionsToday,
        byClass: byClass,
        byCamera: byCamera
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/analytics/search - Search detections
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { 
      cameraId, 
      class: objectClass, 
      startDate, 
      endDate,
      minConfidence 
    } = req.query;
    
    // Build query
    const query: any = {};
    
    if (cameraId) {
      query.cameraId = cameraId;
    }
    
    if (objectClass) {
      query['detections.class'] = objectClass;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string);
      }
    }
    
    if (minConfidence) {
      query['detections.confidence'] = { 
        $gte: parseFloat(minConfidence as string) 
      };
    }
    
    const detections = await Detection.find(query)
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json({
      success: true,
      count: detections.length,
      query: query,
      detections: detections
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/analytics/timeline - Detections over time
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const timeline = await Detection.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { 
              format: '%Y-%m-%d %H:00', 
              date: '$timestamp' 
            }
          },
          count: { $sum: 1 },
          totalObjects: { $sum: '$totalObjects' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      hours: hours,
      timeline: timeline
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
