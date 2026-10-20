import { api } from '@/api/client';

// Calls server/functions/logQRPortalAccess.js — returns { data, status }
export const logQRPortalAccess = (payload) => api.functions.invoke('logQRPortalAccess', payload);
export default logQRPortalAccess;
