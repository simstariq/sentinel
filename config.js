/**
 * SENTINEL — Backend Configuration
 * After deploying to Railway, paste your Railway URL below.
 */
const SENTINEL_CONFIG = {
  BACKEND: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'sentinel-production-70b1.up.railway.app',  // ← update this after Railway deploy
};
