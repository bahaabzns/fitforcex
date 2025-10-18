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
        
        // Get current user's workspace membership
        const response = await api.get('/api/team/members');
        const members = response.data.members || [];
        const currentMember = members.find((m: any) => m.user.id === userId);
        
        if (currentMember) {
          setRole(currentMember.role.name);
          
          // If owner, grant all permissions
          if (currentMember.role.name === 'owner') {
            // Owner has all permissions - set a comprehensive list
            setPermissions([
              'clients.read', 'clients.write', 'clients.delete', 'clients.export',
              'finance.read', 'finance.write', 'finance.export',
              'forms.read', 'forms.manage', 'forms.delete',
              'nutrition.read', 'nutrition.manage', 'nutrition.delete',
              'workout.read', 'workout.manage', 'workout.delete',
              'messaging.read', 'messaging.write',
              'dashboard.view', 'reports.generate',
              'team.manage', 'roles.manage', 'permissions.assign',
              'settings.manage', 'branding.manage', 'integrations.manage'
            ]);
          } else {
            // Get permissions from role
            const rolesResponse = await api.get('/api/team/roles');
            const roles = rolesResponse.data.roles || [];
            const userRole = roles.find((r: any) => r.id === currentMember.role.id);
            
            if (userRole && userRole.permissions) {
              const permissionKeys = userRole.permissions.map((rp: any) => rp.permission.key);
              setPermissions(permissionKeys);
            }
          }
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

