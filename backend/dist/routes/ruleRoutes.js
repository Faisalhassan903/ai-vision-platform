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
// GET all rules
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rules = yield AlertRule_1.default.find();
        res.json(rules);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
}));
// POST a new rule
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Data received from frontend:", req.body); // Check this in your terminal
    try {
        const newRule = new AlertRule_1.default(req.body);
        yield newRule.save();
        res.status(201).json(newRule);
    }
    catch (err) {
        console.error("Mongoose Validation Error:", err.message); // This tells you WHY it failed
        res.status(400).json({ message: err.message });
    }
}));
// DELETE a rule
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
