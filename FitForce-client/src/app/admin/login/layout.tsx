'use client';

import { AdminAuthProvider } from '@/contexts/AdminAuthContext';

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      {children}
    </AdminAuthProvider>
  );
}
