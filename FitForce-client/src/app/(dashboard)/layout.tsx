// project-imports
import DashboardLayout from 'layout/DashboardLayout';
import AuthGuard from 'utils/route-guard/AuthGuard';
import DashboardRouteGuard from 'utils/route-guard/DashboardRouteGuard';
import { ClientSidebarProvider } from '@/contexts/ClientSidebarContext';

// ==============================|| DASHBOARD LAYOUT ||============================== //

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardRouteGuard>
        <ClientSidebarProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </ClientSidebarProvider>
      </DashboardRouteGuard>
    </AuthGuard>
  );
}
