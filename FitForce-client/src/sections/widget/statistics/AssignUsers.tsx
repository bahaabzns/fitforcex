'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';

// assets
import { More, Add } from '@wandersonalwes/iconsax-react';

// ==============================|| DASHBOARD - ASSIGN USERS ||============================== //

export default function AssignUsers() {
  const users = [
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Admin',
      avatar: 'SJ',
      status: 'online'
    },
    {
      id: 2,
      name: 'Mike Chen',
      role: 'Manager',
      avatar: 'MC',
      status: 'away'
    },
    {
      id: 3,
      name: 'Emily Davis',
      role: 'Developer',
      avatar: 'ED',
      status: 'online'
    },
    {
      id: 4,
      name: 'Alex Wilson',
      role: 'Designer',
      avatar: 'AW',
      status: 'offline'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'away':
        return 'warning';
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5">Team Members</Typography>
          <IconButton size="small">
            <More size={18} />
          </IconButton>
        </Stack>
        
        <List disablePadding>
          {users.map((user, index) => (
            <ListItem
              key={user.id}
              divider={index < users.length - 1}
              sx={{ px: 0, py: 1.5 }}
            >
              <ListItemAvatar>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      bgcolor: 'secondary.lighter',
                      color: 'secondary.darker'
                    }}
                  >
                    {user.avatar}
                  </Avatar>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: `${getStatusColor(user.status)}.main`,
                      border: 2,
                      borderColor: 'background.paper'
                    }}
                  />
                </Box>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    {user.name}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {user.role}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
        
        <Button
          variant="outlined"
          fullWidth
          startIcon={<Add size={16} />}
          sx={{ mt: 2 }}
        >
          Add Team Member
        </Button>
      </CardContent>
    </Card>
  );
}
