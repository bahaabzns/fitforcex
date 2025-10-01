// project-imports
import DashboardLayout from 'layout/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  // Client area uses its own cookie; avoid general AuthGuard to prevent redirect loops
  return <DashboardLayout>{children}</DashboardLayout>;
}


