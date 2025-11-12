'use client';

import { ReactNode } from 'react';
import DashboardLayout from 'layout/DashboardLayout';
import AuthGuard from 'utils/route-guard/AuthGuard';
import { ClientSidebarProvider } from '@/contexts/ClientSidebarContext';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ClientSidebarProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ClientSidebarProvider>
    </AuthGuard>
  );
}

