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
const Detection_1 = __importDefault(require("../models/Detection"));
const router = express_1.default.Router();
// GET /api/analytics/recent - Get recent detections
router.get('/recent', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const detections = yield Detection_1.default.find()
            .sort({ timestamp: -1 }) // Newest first
            .limit(limit);
        res.json({
            success: true,
            count: detections.length,
            detections: detections
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// GET /api/analytics/stats - Get statistics
router.get('/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Total detections
        const totalDetections = yield Detection_1.default.countDocuments();
        // Detections today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const detectionsToday = yield Detection_1.default.countDocuments({
            timestamp: { $gte: today }
        });
        // Detections by class
        const byClass = yield Detection_1.default.aggregate([
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
        const byCamera = yield Detection_1.default.aggregate([
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// GET /api/analytics/search - Search detections
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cameraId, class: objectClass, startDate, endDate, minConfidence } = req.query;
        // Build query
        const query = {};
        if (cameraId) {
            query.cameraId = cameraId;
        }
        if (objectClass) {
            query['detections.class'] = objectClass;
        }
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }
        if (minConfidence) {
            query['detections.confidence'] = {
                $gte: parseFloat(minConfidence)
            };
        }
        const detections = yield Detection_1.default.find(query)
            .sort({ timestamp: -1 })
            .limit(100);
        res.json({
            success: true,
            count: detections.length,
            query: query,
            detections: detections
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// GET /api/analytics/timeline - Detections over time
router.get('/timeline', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const timeline = yield Detection_1.default.aggregate([
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
exports.default = router;
