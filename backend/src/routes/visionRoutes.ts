import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import Detection from '../models/Detection';
const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// POST /api/vision/classify - Upload and classify image
router.post('/classify', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('📤 Sending image to AI service...');

    // Create form data to send to Python AI service
    const formData = new FormData();
    const fileStream = fs.createReadStream(req.file.path);
    formData.append('image', fileStream, req.file.originalname);

    // Send to AI service
    const aiResponse = await axios.post('http://localhost:5001/predict', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('✅ Received prediction from AI service');

    // Clean up: Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Return AI predictions to frontend
    res.json({
      success: true,
      filename: req.file.originalname,
      predictions: aiResponse.data.predictions,
      topPrediction: aiResponse.data.top_prediction,
      topConfidence: aiResponse.data.top_confidence
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ 
      error: 'Failed to process image',
      details: error.message 
    });
  }
});



// POST /api/vision/detect - Object Detection with YOLO

// POST /api/vision/detect - Object Detection with YOLO
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('📤 Sending image to AI service for object detection...');

    // Create form data to send to Python AI service
    const formData = new FormData();
    const fileStream = fs.createReadStream(req.file.path);
    formData.append('image', fileStream, req.file.originalname);

    // Send to AI service DETECT endpoint
    const aiResponse = await axios.post('http://localhost:5001/detect', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('✅ Received detections from AI service');
    console.log(`   Found ${aiResponse.data.total_objects} objects`);
    console.log(`   Has image_with_boxes? ${!!aiResponse.data.image_with_boxes}`);

    // Clean up: Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Return ALL DATA including image_with_boxes to frontend
    // Save detection to MongoDB
const detectionRecord = new Detection({
  timestamp: new Date(),
  cameraId: 'cam_01',  // TODO: Make this dynamic later
  cameraName: 'Main Camera',
  detections: aiResponse.data.detections.map((det: any) => ({
    class: det.class,
    confidence: det.confidence,
    bbox: det.bbox
  })),
  totalObjects: aiResponse.data.total_objects,
  alertSent: false
});

await detectionRecord.save();

console.log('💾 Saved to MongoDB with ID:', detectionRecord._id);

// Return ALL DATA including image_with_boxes to frontend
res.json({
  success: true,
  filename: req.file.originalname,
  detections: aiResponse.data.detections,
  totalObjects: aiResponse.data.total_objects,
  image_with_boxes: aiResponse.data.image_with_boxes,
  savedId: detectionRecord._id  // Include MongoDB ID in response
});

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    // Clean up file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ 
      error: 'Failed to detect objects',
      details: error.message 
    });
  }
});
export default router;
