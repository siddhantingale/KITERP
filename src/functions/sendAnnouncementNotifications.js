import { api } from '@/api/client';

// Calls server/functions/sendAnnouncementNotifications.js — returns { data, status }
export const sendAnnouncementNotifications = (payload) => api.functions.invoke('sendAnnouncementNotifications', payload);
export default sendAnnouncementNotifications;
