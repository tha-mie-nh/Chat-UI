declare global { interface Window { BACKEND_URL?: string } }

const backendUrl = window.BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? '';
export const apiBase = backendUrl ? `${backendUrl}/api` : '/api';
