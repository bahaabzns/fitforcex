// assets
import { People, Money, Document, Apple, Bubble, Setting2, Home, Global, Add, TimerStart, Messages2 } from '@wandersonalwes/iconsax-react';

// types
import { NavItemType } from 'types/menu';

const icons = {
  home: Home,
  clients: People,
  finance: Money,
  forms: Document,
  nutrition: Apple,
  workout: Bubble,
  team: People,
  settings: Setting2,
  workspace: Global,
  workspaces: Add,
  queue: TimerStart,
  messenger: Messages2
};

// Main domain menu (shows workspace management)
const mainDomainMenu: NavItemType = {
  id: 'group-dashboard',
  title: 'Dashboard',
  type: 'group',
  icon: icons.home,
  children: [
    {
      id: 'profile',
      title: 'Profile',
      type: 'item',
      url: '/dashboard/profile',
      icon: icons.settings
    },
    {
      id: 'promo',
      title: 'Promo Earnings',
      type: 'item',
      url: '/dashboard/promo',
      icon: icons.finance
    },
    {
      id: 'workspaces',
      title: 'Workspaces',
      type: 'item',
      url: '/dashboard/workspaces',
      icon: icons.workspaces
    }
  ]
};

// Workspace subdomain menu (shows workspace-specific features)
const workspaceMenu: NavItemType = {
  id: 'group-dashboard',
  title: 'Dashboard',
  type: 'group',
  icon: icons.home,
  children: [
    {
      id: 'dashboard-root',
      title: 'Overview',
      type: 'item',
      url: '/dashboard',
      icon: icons.home
    },
    {
      id: 'clients',
      title: 'Clients',
      type: 'item',
      url: '/dashboard/clients',
      icon: icons.clients
    },
    {
      id: 'finance',
      title: 'Finance',
      type: 'item',
      url: '/dashboard/finance',
      icon: icons.finance
    },
    {
      id: 'forms',
      title: 'Forms',
      type: 'item',
      url: '/dashboard/forms',
      icon: icons.forms
    },
    {
      id: 'queue',
      title: 'Queue',
      type: 'item',
      url: '/dashboard/queue',
      icon: icons.queue
    },
    {
      id: 'nutrition',
      title: 'Nutrition',
      type: 'item',
      url: '/dashboard/nutrition',
      icon: icons.nutrition
    },
    {
      id: 'workout',
      title: 'Workouts',
      type: 'item',
      url: '/dashboard/workout',
      icon: icons.workout
    },
  {
    id: 'messenger',
    title: 'Messenger',
    type: 'item',
    url: '/dashboard/messenger',
    icon: icons.messenger
  },
    {
      id: 'team',
      title: 'Team',
      type: 'item',
      url: '/dashboard/team',
      icon: icons.team
    },
    {
      id: 'workspace',
      title: 'Workspace',
      type: 'item',
      url: '/dashboard/workspace',
      icon: icons.workspace
    },
    {
      id: 'profile',
      title: 'Profile',
      type: 'item',
      url: '/dashboard/profile',
      icon: icons.settings
    },
    {
      id: 'promo',
      title: 'Promo Earnings',
      type: 'item',
      url: '/dashboard/promo',
      icon: icons.finance
    },
    // {
    //   id: 'workspace-pdf-templates',
    //   title: 'PDF Templates',
    //   type: 'item',
    //   url: '/dashboard/workspace/pdf-templates',
    //   icon: icons.forms
    // },
    {
      id: 'workspace-subscription',
      title: 'Workspace Subscription',
      type: 'item',
      url: '/dashboard/workspaces/subscription',
      icon: icons.finance
    },
    {
      id: 'workspace-client-packages',
      title: 'Client Packages',
      type: 'item',
      url: '/dashboard/workspaces/client-packages',
      icon: icons.forms
    }
  ]
};

// Function to get menu based on context
export function getDashboardMenu(isWorkspaceSubdomain: boolean = false): NavItemType {
  return isWorkspaceSubdomain ? workspaceMenu : mainDomainMenu;
}

// Default export for backward compatibility
const dashboard = mainDomainMenu;
export default dashboard;
