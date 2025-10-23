// project-imports
import DashboardLayout from 'layout/DashboardLayout';
import AuthGuard from 'utils/route-guard/AuthGuard';
import { ClientSidebarProvider } from '@/contexts/ClientSidebarContext';

// ==============================|| DASHBOARD LAYOUT ||============================== //

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ClientSidebarProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ClientSidebarProvider>
    </AuthGuard>
  );
}
