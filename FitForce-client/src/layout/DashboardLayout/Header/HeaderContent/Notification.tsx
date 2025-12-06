import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Badge from '@mui/material/Badge';
import CardContent from '@mui/material/CardContent';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import Avatar from 'components/@extended/Avatar';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';
import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';

// assets
import { Gift, MessageText1, Notification, Setting2 } from '@wandersonalwes/iconsax-react';
import api from 'utils/axios';
import { APP_CONFIG } from '@/lib/config';
import { useAppSelector } from '@/store';

const actionSX = {
  mt: '6px',
  ml: 1,
  top: 'auto',
  right: 'auto',
  alignSelf: 'flex-start',
  transform: 'none'
};

// ==============================|| HEADER CONTENT - NOTIFICATION ||============================== //

export default function NotificationPage() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const anchorRef = useRef<any>(null);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Array<{ id: string; title: string; message: string; createdAt: string; type: string; data?: any }>>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: MouseEvent | TouchEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const workspaceId = useAppSelector((s) => s.workspace.id);

  // Fetcher
  const fetchNotifications = async () => {
    try {
      // Only fetch notifications if we have a workspace context
      const isWorkspaceDomain = window.location.hostname !== APP_CONFIG.frontendDomain;
      
      if (!workspaceId && !isWorkspaceDomain) {
        // No workspace context, skip notifications
        return;
      }
      
      const res = await api.get('/api/notifications/my');
      setItems(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      // ignore
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (open) {
      (async () => {
        try { await fetchNotifications(); } catch {}
      })();
    }
  }, [open]);

  // Lightweight polling every 30s
  useEffect(() => {
    const id = setInterval(() => { fetchNotifications(); }, 30000);
    return () => clearInterval(id);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read');
      setUnread(0);
      setItems((prev) => prev.map((it) => ({ ...it, readAt: new Date().toISOString() } as any)));
    } catch {}
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/read`);
      setItems((prev) => prev.map((it) => 
        it.id === notificationId ? { ...it, readAt: new Date().toISOString() } : it
      ));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleNotificationClick = async (notification: { id: string; type: string; data?: any }) => {
    // Mark as read
    await markNotificationRead(notification.id);
    
    // Close notification panel
    setOpen(false);

    // Navigate based on notification type
    const { type, data } = notification;
    
    // Check if user is client or coach
    const isClient = window.location.pathname.startsWith('/client');
    
    if (type === 'messenger_new_message' && data?.threadId) {
      // Navigate to messenger/support based on user type
      if (isClient) {
        router.push('/client/support');
      } else {
        router.push(`/dashboard/messenger?threadId=${data.threadId}`);
      }
    } else if (type === 'form_assigned') {
      if (isClient && data?.submissionId) {
        // Client: go to forms page to submit
        router.push('/client/forms');
      } else if (data?.submissionId && data?.clientId) {
        // Coach: go to queue page or client forms page to view assignment
        if (data?.formType === 'nutrition') {
          router.push(`/dashboard/clients/${data.clientId}/nutrition?tab=forms`);
        } else if (data?.formType === 'workout') {
          router.push(`/dashboard/clients/${data.clientId}/workout?tab=forms`);
        } else {
          router.push('/dashboard/queue');
        }
      } else if (isClient) {
        // Client fallback
        router.push('/client/forms');
      }
    } else if (type === 'form_submitted') {
      // Coach: view form submission answers
      if (data?.submissionId && data?.clientId) {
        if (data?.formType === 'nutrition') {
          router.push(`/dashboard/clients/${data.clientId}/nutrition?tab=forms`);
        } else if (data?.formType === 'workout') {
          router.push(`/dashboard/clients/${data.clientId}/workout?tab=forms`);
        } else {
          router.push('/dashboard/queue');
        }
      } else if (data?.submissionId) {
        // Fallback to queue
        router.push('/dashboard/queue');
      } else if (isClient) {
        // Client fallback
        router.push('/client/forms');
      }
    } else {
      // Default: try to navigate based on data
      if (data?.clientId && !isClient) {
        router.push(`/dashboard/clients/${data.clientId}/overview`);
      }
    }
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 0.5 }}>
      <IconButton
        color="secondary"
        variant="light"
        aria-label="open profile"
        ref={anchorRef}
        aria-controls={open ? 'profile-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
        size="large"
        sx={(theme) => ({
          p: 1,
          color: 'secondary.main',
          bgcolor: open ? 'secondary.200' : 'secondary.100',
          ...theme.applyStyles('dark', { bgcolor: open ? 'background.paper' : 'background.default' })
        })}
      >
        <Badge badgeContent={unread} color="success" slotProps={{ badge: { sx: { top: 2, right: 4 } } }}>
          <Notification variant="Bold" />
        </Badge>
      </IconButton>
      <Popper
        placement={downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [downMD ? -5 : 0, 9] } }] }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position={downMD ? 'top' : 'top-right'} in={open} {...TransitionProps}>
            <Paper sx={(theme) => ({ boxShadow: theme.customShadows.z1, borderRadius: 1.5, width: { xs: 320, sm: 420 } })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard border={false} content={false}>
                  <CardContent>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="h5">Notifications</Typography>
                      <Link component="button" onClick={markAllRead} variant="h6" color="primary">
                        Mark all read
                      </Link>
                    </Stack>
                    <SimpleBar style={{ maxHeight: 'calc(100vh - 180px)' }}>
                      <List
                        component="nav"
                        sx={(theme) => ({
                          '& .MuiListItemButton-root': {
                            p: 1.5,
                            my: 1.5,
                            border: `1px solid ${theme.palette.divider}`,
                            '&:hover': { bgcolor: 'primary.lighter', borderColor: 'primary.light' },
                            '& .MuiListItemSecondaryAction-root': { ...actionSX, position: 'relative' },
                            '&:hover .MuiAvatar-root': { bgcolor: 'primary.main', color: 'background.paper' }
                          }
                        })}
                      >
                        {items.map((n) => (
                          <ListItem 
                            key={n.id} 
                            component={ListItemButton} 
                            onClick={() => handleNotificationClick(n)}
                            secondaryAction={
                              <Typography variant="caption" noWrap>
                                {new Date(n.createdAt).toLocaleString()}
                              </Typography>
                            }
                            sx={{ cursor: 'pointer' }}
                          >
                            <ListItemAvatar>
                              <Avatar type={n.type.includes('form') ? 'outlined' : 'filled'}>
                                {n.type.includes('form') ? <MessageText1 size={20} variant="Bold" /> : <Gift size={20} variant="Bold" />}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText primary={<Typography variant="h6">{n.title}</Typography>} secondary={n.message} />
                          </ListItem>
                        ))}
                      </List>
                    </SimpleBar>
                    <Stack direction="row" sx={{ justifyContent: 'center', mt: 1.5 }}>
                      <Link href="#" variant="h6" color="primary">
                        View all
                      </Link>
                    </Stack>
                  </CardContent>
                </MainCard>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}
