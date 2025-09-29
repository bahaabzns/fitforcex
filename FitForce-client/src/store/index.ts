'use client';
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from '@/store/slices/authSlice';
import workspaceReducer from '@/store/slices/workspaceSlice';
import settingsReducer from '@/store/slices/settingsSlice';

const PERSIST_KEYS = ['workspace', 'settings'] as const;

const loadState = () => {
  if (typeof window === 'undefined') return undefined;
  try {
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
    settings: settingsReducer
  },
  preloadedState: loadState()
});

if (typeof window !== 'undefined') {
  store.subscribe(() => {
    const state = store.getState();
    try {
      localStorage.setItem('workspace', JSON.stringify(state.workspace));
      localStorage.setItem('settings', JSON.stringify(state.settings));
    } catch {}
  });
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
