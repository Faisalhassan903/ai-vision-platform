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
const AlertRuleSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    priority: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        required: true
    },
    conditions: {
        objectClasses: {
            type: [String],
            required: true
        },
        minConfidence: {
            type: Number,
            default: 0.5,
            min: 0,
            max: 1
        },
        timeRange: {
            start: String,
            end: String
        },
        zones: [{
                name: String,
                x1: Number,
                y1: Number,
                x2: Number,
                y2: Number
            }]
    },
    actions: {
        notification: {
            type: Boolean,
            default: true
        },
        audioAlert: {
            type: Boolean,
            default: false
        },
        saveSnapshot: {
            type: Boolean,
            default: true
        },
        discord: {
            type: Boolean,
            default: false
        },
        email: {
            type: Boolean,
            default: false
        }
    },
    cooldownMinutes: {
        type: Number,
        default: 5
    },
    lastTriggered: {
        type: Date
    },
    triggerCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});
exports.default = mongoose_1.default.model('AlertRule', AlertRuleSchema);
