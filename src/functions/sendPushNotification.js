import { api } from '@/api/client';

// Calls server/functions/sendPushNotification.js — returns { data, status }
export const sendPushNotification = (payload) => api.functions.invoke('sendPushNotification', payload);
export default sendPushNotification;
