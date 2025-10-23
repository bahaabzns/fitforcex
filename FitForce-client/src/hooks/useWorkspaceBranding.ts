import useSWR from 'swr';
import api from '@/utils/axios';

interface WorkspaceBranding {
  id: string;
  name: string;
  brandingLogoUrl?: string;
  brandingPrimaryHex?: string;
}

export function useWorkspaceBranding() {
  const { data, isLoading, error } = useSWR('workspace-branding', async () => {
    // Use the client workspaces endpoint which includes branding data
    const res = await api.get('/api/clients/workspaces');
    const workspaces = res.data?.workspaces || [];
    
    if (workspaces.length === 0) {
      throw new Error('No workspaces found');
    }

    // Return the first workspace (assuming client is in one workspace)
    // In the future, this could be enhanced to handle multiple workspaces
    return workspaces[0] as WorkspaceBranding;
  });

  return {
    workspace: data,
    isLoading,
    error,
    logoUrl: data?.brandingLogoUrl,
    primaryColor: data?.brandingPrimaryHex || '#3B82F6',
    workspaceName: data?.name || 'Workspace'
  };
}
