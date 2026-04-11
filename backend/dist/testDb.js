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
const Detection_1 = __importDefault(require("./models/Detection"));
const testDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to MongoDB
        yield mongoose_1.default.connect('mongodb://localhost:27017/ai_vision_security');
        console.log('✅ Connected to MongoDB\n');
        // Count total detections
        const count = yield Detection_1.default.countDocuments();
        console.log(`📊 Total detections in database: ${count}\n`);
        // Get latest 5 detections
        const latestDetections = yield Detection_1.default.find()
            .sort({ timestamp: -1 })
            .limit(5);
        console.log('🕐 Latest 5 detections:');
        latestDetections.forEach((det, idx) => {
            console.log(`\n${idx + 1}. Detection ID: ${det._id}`);
            console.log(`   Camera: ${det.cameraName}`);
            console.log(`   Time: ${det.timestamp}`);
            console.log(`   Objects: ${det.totalObjects}`);
            det.detections.forEach((obj, i) => {
                console.log(`     ${i + 1}) ${obj.class} - ${(obj.confidence * 100).toFixed(1)}%`);
            });
        });
        yield mongoose_1.default.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
});
testDB();
