import api from '@/utils/axios';
import { store } from '@/store';
import { setCredentials, logout } from '@/store/slices/authSlice';

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  user: User;
}

export async function loginUser(email: string, password: string): Promise<boolean> {
  try {
    await api.post('/api/auth/login', { email, password });
    // After setting cookie, load user via /me to sync state
    return await checkAuthStatus();
  } catch {
    return false;
  }
}

export async function signupUser(fullName: string, email: string, password: string): Promise<boolean> {
  try {
    await api.post('/api/auth/signup', { fullName, email, password });
    // Optionally auto-login after signup; for now, require explicit login
    return true;
  } catch {
    return false;
  }
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await api.get<AuthResponse>('/api/auth/me');
    const { user } = response.data;
    const normalizedUser = { id: user.id, email: user.email, name: user.fullName };
    store.dispatch(setCredentials({ user: normalizedUser }));
    return true;
  } catch {
    store.dispatch(logout());
    return false;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch {
    // ignore
  } finally {
    store.dispatch(logout());
  }
}
