import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import Detection from '../models/Detection';

const router = express.Router();

// 🔥 USE ENV VARIABLE
const AI_URL = process.env.AI_SERVICE_URL;

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ─────────────────────────────
// 🚀 DETECT ROUTE (FIXED)
// ─────────────────────────────
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    if (!AI_URL) {
      throw new Error('AI_SERVICE_URL missing');
    }

    console.log('📤 Sending to AI:', AI_URL);

    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(`${AI_URL}/detect`, formData, {
      headers: formData.getHeaders(),
      timeout: 20000
    });

    fs.unlinkSync(req.file.path);

    const data = aiResponse.data;

    // 💾 Save to DB
    const record = new Detection({
      timestamp: new Date(),
      cameraId: 'cam_01',
      cameraName: 'Main Camera',
      detections: data.detections || [],
      totalObjects: data.total_objects || 0,
      alertSent: false
    });

    await record.save();

    console.log('💾 Saved detection:', record._id);

    res.json({
      success: true,
      ...data,
      savedId: record._id
    });

  } catch (error: any) {
    console.error('❌ DETECT ERROR:', error.message);

    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    res.status(500).json({
      error: 'Detection failed',
      details: error.message
    });
  }
});

export default router;