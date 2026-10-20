import { api } from '@/api/client';

// Calls server/functions/sendAttendanceReport.js — returns { data, status }
export const sendAttendanceReport = (payload) => api.functions.invoke('sendAttendanceReport', payload);
export default sendAttendanceReport;
