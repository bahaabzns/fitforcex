import { useState, MouseEvent } from 'react';

// next
import { signOut } from 'next-auth/react';
import Link from 'next/link';

// material-ui
import { styled } from '@mui/material/styles';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';

// project-imports
import { useGetMenuMaster } from 'api/menu';
import Avatar from 'components/@extended/Avatar';
import useUser from 'hooks/useUser';
import { logoutUser } from '@/lib/auth';

// assets
import { ArrowRight2 } from '@wandersonalwes/iconsax-react';

const avatar1 = '/assets/images/users/avatar-6.png';

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
  drawerOpen: boolean;
}

const ExpandMore = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'theme' && prop !== 'expand' && prop !== 'drawerOpen'
})<ExpandMoreProps>(({ theme, expand, drawerOpen }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(-90deg)',
  marginLeft: 'auto',
  color: theme.palette.secondary.dark,
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest
  }),
  ...(!drawerOpen && { opacity: 0, width: 50, height: 50 })
}));

// ==============================|| LIST - USER ||============================== //

export default function UserList() {
  const user = useUser();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const handleLogout = async () => {
    // Ensure backend httpOnly cookie is cleared first
    try {
      await logoutUser();
    } catch {
      // ignore
    }
    // Always use redirect: false to prevent automatic redirects
    // We'll handle the redirect manually
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore
    }

    // Force redirect using window.location to ensure it works
    window.location.href = '/login';
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ p: 1.25, px: !drawerOpen ? 1.25 : 3, borderTop: '2px solid ', borderTopColor: 'divider' }}>
      <List disablePadding>
        <ListItem
          disablePadding
          secondaryAction={
            <ExpandMore
              sx={{ svg: { height: 20, width: 20 } }}
              expand={open}
              drawerOpen={drawerOpen}
              id="basic-button"
              aria-controls={open ? 'basic-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClick}
              aria-label="show more"
            >
              <ArrowRight2 style={{ fontSize: '0.625rem' }} />
            </ExpandMore>
          }
          sx={{
            ...(!drawerOpen && { display: 'flex', justifyContent: 'flex-end' }),
            '& .MuiListItemSecondaryAction-root': { right: !drawerOpen ? 16 : -16 }
          }}
        >
          <ListItemAvatar>
            <Avatar 
              alt="Avatar" 
              src={(user && typeof user === 'object' ? user?.avatar : null) || avatar1} 
              sx={{ ...(drawerOpen && { width: 46, height: 46 }) }} 
            />
          </ListItemAvatar>
          <ListItemText
            primary={
              user && typeof user === 'object' 
                ? (user?.name?.trim() || user?.email?.split('@')[0] || 'User')
                : 'User'
            }
            sx={{ ...(!drawerOpen && { display: 'none' }) }}
            secondary={user?.role || undefined}
          />
        </ListItem>
      </List>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{ list: { 'aria-labelledby': 'basic-button' } }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
        <MenuItem component={Link} href="/profile" onClick={handleClose}>
          Profile
        </MenuItem>
        <MenuItem component={Link} href="/dashboard/settings" onClick={handleClose}>
          My account
        </MenuItem>
      </Menu>
    </Box>
  );
}
