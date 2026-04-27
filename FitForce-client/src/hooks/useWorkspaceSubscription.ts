import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { setWorkspaceSubscription } from '@/store/slices/workspaceSlice';
import { api } from '@/utils/axios';

/**
 * Hook to fetch and manage workspace subscription state
 * This hook automatically fetches subscription data when workspace context is available
 */
export function useWorkspaceSubscription() {
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const subscription = useAppSelector((s) => s.workspace.subscription);
  const subscriptionLoaded = useAppSelector((s) => s.workspace.subscriptionLoaded);

  useEffect(() => {
    // Don't fetch if we don't have a workspace or already loaded
    if (!workspaceId || subscriptionLoaded) {
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data } = await api.get(`/api/workspaces/${workspaceId}/subscription`);
        
        // Extract subscription data with teamMembersEnabled fallback logic
        const subscriptionData = data?.subscription;
        
        if (subscriptionData) {
          const teamMembersEnabled = 
            subscriptionData.teamMembersEnabled ?? 
            subscriptionData.package?.teamMembersEnabled ?? 
            true;

          dispatch(setWorkspaceSubscription({
            id: subscriptionData.id,
            status: subscriptionData.status,
            startDate: subscriptionData.startDate,
            endDate: subscriptionData.endDate,
            teamMembersEnabled,
            package: subscriptionData.package
          }));
        } else {
          // No subscription - set null but mark as loaded
          dispatch(setWorkspaceSubscription(null));
        }
      } catch (error) {
        console.error('Failed to fetch workspace subscription:', error);
        // On error, assume feature is enabled (fail-open for better UX)
        dispatch(setWorkspaceSubscription(null));
      }
    };

    fetchSubscription();
  }, [workspaceId, subscriptionLoaded, dispatch]);

  return {
    subscription,
    subscriptionLoaded,
    hasTeamMembersFeature: subscription?.teamMembersEnabled ?? true
  };
}

