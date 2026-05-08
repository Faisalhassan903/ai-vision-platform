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
// POST /api/alerts — save new alert from LiveCamera
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { ruleName, priority, message, cameraId, cameraName, analytics, detections } = req.body;
        if (!ruleName || !priority) {
            return res.status(400).json({ success: false, error: 'Missing required fields: ruleName and priority.' });
        }
        const validPriorities = ['info', 'warning', 'critical'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ success: false, error: `Invalid priority. Must be: ${validPriorities.join(', ')}` });
        }
        const newAlert = new Alert_1.default({
            ruleName,
            priority,
            message: message || `Security trigger: ${ruleName}`,
            cameraId: cameraId || null,
            cameraName: cameraName || 'Sentry_Node_01',
            timestamp: new Date(),
            acknowledged: false,
            analytics: {
                device_id: (analytics === null || analytics === void 0 ? void 0 : analytics.device_id) || 'UNKNOWN_NODE',
                primary_target: (analytics === null || analytics === void 0 ? void 0 : analytics.primary_target) || ((_a = detections === null || detections === void 0 ? void 0 : detections[0]) === null || _a === void 0 ? void 0 : _a.class) || 'unknown',
                confidence_avg: (analytics === null || analytics === void 0 ? void 0 : analytics.confidence_avg) || 0,
            },
            detections: (detections || []).map((d) => ({
                class: d.class || 'unknown',
                confidence: typeof d.confidence === 'number' ? d.confidence : 0,
                bbox: d.bbox || null,
            }))
        });
        const savedAlert = yield newAlert.save();
        const io = req.app.get('socketio');
        if (io)
            io.emit('new-incident', savedAlert);
        res.status(201).json({ success: true, alert: savedAlert });
    }
    catch (error) {
        console.error('🚨 Alert Save Failure:', error.message);
        res.status(500).json({ success: false, error: 'Database rejection.', detail: error.message });
    }
}));
// GET /api/alerts — fetch recent alerts for dashboard
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alerts = yield Alert_1.default.find().sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, count: alerts.length, alerts });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve alerts.' });
    }
}));
// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alert = yield Alert_1.default.findByIdAndUpdate(req.params.id, { acknowledged: true, acknowledgedAt: new Date() }, { new: true });
        if (!alert)
            return res.status(404).json({ success: false, error: 'Alert not found.' });
        res.json({ success: true, alert });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;
