const isLocal = window.location.hostname === 'localhost';

// 1. The Main "Brain" (Database, Rules, Alerts)
export const MAIN_BACKEND_URL = isLocal 
  ? 'http://localhost:5000' 
  : 'https://ai-vision-platform.onrender.com';

// 2. The AI "Eyes" (YOLO Detection)
export const AI_SERVICE_URL = isLocal 
  ? 'http://localhost:10000' 
  : 'https://ai-vision-platform-1.onrender.com';

// 3. For backward compatibility in your ImageUpload component
export const API_BASE_URL = AI_SERVICE_URL;

// 4. For Sockets
export const SOCKET_URL = MAIN_BACKEND_URL;