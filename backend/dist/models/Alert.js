"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const AlertSchema = new mongoose_1.Schema({
    ruleId: {
        type: mongoose_1.Schema.Types.Mixed, // More flexible for AI triggers
        ref: 'AlertRule',
        required: false
    },
    ruleName: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    cameraId: {
        type: String,
        required: false // Fixed: Don't crash if ID isn't ready
    },
    cameraName: {
        type: String,
        default: "Default Node"
    },
    detections: [{
            class: { type: String, index: true }, // Index this for faster "Top Detections" queries
            confidence: Number,
            bbox: mongoose_1.Schema.Types.Mixed
        }],
    // --- ADDED FOR ANALYTICS MISSION ---
    analytics: {
        device_id: { type: String, index: true },
        primary_target: { type: String, index: true },
        confidence_avg: Number
    },
    snapshot: {
        type: String
    },
    acknowledged: {
        type: Boolean,
        default: false,
        index: true
    },
    acknowledgedBy: {
        type: String
    },
    acknowledgedAt: {
        type: Date
    },
    notes: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});
// Optimized compound indexes for the dashboard
AlertSchema.index({ 'analytics.primary_target': 1, timestamp: -1 });
AlertSchema.index({ priority: 1, timestamp: -1 });
exports.default = mongoose_1.default.model('Alert', AlertSchema);
