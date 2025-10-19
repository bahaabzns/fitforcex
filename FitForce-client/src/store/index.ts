'use client';
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from '@/store/slices/authSlice';
import workspaceReducer from '@/store/slices/workspaceSlice';
import settingsReducer from '@/store/slices/settingsSlice';
import messengerReducer from '@/store/slices/messengerSlice';

// Only persist settings, NOT workspace (workspace is derived from cookies and is subdomain-specific)
const PERSIST_KEYS = ['settings'] as const;

const loadState = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    // Clean up old workspace data from localStorage if it exists
    if (localStorage.getItem('workspace')) {
      console.log('🧹 Cleaning up stale workspace data from localStorage');
      localStorage.removeItem('workspace');
    }
    
    const state: Record<string, unknown> = {};
    PERSIST_KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) state[k] = JSON.parse(raw);
    });
    return state;
  } catch {
    return undefined;
  }
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workspace: workspaceReducer,
    settings: settingsReducer,
    messenger: messengerReducer
  },
  preloadedState: loadState()
});

if (typeof window !== 'undefined') {
  store.subscribe(() => {
    const state = store.getState();
    try {
      // Only persist settings, NOT workspace (workspace is derived from cookies)
      localStorage.setItem('settings', JSON.stringify(state.settings));
    } catch {}
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
