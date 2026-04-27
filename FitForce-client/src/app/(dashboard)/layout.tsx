// project-imports
import DashboardLayout from 'layout/DashboardLayout';
import AuthGuard from 'utils/route-guard/AuthGuard';
import DashboardRouteGuard from 'utils/route-guard/DashboardRouteGuard';
import { ClientSidebarProvider } from '@/contexts/ClientSidebarContext';
import { PageTitleSetter } from '@/components/PageTitleSetter';

// ==============================|| DASHBOARD LAYOUT ||============================== //

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardRouteGuard>
        <ClientSidebarProvider>
          <PageTitleSetter />
          <DashboardLayout>{children}</DashboardLayout>
        </ClientSidebarProvider>
      </DashboardRouteGuard>
    </AuthGuard>
  );
}
