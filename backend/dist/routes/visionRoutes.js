"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const Detection_1 = __importDefault(require("../models/Detection"));
const router = express_1.default.Router();
// Configure Multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});
// POST /api/vision/classify - Upload and classify image
router.post('/classify', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        console.log('📤 Sending image to AI service...');
        // Create form data to send to Python AI service
        const formData = new form_data_1.default();
        const fileStream = fs_1.default.createReadStream(req.file.path);
        formData.append('image', fileStream, req.file.originalname);
        // Send to AI service
        const aiResponse = yield axios_1.default.post('http://localhost:5001/predict', formData, {
            headers: Object.assign({}, formData.getHeaders()),
        });
        console.log('✅ Received prediction from AI service');
        // Clean up: Delete uploaded file after processing
        fs_1.default.unlinkSync(req.file.path);
        // Return AI predictions to frontend
        res.json({
            success: true,
            filename: req.file.originalname,
            predictions: aiResponse.data.predictions,
            topPrediction: aiResponse.data.top_prediction,
            topConfidence: aiResponse.data.top_confidence
        });
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        // Clean up file if it exists
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) { }
        }
        res.status(500).json({
            error: 'Failed to process image',
            details: error.message
        });
    }
}));
// POST /api/vision/detect - Object Detection with YOLO
// POST /api/vision/detect - Object Detection with YOLO
router.post('/detect', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        console.log('📤 Sending image to AI service for object detection...');
        // Create form data to send to Python AI service
        const formData = new form_data_1.default();
        const fileStream = fs_1.default.createReadStream(req.file.path);
        formData.append('image', fileStream, req.file.originalname);
        // Send to AI service DETECT endpoint
        const aiResponse = yield axios_1.default.post('http://localhost:5001/detect', formData, {
            headers: Object.assign({}, formData.getHeaders()),
        });
        console.log('✅ Received detections from AI service');
        console.log(`   Found ${aiResponse.data.total_objects} objects`);
        console.log(`   Has image_with_boxes? ${!!aiResponse.data.image_with_boxes}`);
        // Clean up: Delete uploaded file after processing
        fs_1.default.unlinkSync(req.file.path);
        // Return ALL DATA including image_with_boxes to frontend
        // Save detection to MongoDB
        const detectionRecord = new Detection_1.default({
            timestamp: new Date(),
            cameraId: 'cam_01', // TODO: Make this dynamic later
            cameraName: 'Main Camera',
            detections: aiResponse.data.detections.map((det) => ({
                class: det.class,
                confidence: det.confidence,
                bbox: det.bbox
            })),
            totalObjects: aiResponse.data.total_objects,
            alertSent: false
        });
        yield detectionRecord.save();
        console.log('💾 Saved to MongoDB with ID:', detectionRecord._id);
        // Return ALL DATA including image_with_boxes to frontend
        res.json({
            success: true,
            filename: req.file.originalname,
            detections: aiResponse.data.detections,
            totalObjects: aiResponse.data.total_objects,
            image_with_boxes: aiResponse.data.image_with_boxes,
            savedId: detectionRecord._id // Include MongoDB ID in response
        });
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        // Clean up file if it exists
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) { }
        }
        res.status(500).json({
            error: 'Failed to detect objects',
            details: error.message
        });
    }
}));
exports.default = router;
