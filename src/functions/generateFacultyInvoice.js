import { api } from '@/api/client';

// Calls server/functions/generateFacultyInvoice.js — returns { data, status }
export const generateFacultyInvoice = (payload) => api.functions.invoke('generateFacultyInvoice', payload);
export default generateFacultyInvoice;
