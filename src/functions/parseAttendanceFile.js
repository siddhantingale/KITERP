import { api } from '@/api/client';

// Calls server/functions/parseAttendanceFile.js — returns { data, status }
export const parseAttendanceFile = (payload) => api.functions.invoke('parseAttendanceFile', payload);
export default parseAttendanceFile;
