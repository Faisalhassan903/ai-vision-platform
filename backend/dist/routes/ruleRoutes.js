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
const router = express_1.default.Router();
// ─── GET all rules ────────────────────────────────────────────────────────────
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rules = yield AlertRule_1.default.find().sort({ createdAt: -1 });
        res.json(rules); // plain array — frontend uses Array.isArray()
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
}));
// ─── POST create new rule ─────────────────────────────────────────────────────
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('📥 New rule received:', (_a = req.body) === null || _a === void 0 ? void 0 : _a.name);
    try {
        const newRule = new AlertRule_1.default(req.body);
        yield newRule.save();
        res.status(201).json(newRule);
    }
    catch (err) {
        console.error('❌ Rule save failed:', err.message);
        res.status(400).json({ message: err.message });
    }
}));
// ─── PATCH /:id/trigger ───────────────────────────────────────────────────────
// IMPORTANT: must be registered BEFORE /:id — otherwise Express matches /:id first
router.patch('/:id/trigger', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rule = yield AlertRule_1.default.findByIdAndUpdate(req.params.id, {
            $inc: { triggerCount: 1 },
            lastTriggered: new Date(),
        }, { new: true });
        if (!rule)
            return res.status(404).json({ message: 'Rule not found' });
        res.json({
            success: true,
            triggerCount: rule.triggerCount,
            lastTriggered: rule.lastTriggered,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
}));
// ─── PATCH /:id (general update — enable/disable, edit) ──────────────────────
router.patch('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rule = yield AlertRule_1.default.findByIdAndUpdate(req.params.id, Object.assign({}, req.body), { new: true, runValidators: true });
        if (!rule)
            return res.status(404).json({ message: 'Rule not found' });
        res.json(rule);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
}));
// ─── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield AlertRule_1.default.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rule deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
}));
exports.default = router;
