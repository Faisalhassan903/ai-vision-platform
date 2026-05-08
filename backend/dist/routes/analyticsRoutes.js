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
const Alert_1 = __importDefault(require("../models/Alert"));
const router = express_1.default.Router();
// GET /api/analytics/stats
router.get('/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const total = yield Alert_1.default.countDocuments();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = yield Alert_1.default.countDocuments({ timestamp: { $gte: today } });
        // Top detected object classes across all alerts
        const byClass = yield Alert_1.default.aggregate([
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
        const byCamera = yield Alert_1.default.aggregate([
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
        const byPriority = yield Alert_1.default.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);
        // Alerts by rule
        const byRule = yield Alert_1.default.aggregate([
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
    }
    catch (error) {
        console.error('Analytics stats error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/analytics/recent
router.get('/recent', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const alerts = yield Alert_1.default.find()
            .sort({ timestamp: -1 })
            .limit(limit);
        // Shape response to match what Analytics.tsx expects
        const detections = alerts.map(a => {
            var _a;
            return ({
                _id: a._id,
                timestamp: a.timestamp,
                cameraId: a.cameraId || 'cam_01',
                cameraName: a.cameraName || 'Sentry_Node_01',
                detections: a.detections || [],
                totalObjects: ((_a = a.detections) === null || _a === void 0 ? void 0 : _a.length) || 0,
                alertSent: true, // all records in Alert collection triggered an alert
            });
        });
        res.json({ success: true, count: detections.length, detections });
    }
    catch (error) {
        console.error('Analytics recent error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/analytics/timeline
router.get('/timeline', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const timeline = yield Alert_1.default.aggregate([
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/analytics/search
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ruleName, priority, startDate, endDate } = req.query;
        const query = {};
        if (ruleName)
            query.ruleName = new RegExp(ruleName, 'i');
        if (priority)
            query.priority = priority;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate)
                query.timestamp.$gte = new Date(startDate);
            if (endDate)
                query.timestamp.$lte = new Date(endDate);
        }
        const alerts = yield Alert_1.default.find(query).sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, count: alerts.length, detections: alerts });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;
