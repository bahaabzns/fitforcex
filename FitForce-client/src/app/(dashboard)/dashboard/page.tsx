'use client';

import { useAppSelector } from '@/store';
import DashboardEnhanced from '@/views/dashboard/DashboardEnhanced';

export default function DashboardPage() {
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);
  
  // If we're on a workspace subdomain, show the enhanced dashboard
  if (workspaceSubdomain) {
    return <DashboardEnhanced />;
  }
  
  // If we're on the main domain, redirect to workspaces
  return (
    <div>
      <script dangerouslySetInnerHTML={{
        __html: `window.location.replace('/dashboard/workspaces');`
      }} />
    </div>
  );
}
