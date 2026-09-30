/**
 * Base URL for API calls. Empty by default: requests go to "/api/..." on the same origin.
 *  - Development: Vite proxies /api to http://localhost:5000 (see vite.config.js)
 *  - Production: Vercel rewrites /api to the Render backend (see vercel.json)
 * Same-origin requests keep the HttpOnly session cookie first-party, which browsers that
 * block third-party cookies (Safari, Firefox, some Chrome setups) require.
 *
 * Set VITE_API_URL only to call a backend on another origin directly (not recommended).
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default API_BASE_URL;
