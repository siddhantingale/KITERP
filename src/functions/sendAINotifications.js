import { api } from '@/api/client';

// Calls server/functions/sendAINotifications.js — returns { data, status }
export const sendAINotifications = (payload) => api.functions.invoke('sendAINotifications', payload);
export default sendAINotifications;
