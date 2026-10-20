import { api } from '@/api/client';

// Calls server/functions/distributeAnalysisReport.js — returns { data, status }
export const distributeAnalysisReport = (payload) => api.functions.invoke('distributeAnalysisReport', payload);
export default distributeAnalysisReport;
