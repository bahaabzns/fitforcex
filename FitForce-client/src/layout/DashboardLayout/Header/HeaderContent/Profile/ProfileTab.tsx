// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useRouter } from 'next/navigation';

// assets
import { Card, Edit2, Logout, Profile, Profile2User } from '@wandersonalwes/iconsax-react';
import { APP_CONFIG } from '@/lib/config';

interface Props {
  handleLogout: () => void;
}

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //

export default function ProfileTab({ handleLogout }: Props) {
  const router = useRouter();

  const goToMainProfile = () => {
    const base =
      (APP_CONFIG.mainDomain && APP_CONFIG.mainDomain.replace(/\/$/, '')) ||
      (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');
    const target = `${base}/profile`;

    if (typeof window !== 'undefined') {
      window.location.href = target;
    } else {
      router.push(target);
    }
  };

  return (
    <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
      <ListItemButton onClick={() => router.push('/dashboard/settings')}>
        <ListItemIcon>
          <Edit2 variant="Bulk" size={18} />
        </ListItemIcon>
        <ListItemText primary="Edit Profile" />
      </ListItemButton>
      <ListItemButton onClick={goToMainProfile}>
        <ListItemIcon>
          <Profile variant="Bulk" size={18} />
        </ListItemIcon>
        <ListItemText primary="View Profile" />
      </ListItemButton>

      <ListItemButton onClick={handleLogout}>
        <ListItemIcon>
          <Logout variant="Bulk" size={18} />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </ListItemButton>
    </List>
  );
}
