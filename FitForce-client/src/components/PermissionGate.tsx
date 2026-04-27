import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  /** Single permission required */
  permission?: string;
  
  /** Array of permissions - user needs ANY one of these */
  anyOf?: string[];
  
  /** Array of permissions - user needs ALL of these */
  allOf?: string[];
  
  /** Only show for workspace owners */
  ownerOnly?: boolean;
  
  /** Content to show when permission is granted */
  children: ReactNode;
  
  /** Optional fallback content when permission is denied */
  fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on user permissions
 * 
 * @example
 * // Single permission
 * <PermissionGate permission="clients.delete">
 *   <Button onClick={handleDelete}>Delete</Button>
 * </PermissionGate>
 * 
 * @example
 * // Any of multiple permissions
 * <PermissionGate anyOf={['clients.write', 'clients.delete']}>
 *   <ClientActions />
 * </PermissionGate>
 * 
 * @example
 * // All permissions required
 * <PermissionGate allOf={['clients.read', 'clients.write']}>
 *   <ClientEditor />
 * </PermissionGate>
 * 
 * @example
 * // Owner only
 * <PermissionGate ownerOnly>
 *   <WorkspaceSettings />
 * </PermissionGate>
 * 
 * @example
 * // With fallback
 * <PermissionGate 
 *   permission="finance.read" 
 *   fallback={<Alert severity="warning">You don't have access to financial data</Alert>}
 * >
 *   <FinanceDashboard />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  anyOf,
  allOf,
  ownerOnly,
  children,
  fallback = null
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isOwner, loading } = usePermissions();

  // Don't render anything while loading permissions
  if (loading) {
    return null;
  }

  // Check owner-only access
  if (ownerOnly && !isOwner) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check any of multiple permissions
  if (anyOf && !hasAnyPermission(anyOf)) {
    return <>{fallback}</>;
  }

  // Check all permissions required
  if (allOf && !hasAllPermissions(allOf)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * HOC version for wrapping components
 * 
 * @example
 * const ProtectedComponent = withPermission('clients.delete')(MyComponent);
 */
export function withPermission(permission: string) {
  return function <P extends object>(Component: React.ComponentType<P>) {
    return function WithPermissionWrapper(props: P) {
      return (
        <PermissionGate permission={permission}>
          <Component {...props} />
        </PermissionGate>
      );
    };
  };
}

