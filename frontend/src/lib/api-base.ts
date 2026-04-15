// Runtime config: BACKEND_URL injected by Docker via /config.js → window.BACKEND_URL
// Dev: set VITE_BACKEND_URL in .env.local (e.g. http://localhost:3001)
declare global { interface Window { BACKEND_URL?: string } }

const backendUrl = window.BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? '';
export const apiBase = backendUrl ? `${backendUrl}/api` : '/api';
