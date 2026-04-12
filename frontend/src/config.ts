const isLocal = window.location.hostname === 'localhost';

// 1. The Main Backend (General tasks, Sockets, Database)
export const MAIN_BACKEND_URL = isLocal 
  ? 'http://localhost:5000' 
  : 'https://ai-vision-platform.onrender.com';

// 2. The AI Service (Object Detection, Classification - The one with "-1")
export const AI_SERVICE_URL = isLocal 
  ? 'http://localhost:10000' // Render default local port for the AI service
  : 'https://ai-vision-platform-1.onrender.com';

// 3. Keep API_BASE_URL pointing to the AI service for your ImageUpload component
export const API_BASE_URL = AI_SERVICE_URL;

// 4. Sockets usually belong to the main backend
export const SOCKET_URL = MAIN_BACKEND_URL;