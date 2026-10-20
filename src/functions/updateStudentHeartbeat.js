import { api } from '@/api/client';

// Calls server/functions/updateStudentHeartbeat.js — returns { data, status }
export const updateStudentHeartbeat = (payload) => api.functions.invoke('updateStudentHeartbeat', payload);
export default updateStudentHeartbeat;
