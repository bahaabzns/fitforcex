// project-imports
import DashboardLayout from 'layout/DashboardLayout';
import { ClientSidebarProvider } from '@/contexts/ClientSidebarContext';
import { PageTitleSetter } from '@/components/PageTitleSetter';

export default function Layout({ children }: { children: React.ReactNode }) {
  // Client area uses its own cookie; avoid general AuthGuard to prevent redirect loops
  return (
    <ClientSidebarProvider>
      <PageTitleSetter />
      <DashboardLayout>{children}</DashboardLayout>
    </ClientSidebarProvider>
  );
}


