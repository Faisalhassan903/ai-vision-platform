// config.ts

const isLocal = window.location.hostname === 'localhost';

// The Node.js Backend (Handles Auth, DB, and Sockets)
export const MAIN_BACKEND_URL = isLocal 
  ? 'http://localhost:10000' // Matches the PORT in your server.ts
  : 'https://ai-vision-platform.onrender.com';

// The Python AI Service (If you're using the separate app.py)
export const AI_SERVICE_URL = isLocal 
  ? 'http://localhost:5000' 
  : 'https://ai-vision-platform-1.onrender.com';

// Consolidated Exports
export const API_BASE_URL = MAIN_BACKEND_URL;
export const SOCKET_URL = MAIN_BACKEND_URL;

// Debugging Helper
if (isLocal) {
  console.log("🛠️ Running in Local Mode");
  console.log("🔗 API Path:", API_BASE_URL);
}