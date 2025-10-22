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

// Resolve API base URL with sensible runtime fallback to the api.<domain>
const resolveApiBaseUrl = (): string => {
  // Prefer explicit env configuration
  if (APP_CONFIG.apiUrl) return APP_CONFIG.apiUrl;
  // Fallback: derive from current origin (e.g., nano.com -> api.nano.com)
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const parts = hostname.split('.');
    const base = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
    return `${protocol}//api.${base}`;
  }
  // Final fallback (build-time default)
  return 'https://api.fitforce.io';
};

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Add admin token if available (for admin routes)
    const adminToken = sessionStorage.getItem('adminToken');
    if (adminToken) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${adminToken}`;
    }

    // Get workspace ID from cookies (primary source now)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const workspaceIdFromCookie = getCookie('ff_workspace_id');
    
    // Prefer explicit workspaceId from URL query (e.g., subscription pages)
    const urlParams = new URLSearchParams(window.location.search || '');
    const urlWorkspaceId = urlParams.get('workspaceId');
    
    if (urlWorkspaceId) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['x-workspace-id'] = urlWorkspaceId;
    } else if (workspaceIdFromCookie) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['x-workspace-id'] = workspaceIdFromCookie;
    }
  }
  return config;
});

export default api;

export const fetcher = async (url: string) => {
  const res = await api.get(url);
  return res.data;
};
