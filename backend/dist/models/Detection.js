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
// MongoDB Schema - defines structure and validation
const DetectionSchema = new mongoose_1.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true // Index for fast date queries
    },
    cameraId: {
        type: String,
        required: true,
        index: true // Index for fast camera queries
    },
    cameraName: {
        type: String,
        required: true
    },
    detections: [{
            class: {
                type: String,
                required: true
            },
            confidence: {
                type: Number,
                required: true,
                min: 0,
                max: 1
            },
            bbox: {
                x1: { type: Number, required: true },
                y1: { type: Number, required: true },
                x2: { type: Number, required: true },
                y2: { type: Number, required: true },
                width: { type: Number, required: true },
                height: { type: Number, required: true }
            }
        }],
    totalObjects: {
        type: Number,
        required: true,
        default: 0
    },
    alertSent: {
        type: Boolean,
        default: false
    },
    alertType: {
        type: String,
        required: false
    },
    imageUrl: {
        type: String,
        required: false
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});
// Create indexes for better query performance
DetectionSchema.index({ timestamp: -1, cameraId: 1 }); // Compound index
exports.default = mongoose_1.default.model('Detection', DetectionSchema);
