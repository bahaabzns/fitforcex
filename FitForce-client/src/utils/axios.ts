import axios from 'axios';
import { APP_CONFIG } from '@/lib/config';

type PersistedWorkspace = { id?: string } | null;

const getPersisted = <T = unknown>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const api = axios.create({
  baseURL: APP_CONFIG.apiUrl,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const workspace = getPersisted<PersistedWorkspace>('workspace');
    if (workspace?.id) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['x-workspace-id'] = workspace.id;
    }
  }
  return config;
});

export default api;

export const fetcher = async (url: string) => {
  const res = await api.get(url);
  return res.data;
};
