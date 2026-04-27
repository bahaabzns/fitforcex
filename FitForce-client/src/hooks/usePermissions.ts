import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';

interface UsePermissionsReturn {
  permissions: string[];
  role: string | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isOwner: boolean;
}

/**
 * Hook to check user permissions in the current workspace
 * 
 * @example
 * const { hasPermission, isOwner } = usePermissions();
 * 
 * if (hasPermission('clients.delete')) {
 *   // Show delete button
 * }
 */
export function usePermissions(): UsePermissionsReturn {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !userId) {
      setPermissions([]);
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        setLoading(true);

        // Fetch current user's role and permissions directly
        const { data } = await api.get('/api/team/me');
        const myRole = data?.role;
        const myPermissions = Array.isArray(data?.permissions) ? data.permissions : [];

        if (myRole) {
          setRole(myRole.name || null);
          setPermissions(myPermissions);
        } else {
          setPermissions([]);
          setRole(null);
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        setPermissions([]);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [workspaceId, userId]);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const isOwner = role === 'owner';

  return {
    permissions,
    role,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner
  };
}

