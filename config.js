/**
 * SENTINEL — Backend Configuration
 * After deploying to Railway, paste your Railway URL below.
 */
const SENTINEL_CONFIG = {
  BACKEND: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://YOUR_RAILWAY_URL.up.railway.app',  // ← update this after Railway deploy
};
