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
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // This looks for the variable you set in Render's dashboard
        // If it's not found, it uses your local string as a backup
        const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_vision_security';
        const conn = yield mongoose_1.default.connect(dbUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Optional: exit(1) if you want the app to crash when DB fails
    }
});
exports.default = connectDB;
