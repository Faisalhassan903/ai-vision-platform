// If we are on Vercel/Render, use the Render URL. Otherwise, use localhost.
export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:10000' 
  : 'https://ai-vision-platform.onrender.com';

export const SOCKET_URL = API_BASE_URL;