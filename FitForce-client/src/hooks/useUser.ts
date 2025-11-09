// next
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { setCredentials } from '@/store/slices/authSlice';
import api from '@/utils/axios';

interface UserProps {
  name: string;
  email: string;
  avatar: string;
  thumb: string;
  role: string;
}

export default function useUser() {
  const { data: session } = useSession();
  const authUser = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const dispatch = useAppDispatch();
  const [apiUser, setApiUser] = useState<{ name: string; email: string } | null>(null);

  // Fetch user data from API to ensure we have the latest data, especially fullName
  useEffect(() => {
    // Always try to fetch from API if we don't have complete user data with a name
    // This handles cases where user is logged in via cookies but Redux isn't populated yet
    const hasAuthUser = !!authUser;
    const hasName = authUser?.name && authUser.name.trim() !== '';
    
    // Fetch if we don't have user data OR if we have user but no name
    // This will attempt to fetch even if session/auth state isn't set yet (cookie-based auth)
    if (!hasAuthUser || !hasName) {
      api.get('/api/auth/me')
        .then((response) => {
          const user = response.data.user;
          if (user) {
            const normalizedUser = { 
              id: user.id, 
              email: user.email, 
              name: user.fullName || user.name || null 
            };
            // setCredentials automatically sets isAuthenticated to true
            dispatch(setCredentials({ user: normalizedUser }));
            setApiUser({ name: normalizedUser.name || '', email: normalizedUser.email });
          }
        })
        .catch(() => {
          // Silently fail if API call fails (user might not be logged in)
        });
    }
  }, [authUser?.id, authUser?.name, dispatch]);

  // Priority 1: Use Redux auth user (from API) - this has the most accurate data including fullName
  // Also check if we have authUser even if isAuthenticated is not set yet (during initial load)
  if (authUser && (isAuthenticated || authUser.id)) {
    // Extract name from authUser, with better fallbacks
    let name = authUser.name;
    if (!name || name.trim() === '') {
      // Try to extract from email if name is missing
      if (authUser.email) {
        const emailParts = authUser.email.split('@');
        name = emailParts[0] || 'User';
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
      } else {
        name = 'User';
      }
    }
    const avatar = '/assets/images/users/avatar-1.png';
    const thumb = '/assets/images/users/avatar-thumb-1.png';
    return {
      name: name.trim() || 'User',
      email: authUser.email || '',
      avatar,
      thumb,
      role: ''
    } as UserProps;
  }

  // Priority 2: Use API user data if available (from useEffect fetch)
  if (apiUser && apiUser.name) {
    return {
      name: apiUser.name.trim() || 'User',
      email: apiUser.email || '',
      avatar: '/assets/images/users/avatar-1.png',
      thumb: '/assets/images/users/avatar-thumb-1.png',
      role: ''
    } as UserProps;
  }

  // Priority 3: Fallback to session user (might not have name)
  if (session) {
    const user = session?.user;
    const provider = session?.provider;
    let thumb = user?.image || '/assets/images/users/avatar-1.png';
    
    // Handle name extraction
    let userName = user?.name;
    if (!userName || userName.trim() === '') {
      // Try to extract from email if name is missing
      if (user?.email) {
        const emailParts = user.email.split('@');
        userName = emailParts[0] || 'User';
        // Capitalize first letter
        userName = userName.charAt(0).toUpperCase() + userName.slice(1);
      } else {
        userName = 'User';
      }
    }
    
    if (provider === 'cognito' && !user?.name) {
      const email = user?.email?.split('@');
      userName = email ? email[0] : 'User';
      userName = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    if (!user?.image) {
      user!.image = '/assets/images/users/avatar-1.png';
      thumb = '/assets/images/users/avatar-thumb-1.png';
    }

    const inferredRole = (user as any)?.role || '';

    const newUser: UserProps = {
      name: userName,
      email: user?.email || '',
      avatar: user?.image || '/assets/images/users/avatar-1.png',
      thumb,
      role: inferredRole
    };

    return newUser;
  }

  return false;
}
