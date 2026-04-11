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
const AlertRule_1 = __importDefault(require("../models/AlertRule"));
const Alert_1 = __importDefault(require("../models/Alert"));
const router = express_1.default.Router();
// GET /api/alerts - Get recent alerts
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const priority = req.query.priority;
        const acknowledged = req.query.acknowledged;
        const query = {};
        if (priority) {
            query.priority = priority;
        }
        if (acknowledged !== undefined) {
            query.acknowledged = acknowledged === 'true';
        }
        const alerts = yield Alert_1.default.find(query)
            .sort({ timestamp: -1 })
            .limit(limit);
        res.json({
            success: true,
            count: alerts.length,
            alerts: alerts
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// POST /api/alerts/:id/acknowledge - Acknowledge alert
router.post('/:id/acknowledge', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alert = yield Alert_1.default.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ success: false, error: 'Alert not found' });
        }
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = req.body.user || 'User';
        alert.notes = req.body.notes;
        yield alert.save();
        res.json({
            success: true,
            alert: alert
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/alerts/rules - Get all alert rules
router.get('/rules', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rules = yield AlertRule_1.default.find().sort({ priority: -1, name: 1 });
        res.json({
            success: true,
            count: rules.length,
            rules: rules
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// POST /api/alerts/rules - Create alert rule
router.post('/rules', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rule = new AlertRule_1.default(req.body);
        yield rule.save();
        res.json({
            success: true,
            rule: rule
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// PUT /api/alerts/rules/:id - Update alert rule
router.put('/rules/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rule = yield AlertRule_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }
        res.json({
            success: true,
            rule: rule
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// DELETE /api/alerts/rules/:id - Delete alert rule
router.delete('/rules/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rule = yield AlertRule_1.default.findByIdAndDelete(req.params.id);
        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }
        res.json({
            success: true,
            message: 'Rule deleted'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
// GET /api/alerts/stats - Get alert statistics
router.get('/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const total = yield Alert_1.default.countDocuments();
        const unacknowledged = yield Alert_1.default.countDocuments({ acknowledged: false });
        const critical = yield Alert_1.default.countDocuments({ priority: 'critical' });
        const warning = yield Alert_1.default.countDocuments({ priority: 'warning' });
        const info = yield Alert_1.default.countDocuments({ priority: 'info' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = yield Alert_1.default.countDocuments({ timestamp: { $gte: today } });
        res.json({
            success: true,
            stats: {
                total,
                unacknowledged,
                todayCount,
                byPriority: {
                    critical,
                    warning,
                    info
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}));
exports.default = router;
