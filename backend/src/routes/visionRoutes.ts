import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import Detection from '../models/Detection';

const router = express.Router();

// --- MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// --- DETECT ---
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const AI_URL = process.env.AI_SERVICE_URL;
    if (!AI_URL) throw new Error("AI_SERVICE_URL missing");

    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

    const aiResponse = await axios.post(`${AI_URL}/detect`, formData, {
      headers: formData.getHeaders()
    });

    fs.unlinkSync(req.file.path);

    const detections = aiResponse.data.detections;

    // SAVE DETECTION
    const record = await Detection.create({
      timestamp: new Date(),
      cameraId: 'cam_01',
      cameraName: 'Main Camera',
      detections,
      totalObjects: aiResponse.data.total_objects
    });

    // --- RULE ENGINE ---
    const Alert = require('../models/Alert').default;
    const AlertRule = require('../models/AlertRule').default;

    const rules = await AlertRule.find({ enabled: true });

    for (const rule of rules) {
      const match = detections.find((d: any) =>
        rule.conditions.objectClasses.includes(d.class) &&
        d.confidence >= rule.conditions.minConfidence
      );

      if (match) {
        const alert = await Alert.create({
          ruleName: rule.name,
          priority: rule.priority,
          message: `Detected ${match.class}`,
          timestamp: new Date(),
          detections: [match]
        });

        const io = req.app.get('socketio');
        if (io) io.emit('new-incident', alert);

        console.log("🚨 ALERT TRIGGERED:", rule.name);
        break;
      }
    }

    res.json({
      success: true,
      detections,
      savedId: record._id
    });

  } catch (err: any) {
    console.error(err.message);

    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    res.status(500).json({ error: err.message });
  }
});

export default router;