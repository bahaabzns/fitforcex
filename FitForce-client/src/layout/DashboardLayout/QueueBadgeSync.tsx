'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { setSubmittedCount } from '@/store/slices/queueSlice';
import api from '@/utils/axios';

export default function QueueBadgeSync() {
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector((s) => s.workspace.id);

  // Sync queue count
  useEffect(() => {
    const sync = async () => {
      try {
        // Only sync if we have a workspace context
        if (!workspaceId) {
          return;
        }
        
        const { data } = await api.get('/api/forms/queue');
        // Count items with status "completed"
        const count = Array.isArray(data.items)
          ? data.items.filter((item: any) => item.status === 'completed').length
          : 0;
        dispatch(setSubmittedCount(count));
      } catch {
        // ignore
      }
    };
    sync();
  }, [dispatch, workspaceId]);

  return null;
}

