'use client';

import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAppDispatch, useAppSelector } from '@/store';
import { setUnreadTotal } from '@/store/slices/messengerSlice';
import api from '@/utils/axios';

export default function MessengerBadgeSync() {
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const unreadTotal = useAppSelector((s) => s.messenger.unreadTotal);

  const { socket } = useSocket({ enabled: true, workspaceId: workspaceId || undefined });

  // Initial sync from inbox
  useEffect(() => {
    const sync = async () => {
      try {
        // Only sync if we have a workspace context
        if (!workspaceId) {
          return;
        }
        
        const { data } = await api.get('/api/messenger/inbox');
        const unread = Array.isArray(data.threads)
          ? data.threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0)
          : 0;
        dispatch(setUnreadTotal(unread));
      } catch {
        // ignore
      }
    };
    sync();
  }, [dispatch, workspaceId]);

  // Live updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      if (message?.senderType === 'client' && workspaceId) {
        // Re-sync unread count for accuracy across threads
        api.get('/api/messenger/inbox').then(({ data }) => {
          const unread = Array.isArray(data.threads)
            ? data.threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0)
            : 0;
          dispatch(setUnreadTotal(unread));
        }).catch(() => {});
      }
    };

    const handleThreadUpdate = () => {
      if (workspaceId) {
        api.get('/api/messenger/inbox').then(({ data }) => {
          const unread = Array.isArray(data.threads)
            ? data.threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0)
            : 0;
          dispatch(setUnreadTotal(unread));
        }).catch(() => {});
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('thread_updated', handleThreadUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('thread_updated', handleThreadUpdate);
    };
  }, [socket, dispatch]);

  return null;
}


