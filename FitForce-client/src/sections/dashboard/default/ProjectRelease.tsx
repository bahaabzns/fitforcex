'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

// assets
import { More, Calendar, Clock } from '@wandersonalwes/iconsax-react';

// ==============================|| DASHBOARD - PROJECT RELEASE ||============================== //

export default function ProjectRelease() {
  const projects = [
    {
      id: 1,
      name: 'FitForce Mobile App',
      version: 'v2.1.0',
      status: 'Released',
      date: 'Dec 15, 2024',
      avatar: 'FM'
    },
    {
      id: 2,
      name: 'Dashboard Analytics',
      version: 'v1.5.2',
      status: 'In Progress',
      date: 'Dec 20, 2024',
      avatar: 'DA'
    },
    {
      id: 3,
      name: 'Payment Integration',
      version: 'v3.0.0',
      status: 'Testing',
      date: 'Dec 25, 2024',
      avatar: 'PI'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Released':
        return 'success';
      case 'In Progress':
        return 'warning';
      case 'Testing':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5">Project Release</Typography>
          <IconButton size="small">
            <More size={18} />
          </IconButton>
        </Stack>
        
        <List disablePadding>
          {projects.map((project, index) => (
            <ListItem
              key={project.id}
              divider={index < projects.length - 1}
              sx={{ px: 0, py: 1.5 }}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    bgcolor: 'primary.lighter',
                    color: 'primary.darker'
                  }}
                >
                  {project.avatar}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {project.name}
                    </Typography>
                    <Chip
                      label={project.status}
                      size="small"
                      color={getStatusColor(project.status) as any}
                      sx={{ fontSize: '0.75rem', height: 20 }}
                    />
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Calendar size={12} />
                      <Typography variant="caption" color="text.secondary">
                        {project.date}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {project.version}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
        
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Clock size={16} />
            <Typography variant="caption" color="text.secondary">
              Next release: Jan 5, 2025
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
