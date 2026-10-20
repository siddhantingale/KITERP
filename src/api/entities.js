// Kept for backwards compatibility — prefer '@/entities/all'.
export * from '@/entities/all';
import { api } from '@/api/client';
export const Query = api.entities.Query;
