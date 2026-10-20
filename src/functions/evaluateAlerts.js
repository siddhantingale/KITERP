import { api } from '@/api/client';

// Calls server/functions/evaluateAlerts.js — returns { data, status }
export const evaluateAlerts = (payload) => api.functions.invoke('evaluateAlerts', payload);
export default evaluateAlerts;
