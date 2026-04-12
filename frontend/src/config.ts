

// src/config.ts

const isLocal = window.location.hostname === 'localhost';

export const API_BASE_URL = isLocal 
  ? 'http://localhost:5000' // Match whatever your local backend port actually is
  : 'https://ai-vision-platform.onrender.com';

// For Sockets, it's safer to provide the raw domain
export const SOCKET_URL = API_BASE_URL;