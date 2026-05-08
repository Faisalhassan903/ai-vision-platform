"use strict";
// database.ts
// Connection is handled in server.ts start() function.
// This file is kept only for any future shared DB utilities.
// DO NOT call mongoose.connect() here — server.ts already does it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDBState = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const getDBState = () => {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    return states[mongoose_1.default.connection.readyState] || 'unknown';
};
exports.getDBState = getDBState;
exports.default = mongoose_1.default;
