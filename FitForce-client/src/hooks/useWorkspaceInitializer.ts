'use client';

import { useEffect } from 'react';
import { useAppDispatch } from '@/store';
import { setWorkspace } from '@/store/slices/workspaceSlice';

export function useWorkspaceInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initWorkspace = () => {
      // Priority: 1. sessionStorage (set by workspace landing pages)
      // 2. cookies (set by middleware)

      let workspaceId: string | null = null;
      let workspaceSubdomain: string | null = null;

      // Try sessionStorage first
      const sessionWorkspaceId = sessionStorage.getItem('ff_workspace_id');
      const sessionSubdomain = sessionStorage.getItem('ff_workspace_subdomain');

      if (sessionWorkspaceId) {
        workspaceId = sessionWorkspaceId;
        workspaceSubdomain = sessionSubdomain;
      } else {
        // Try cookies
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };

        workspaceId = getCookie('ff_workspace_id') ?? null;
        workspaceSubdomain = getCookie('ff_workspace_subdomain') ?? null;
      }

      // If we found workspace info, dispatch to Redux
      if (workspaceId) {
        const subdomain = workspaceSubdomain ?? null;
        dispatch(setWorkspace({ id: workspaceId, subdomain }));
      }
    };

    initWorkspace();
  }, [dispatch]);
}
