'use client';

import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace } from '@/store/slices/workspaceSlice';
import DashboardEnhanced from '@/views/dashboard/DashboardEnhanced';
import Loader from 'components/Loader';
import { APP_CONFIG } from '@/lib/config';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);
  const [checking, setChecking] = useState(true);
  
  // Check workspace context on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const host = window.location.host;
    const isMainDomain = host === APP_CONFIG.frontendDomain || host === 'localhost:3000';
    
    // Get workspace cookies set by middleware
    const cookieWorkspaceId = getCookie('ff_workspace_id');
    const cookieSubdomain = getCookie('ff_workspace_subdomain');
    
    console.log('🔍 Dashboard Page - Workspace Detection:', {
      host,
      isMainDomain,
      cookieWorkspaceId,
      cookieSubdomain,
      reduxWorkspaceSubdomain: workspaceSubdomain
    });
    
    // If we already have workspace in Redux, we're good
    if (workspaceSubdomain) {
      console.log('✅ Dashboard: Workspace context already in Redux');
      setChecking(false);
      return;
    }
    
    // If we have workspace cookies and not already set in Redux, set it NOW and wait for next render
    if (cookieWorkspaceId && cookieSubdomain && !workspaceSubdomain) {
      console.log('✅ Dashboard: Setting workspace context from cookies');
      dispatch(setWorkspace({ id: cookieWorkspaceId, subdomain: cookieSubdomain }));
      // Return here - the effect will re-run when workspaceSubdomain changes
      return;
    }
    
    // If on main domain and no workspace, redirect to workspaces list
    if (isMainDomain && !cookieWorkspaceId) {
      console.log('🏠 Dashboard: On main domain, redirecting to workspaces list');
      window.location.replace('/dashboard/workspaces');
      return;
    }
    
    // If we're on a subdomain but no workspace context yet, wait a bit for middleware
    if (!isMainDomain && !cookieWorkspaceId && !workspaceSubdomain) {
      console.log('⏳ Dashboard: On subdomain but no workspace context yet, waiting...');
      // Wait a bit for middleware to set cookies, then recheck
      const timer = setTimeout(() => {
        const retryCookieWorkspaceId = getCookie('ff_workspace_id');
        const retryCookieSubdomain = getCookie('ff_workspace_subdomain');
        
        if (retryCookieWorkspaceId && retryCookieSubdomain) {
          console.log('✅ Dashboard: Found workspace cookies on retry, setting context');
          dispatch(setWorkspace({ id: retryCookieWorkspaceId, subdomain: retryCookieSubdomain }));
          // Don't set checking to false here - let the effect re-run when Redux updates
        } else {
          console.log('❌ Dashboard: Still no workspace context after retry');
          setChecking(false);
        }
      }, 100); // Wait 100ms for middleware
      
      return () => clearTimeout(timer);
    }
    
    // Fallback: no workspace context found
    console.log('⚠️ Dashboard: No workspace context found, stopping checks');
    setChecking(false);
  }, [dispatch, workspaceSubdomain]);
  
  // Show loader while checking
  if (checking) {
    return <Loader />;
  }
  
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
