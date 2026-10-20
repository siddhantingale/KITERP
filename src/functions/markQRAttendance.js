import { api } from '@/api/client';

// Calls server/functions/markQRAttendance.js — returns { data, status }
export const markQRAttendance = (payload) => api.functions.invoke('markQRAttendance', payload);
export default markQRAttendance;
