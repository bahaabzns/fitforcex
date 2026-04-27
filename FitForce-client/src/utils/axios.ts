import axios from 'axios';
import { openSnackbar } from 'api/snackbar';
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

    // Get workspace ID - check all sources
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    // Priority: 1. URL query param, 2. sessionStorage (fastest for client-side nav), 3. cookies
    const urlParams = new URLSearchParams(window.location.search || '');
    const urlWorkspaceId = urlParams.get('workspaceId');
    const workspaceIdFromSession = sessionStorage.getItem('ff_workspace_id');
    const workspaceIdFromCookie = getCookie('ff_workspace_id');

    if (urlWorkspaceId) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['x-workspace-id'] = urlWorkspaceId;
    } else if (workspaceIdFromSession) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['x-workspace-id'] = workspaceIdFromSession;
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

// Handle permission-denied responses globally with a warning instead of an error
api.interceptors.response.use(
  (response) => {
    // Handle 304 Not Modified responses - ensure we have data
    // Some browsers/proxies return 304 with empty body, which can cause issues
    if (response.status === 304 && (!response.data || Object.keys(response.data).length === 0)) {
      console.warn('Received 304 Not Modified with empty body, forcing fresh request');
      // Force a fresh request by adding a cache-busting parameter
      const originalUrl = response.config.url || '';
      if (!originalUrl.includes('_nocache=') && !originalUrl.includes('_t=')) {
        const separator = originalUrl.includes('?') ? '&' : '?';
        const newConfig = { ...response.config };
        newConfig.url = `${originalUrl}${separator}_nocache=${Date.now()}`;
        // Prevent infinite loop by marking this as a retry
        newConfig.headers = { ...newConfig.headers, 'X-Retry-Attempt': '1' };
        // Retry the request
        return api.request(newConfig);
      }
    }
    return response;
  },
  (error) => {
    try {
      const status = error?.response?.status;
      const message: string = error?.response?.data?.error || error?.response?.data?.message || '';
      const msgLower = typeof message === 'string' ? message.toLowerCase() : '';
      const isPermissionDenied =
        status === 403 ||
        msgLower.includes('permission') ||
        msgLower.includes('forbidden') ||
        msgLower.includes('not authorized') ||
        msgLower.includes('unauthorized');

      if (isPermissionDenied) {
        openSnackbar({
          open: true,
          message: message || 'You do not have access to that.',
          variant: 'alert',
          alert: { color: 'warning', variant: 'filled' },
          transition: 'SlideUp'
        } as any);
      }
    } catch {
      // noop
    }

    return Promise.reject(error);
  }
);
