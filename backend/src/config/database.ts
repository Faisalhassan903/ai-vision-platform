// database.ts
// Connection is handled in server.ts start() function.
// This file is kept only for any future shared DB utilities.
// DO NOT call mongoose.connect() here — server.ts already does it.

import mongoose from 'mongoose';

export const getDBState = () => {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

export default mongoose;