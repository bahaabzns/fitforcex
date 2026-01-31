import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Map of paths to page titles
const pageTitleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/clients': 'Clients',
  '/dashboard/workout': 'Workout',
  '/dashboard/nutrition': 'Nutrition',
  '/dashboard/forms': 'Forms',
  '/dashboard/team': 'Team',
  '/dashboard/finance': 'Finance',
  '/dashboard/settings': 'Settings',
  '/dashboard/messenger': 'Messenger',
  '/dashboard/queue': 'Queue',
  '/dashboard/tickets': 'Tickets',
  '/dashboard/promo': 'Promo Codes',
  '/dashboard/push-notifications': 'Push Notifications',
  '/dashboard/workout-logs': 'Workout Logs',
  '/dashboard/workspaces': 'Workspaces',
  '/dashboard/workspace': 'Workspace Settings',
  '/dashboard/workspaces/client-packages': 'Client Packages',
  '/dashboard/workspaces/subscription': 'Subscription',
  '/dashboard/workspace/pdf-templates': 'PDF Templates',
  '/dashboard/profile': 'Profile',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Users',
  '/admin/workspaces': 'Workspaces',
  '/admin/packages': 'Packages',
  '/admin/promo-codes': 'Promo Codes',
  '/admin/push-notifications': 'Push Notifications',
  '/admin/pdf-templates': 'PDF Templates',
  '/admin/templates': 'Templates',
  '/admin/tutorial-videos': 'Tutorial Videos',
  '/admin/monitoring': 'Monitoring',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/analytics': 'Analytics',
  '/admin/landing': 'Landing Pages',
  '/admin/default-exercises': 'Default Exercises',
  '/admin/default-food-items': 'Default Food Items',
  '/admin/free-trial': 'Free Trial',
  '/client/dashboard': 'Client Dashboard',
  '/client/plans': 'Plans',
  '/client/forms': 'Forms',
  '/client/settings': 'Settings',
  '/client/subscription': 'Subscription',
  '/client/support': 'Support',
  '/profile': 'Profile',
  '/contact': 'Contact',
  '/about': 'About',
  '/terms': 'Terms',
  '/privacy': 'Privacy',
  '/refund-policy': 'Refund Policy',
};

// Extract page title from pathname
function getPageTitle(pathname: string): string {
  // Check exact matches first
  if (pageTitleMap[pathname]) {
    return pageTitleMap[pathname];
  }

  // Check for dynamic routes (e.g., /dashboard/clients/[id])
  const pathSegments = pathname.split('/').filter(Boolean);
  
  // Handle client detail pages
  if (pathSegments.includes('clients') && pathSegments.length > 2) {
    const clientIndex = pathSegments.indexOf('clients');
    if (pathSegments[clientIndex + 1]) {
      // Check for sub-pages
      const subPage = pathSegments[clientIndex + 2];
      if (subPage === 'overview') return 'Client Overview';
      if (subPage === 'workout') return 'Client Workout';
      if (subPage === 'nutrition') return 'Client Nutrition';
      if (subPage === 'subscription') return 'Client Subscription';
      return 'Client Details';
    }
    return 'Clients';
  }

  // Handle admin workspace detail pages
  if (pathSegments[0] === 'admin' && pathSegments[1] === 'workspaces' && pathSegments.length > 2) {
    const subPage = pathSegments[3];
    if (subPage === 'exercises') return 'Workspace Exercises';
    if (subPage === 'food-items') return 'Workspace Food Items';
    return 'Workspace Details';
  }

  // Handle admin user detail pages
  if (pathSegments[0] === 'admin' && pathSegments[1] === 'users' && pathSegments.length > 2) {
    return 'User Details';
  }

  // Handle ticket detail pages
  if (pathSegments.includes('tickets') && pathSegments.length > 2) {
    return 'Ticket Details';
  }

  // Handle workout plan detail pages
  if (pathSegments.includes('workout') && pathSegments[pathSegments.length - 2] === 'workout') {
    return 'Workout Plan';
  }

  // Handle nutrition plan detail pages
  if (pathSegments.includes('nutrition') && pathSegments[pathSegments.length - 2] === 'nutrition') {
    return 'Nutrition Plan';
  }

  // Handle plan detail pages
  if (pathSegments.includes('plans') && pathSegments.length > 2) {
    return 'Plan Details';
  }

  // Fallback: capitalize last segment
  const lastSegment = pathSegments[pathSegments.length - 1];
  if (lastSegment) {
    return lastSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return 'Dashboard';
}

export function usePageTitle(customTitle?: string) {
  const pathname = usePathname();

  useEffect(() => {
    const title = customTitle || getPageTitle(pathname);
    document.title = `FitForce | ${title}`;
  }, [pathname, customTitle]);
}
