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
function updatePersonRule() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield mongoose_1.default.connect('mongodb://localhost:27017/ai_vision_security');
            console.log('✅ Connected to MongoDB');
            // Update Person Detection to CRITICAL
            const result = yield AlertRule_1.default.updateOne({ name: 'Person Detection' }, {
                $set: {
                    priority: 'critical',
                    description: 'CRITICAL: Unauthorized person detected in restricted area',
                    actions: {
                        notification: true,
                        audioAlert: true,
                        saveSnapshot: true,
                        discord: true,
                        email: false
                    },
                    cooldownMinutes: 1
                }
            });
            console.log('✅ Updated Person Detection to CRITICAL');
            console.log('Result:', result);
            yield mongoose_1.default.disconnect();
            console.log('✅ Done!');
        }
        catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    });
}
updatePersonRule();
