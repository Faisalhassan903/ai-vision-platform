// ===========================================
// CAMERA ROUTES
// ===========================================
// REST API for camera management
// Endpoints: CRUD + stream control + testing

import express, { Request, Response } from 'express';
import Camera from '../models/Camera';
import { rtspProxy } from '../services/rtspProxy';

const router = express.Router();

// -------------------------------------------
// GET /api/cameras - List all cameras
// -------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const cameras = await Camera.find().sort({ createdAt: -1 });
    
    // Add stream status to each camera
    const camerasWithStatus = cameras.map((cam) => {
      const streamStatus = rtspProxy.getStreamStatus(cam.cameraId);
      return {
        ...cam.toObject(),
        streamStatus: streamStatus || { isRunning: false, viewers: 0 }
      };
    });

    res.json({
      success: true,
      count: cameras.length,
      cameras: camerasWithStatus
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// GET /api/cameras/:id - Get single camera
// -------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const camera = await Camera.findOne({ cameraId: req.params.id });
    
    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    const streamStatus = rtspProxy.getStreamStatus(camera.cameraId);

    res.json({
      success: true,
      camera: {
        ...camera.toObject(),
        streamStatus: streamStatus || { isRunning: false, viewers: 0 }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// POST /api/cameras - Create new camera
// -------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      streamUrl,
      username,
      password,
      location,
      group,
      enabled = true,
      fps = 5,
      resolution
    } = req.body;

    // Generate unique camera ID
    const cameraId = `cam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const camera = new Camera({
      cameraId,
      name: name || `Camera ${cameraId.slice(0, 8)}`,
      type: type || 'rtsp',
      streamUrl,
      username,
      password,
      location,
      group,
      enabled,
      status: 'offline',
      settings: {
        fps,
        resolution
      }
    });

    await camera.save();

    console.log(`[Camera] Created: ${camera.name} (${camera.cameraId})`);

    res.status(201).json({
      success: true,
      camera: camera.toObject()
    });
  } catch (error: any) {
    console.error('[Camera] Create error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// PUT /api/cameras/:id - Update camera
// -------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const camera = await Camera.findOneAndUpdate(
      { cameraId: req.params.id },
      { 
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    // If stream URL changed and stream is running, restart it
    if (req.body.streamUrl) {
      const status = rtspProxy.getStreamStatus(camera.cameraId);
      if (status?.isRunning) {
        rtspProxy.stopStream(camera.cameraId);
        // Stream will be restarted when viewers reconnect
      }
    }

    res.json({
      success: true,
      camera: camera.toObject()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// DELETE /api/cameras/:id - Delete camera
// -------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Stop stream if running
    rtspProxy.stopStream(req.params.id);

    const camera = await Camera.findOneAndDelete({ cameraId: req.params.id });

    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    console.log(`[Camera] Deleted: ${camera.name}`);

    res.json({
      success: true,
      message: 'Camera deleted'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// POST /api/cameras/:id/test - Test camera connection
// -------------------------------------------
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const camera = await Camera.findOne({ cameraId: req.params.id });

    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    if (camera.type !== 'rtsp' || !camera.streamUrl) {
      return res.json({
        success: true,
        message: 'Non-RTSP camera - cannot test remotely'
      });
    }

    // Build full RTSP URL with credentials
    let testUrl = camera.streamUrl;
    if (camera.username && camera.password) {
      const urlObj = new URL(camera.streamUrl);
      urlObj.username = camera.username;
      urlObj.password = camera.password;
      testUrl = urlObj.toString();
    }

    const result = await rtspProxy.testConnection(testUrl);

    // Update camera status
    await Camera.updateOne(
      { cameraId: camera.cameraId },
      { 
        status: result.success ? 'online' : 'error',
        lastError: result.error,
        lastTested: new Date()
      }
    );

    res.json({
      success: result.success,
      error: result.error,
      message: result.success ? 'Connection successful' : 'Connection failed'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// POST /api/cameras/:id/start - Start stream
// -------------------------------------------
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const camera = await Camera.findOne({ cameraId: req.params.id });

    if (!camera) {
      return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    if (camera.type !== 'rtsp') {
      return res.json({
        success: true,
        message: 'Non-RTSP camera - stream handled by client'
      });
    }

    // Build full RTSP URL with credentials
    let streamUrl = camera.streamUrl || '';
    if (camera.username && camera.password && streamUrl) {
      try {
        const urlObj = new URL(streamUrl);
        urlObj.username = camera.username;
        urlObj.password = camera.password;
        streamUrl = urlObj.toString();
      } catch {
        // If URL parsing fails, try simple string replacement
        streamUrl = streamUrl.replace('rtsp://', `rtsp://${camera.username}:${camera.password}@`);
      }
    }

    const result = await rtspProxy.startStream({
      cameraId: camera.cameraId,
      rtspUrl: streamUrl,
      fps: camera.settings?.fps || 5,
      resolution: camera.settings?.resolution
    });

    if (result.success) {
      await Camera.updateOne(
        { cameraId: camera.cameraId },
        { status: 'online' }
      );
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// POST /api/cameras/:id/stop - Stop stream
// -------------------------------------------
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const stopped = rtspProxy.stopStream(req.params.id);

    if (stopped) {
      await Camera.updateOne(
        { cameraId: req.params.id },
        { status: 'offline' }
      );
    }

    res.json({
      success: true,
      message: stopped ? 'Stream stopped' : 'Stream was not running'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// GET /api/cameras/streams/active - Get active streams
// -------------------------------------------
router.get('/streams/active', async (req: Request, res: Response) => {
  try {
    const activeStreams = rtspProxy.getActiveStreams();

    res.json({
      success: true,
      count: activeStreams.length,
      streams: activeStreams
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------
// POST /api/cameras/test-url - Test RTSP URL directly
// -------------------------------------------
router.post('/test-url', async (req: Request, res: Response) => {
  try {
    const { url, username, password } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Build full URL with credentials
    let testUrl = url;
    if (username && password) {
      try {
        const urlObj = new URL(url);
        urlObj.username = username;
        urlObj.password = password;
        testUrl = urlObj.toString();
      } catch {
        testUrl = url.replace('rtsp://', `rtsp://${username}:${password}@`);
      }
    }

    const result = await rtspProxy.testConnection(testUrl);

    res.json({
      success: result.success,
      error: result.error,
      message: result.success ? 'Connection successful!' : 'Connection failed'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;