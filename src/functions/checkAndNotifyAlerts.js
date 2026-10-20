import { api } from '@/api/client';

// Calls server/functions/checkAndNotifyAlerts.js — returns { data, status }
export const checkAndNotifyAlerts = (payload) => api.functions.invoke('checkAndNotifyAlerts', payload);
export default checkAndNotifyAlerts;
