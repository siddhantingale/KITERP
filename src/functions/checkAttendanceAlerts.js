import { api } from '@/api/client';

// Calls server/functions/checkAttendanceAlerts.js — returns { data, status }
export const checkAttendanceAlerts = (payload) => api.functions.invoke('checkAttendanceAlerts', payload);
export default checkAttendanceAlerts;
