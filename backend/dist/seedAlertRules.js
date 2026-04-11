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
const mongoose_1 = __importDefault(require("mongoose"));
const AlertRule_1 = __importDefault(require("./models/AlertRule"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const defaultRules = [
    {
        name: 'Person Detection',
        description: 'Alert when any person is detected',
        enabled: true,
        priority: 'warning',
        conditions: {
            objectClasses: ['person'],
            minConfidence: 0.6
        },
        actions: {
            notification: true,
            audioAlert: true,
            saveSnapshot: true,
            discord: false,
            email: false
        },
        cooldownMinutes: 2
    },
    {
        name: 'Weapon Detection - CRITICAL',
        description: 'Immediate alert for weapons or dangerous objects',
        enabled: true,
        priority: 'critical',
        conditions: {
            objectClasses: ['knife', 'scissors', 'baseball bat', 'tennis racket'],
            minConfidence: 0.5
        },
        actions: {
            notification: true,
            audioAlert: true,
            saveSnapshot: true,
            discord: true,
            email: false
        },
        cooldownMinutes: 1
    },
    {
        name: 'Suspicious Items',
        description: 'Alert for backpacks, bags, and luggage',
        enabled: true,
        priority: 'warning',
        conditions: {
            objectClasses: ['backpack', 'handbag', 'suitcase'],
            minConfidence: 0.65
        },
        actions: {
            notification: true,
            audioAlert: false,
            saveSnapshot: true,
            discord: false,
            email: false
        },
        cooldownMinutes: 3
    },
    {
        name: 'Night Time Person Detection',
        description: 'Alert if person detected between 10 PM and 6 AM',
        enabled: true,
        priority: 'critical',
        conditions: {
            objectClasses: ['person'],
            minConfidence: 0.6,
            timeRange: {
                start: '22:00',
                end: '06:00'
            }
        },
        actions: {
            notification: true,
            audioAlert: true,
            saveSnapshot: true,
            discord: true,
            email: false
        },
        cooldownMinutes: 5
    },
    {
        name: 'Vehicle Detection',
        description: 'Alert when vehicles are detected',
        enabled: false,
        priority: 'info',
        conditions: {
            objectClasses: ['car', 'truck', 'bus', 'motorcycle'],
            minConfidence: 0.7
        },
        actions: {
            notification: true,
            audioAlert: false,
            saveSnapshot: true,
            discord: false,
            email: false
        },
        cooldownMinutes: 10
    }
];
function seedAlertRules() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect('mongodb://localhost:27017/ai_vision_security');
            console.log('✅ Connected to MongoDB');
            // Clear existing rules (optional)
            // await AlertRule.deleteMany({});
            // console.log('🗑️ Cleared existing rules');
            // Check if rules already exist
            const existingCount = yield AlertRule_1.default.countDocuments();
            if (existingCount > 0) {
                console.log(`ℹ️ Found ${existingCount} existing rules. Skipping seed.`);
                console.log('💡 To reset rules, uncomment deleteMany() in the script.');
            }
            else {
                // Insert default rules
                yield AlertRule_1.default.insertMany(defaultRules);
                console.log(`✅ Created ${defaultRules.length} default alert rules!`);
                console.log('\n📋 Default Rules Created:');
                defaultRules.forEach((rule, idx) => {
                    console.log(`${idx + 1}. ${rule.name} (${rule.priority})`);
                });
            }
            yield mongoose_1.default.disconnect();
            console.log('\n✅ Done!');
        }
        catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    });
}
seedAlertRules();
