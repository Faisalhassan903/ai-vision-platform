import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer — temp storage for any direct uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * @route  GET /api/vision/status
 * @desc   Check if AI service is reachable (used for health dashboard)
 */
router.get('/status', async (req: Request, res: Response) => {
  const AI_URL = process.env.AI_SERVICE_URL;

  if (!AI_URL) {
    return res.json({
      mode: 'browser',
      aiService: false,
      message: 'No AI_SERVICE_URL set. Using browser-based COCO-SSD detection.',
    });
  }

  try {
    const axios = require('axios');
    await axios.get(`${AI_URL}/health`, { timeout: 5000 });
    res.json({ mode: 'server', aiService: true, url: AI_URL });
  } catch {
    res.json({
      mode: 'browser',
      aiService: false,
      message: 'AI service unreachable. Frontend is using browser COCO-SSD.',
    });
  }
});

/**
 * @route  POST /api/vision/detect
 * @desc   Server-side detection via Python AI service.
 *         NOTE: Frontend now uses browser-based COCO-SSD directly.
 *         This route is kept for future RTSP / server-push use cases.
 */
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  const AI_URL = process.env.AI_SERVICE_URL;

  // Clean up uploaded file if we're going to error out
  const cleanup = () => {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  };

  if (!AI_URL) {
    cleanup();
    return res.status(503).json({
      success: false,
      error: 'Server-side AI not configured.',
      hint: 'Set AI_SERVICE_URL env var on Render, or use browser-based detection.',
    });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded.' });
  }

  try {
    const axios    = require('axios');
    const FormData = require('form-data');

    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(`${AI_URL}/detect`, formData, {
      headers: formData.getHeaders(),
      timeout: 20000,
    });

    cleanup();

    res.json({ success: true, ...aiResponse.data });

  } catch (error: any) {
    cleanup();
    console.error('❌ Vision detect error:', error.message);
    res.status(500).json({
      success: false,
      error: 'AI service detection failed.',
      detail: error.message,
    });
  }
});

export default router;