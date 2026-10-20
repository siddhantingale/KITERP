import { api } from '@/api/client';

// Calls server/functions/fixDuplicateStudents.js — returns { data, status }
export const fixDuplicateStudents = (payload) => api.functions.invoke('fixDuplicateStudents', payload);
export default fixDuplicateStudents;
