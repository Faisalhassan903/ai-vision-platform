// config.ts

const isLocal = window.location.hostname === 'localhost';

export const MAIN_BACKEND_URL = isLocal 
  ? 'http://localhost:5000' 
  : 'https://ai-vision-platform.onrender.com';

export const AI_SERVICE_URL = isLocal 
  ? 'http://localhost:10000' 
  : 'https://ai-vision-platform-1.onrender.com';

// FIX THIS LINE: Point to MAIN_BACKEND_URL instead of AI_SERVICE_URL
export const API_BASE_URL = MAIN_BACKEND_URL;

export const SOCKET_URL = MAIN_BACKEND_URL;