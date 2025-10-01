// next
import { useSession } from 'next-auth/react';
import { useAppSelector } from '@/store';

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
  if (session) {
    const user = session?.user;
    const provider = session?.provider;
    let thumb = user?.image || '/assets/images/users/avatar-1.png';
    if (provider === 'cognito') {
      const email = user?.email?.split('@');
      user!.name = email ? email[0] : 'Jone Doe';
    }

    if (!user?.image) {
      user!.image = '/assets/images/users/avatar-1.png';
      thumb = '/assets/images/users/avatar-thumb-1.png';
    }

    const inferredRole = (user as any)?.role || '';

    const newUser: UserProps = {
      name: user?.name || 'Jone Doe',
      email: user?.email || 'doe@codedthemes.com',
      avatar: user?.image || '/assets/images/users/avatar-1.png',
      thumb,
      role: inferredRole
    };

    return newUser;
  }

  // Fallback to Redux auth user if available
  if (isAuthenticated && authUser) {
    const name = authUser.name || (authUser.email ? authUser.email.split('@')[0] : '');
    const avatar = '/assets/images/users/avatar-1.png';
    const thumb = '/assets/images/users/avatar-thumb-1.png';
    return {
      name,
      email: authUser.email,
      avatar,
      thumb,
      role: ''
    } as UserProps;
  }

  return false;
}
