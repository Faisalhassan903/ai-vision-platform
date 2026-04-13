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
/**
 * @route   POST /api/alerts
 * @desc    Log a new AI security incident and trigger real-time alerts
 */
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { ruleName, priority, message, analytics, detections } = req.body;
        // 1. DATA VALIDATION: Ensure the mission-critical fields exist
        if (!ruleName || !priority) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: ruleName and priority are mandatory."
            });
        }
        // 2. CREATE INCIDENT: Mapping data for Analytics
        const newAlert = new Alert_1.default({
            ruleName,
            priority,
            message: message || `Security trigger: ${ruleName}`,
            timestamp: new Date(),
            acknowledged: false,
            // Nesting analytics data for the dashboard charts
            analytics: {
                device_id: (analytics === null || analytics === void 0 ? void 0 : analytics.device_id) || "UNKNOWN_NODE",
                primary_target: (analytics === null || analytics === void 0 ? void 0 : analytics.primary_target) || ((_a = detections === null || detections === void 0 ? void 0 : detections[0]) === null || _a === void 0 ? void 0 : _a.class),
                confidence_avg: (analytics === null || analytics === void 0 ? void 0 : analytics.confidence_avg) || 0,
            },
            detections: detections || []
        });
        const savedAlert = yield newAlert.save();
        // 3. REAL-TIME EMIT: Use volatile for high-frequency alerts to prevent socket lag
        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-incident', savedAlert); // Match this string in your frontend hook
        }
        // 4. TELEGRAM NOTIFICATION (Optional Hook)
        // If you have a telegram service, call it here:
        // telegramService.sendAlert(savedAlert);
        res.status(201).json({ success: true, alert: savedAlert });
    }
    catch (error) {
        console.error("🚨 CRITICAL: Alert Save Failure:", error.message);
        res.status(500).json({ success: false, error: "Database rejection on incident log." });
    }
}));
/**
 * @route   GET /api/alerts
 * @desc    Fetch recent incidents for analytics and logging
 */
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Pagination: Only get last 100 to keep the dashboard fast
        const alerts = yield Alert_1.default.find()
            .sort({ timestamp: -1 })
            .limit(100);
        res.json({ success: true, count: alerts.length, alerts });
    }
    catch (error) {
        res.status(500).json({ success: false, error: "Failed to retrieve incident logs." });
    }
}));
/**
 * @route   PATCH /api/alerts/:id/acknowledge
 * @desc    Mark incident as handled
 */
router.patch('/:id/acknowledge', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alert = yield Alert_1.default.findByIdAndUpdate(req.params.id, { acknowledged: true, handledAt: new Date() }, { new: true });
        if (!alert)
            return res.status(404).json({ success: false, error: "Incident not found." });
        res.json({ success: true, alert });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;
