import { createContext, useContext } from 'react';
import type { AdminUser } from '@/types';

export interface AdminAuthValue {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth 必须在 AdminAuthProvider 内使用');
  return ctx;
}
