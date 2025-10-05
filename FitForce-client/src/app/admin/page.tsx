'use client';

import Link from 'next/link';
import { Box, Grid, Card, CardActionArea, CardContent, Typography, Chip, Button } from '@mui/material';
import { Inventory2, Restaurant, FitnessCenter, ShoppingCart, AutoAwesome, Insights, People, Logout } from '@mui/icons-material';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function AdminHome() {
  const { adminUser, logout } = useAdminAuth();

  const items = [
    {
      href: '/admin/workspaces',
      title: 'Workspaces',
      desc: 'View all workspaces and their owners.',
      icon: <People color="primary" />,
      chip: 'Directory'
    },
    {
      href: '/admin/packages',
      title: 'Workspace Packages',
      desc: 'Create and manage subscription packages for workspaces.',
      icon: <Inventory2 color="primary" />,
      chip: 'Billing'
    },
    {
      href: '/admin/subscriptions',
      title: 'Workspace Subscriptions',
      desc: 'View workspace subscriptions and status.',
      icon: <ShoppingCart color="primary" />,
      chip: 'Billing'
    },
    {
      href: '/admin/free-trial',
      title: 'Free Trial',
      desc: 'Configure and issue workspace free trials.',
      icon: <AutoAwesome color="primary" />,
      chip: 'Growth'
    },
    {
      href: '/admin/default-food-items',
      title: 'Base Food Items',
      desc: 'Manage the global library of food items.',
      icon: <Restaurant color="primary" />,
      chip: 'Content'
    },
    {
      href: '/admin/default-exercises',
      title: 'Base Exercises',
      desc: 'Manage the global exercise library.',
      icon: <FitnessCenter color="primary" />,
      chip: 'Content'
    },
    {
      href: '/admin/analytics',
      title: 'Payment Analytics',
      desc: 'Revenue, subscriptions, and package performance.',
      icon: <Insights color="primary" />,
      chip: 'Reports'
    }
  ];

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 }, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <div />
          <Typography variant="h4" fontWeight={800}>App Management</Typography>
          <Button
            variant="outlined"
            startIcon={<Logout />}
            onClick={logout}
            size="small"
          >
            Logout
          </Button>
        </Box>
        <Typography color="text.secondary">
          Welcome, {adminUser?.fullName} ({adminUser?.email})
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Manage workspaces, subscriptions, packages, and global content.
        </Typography>
      </Box>
      <Grid container spacing={3}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.href}>
            <Card elevation={1}>
              <CardActionArea component={Link} href={item.href}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      {item.icon}
                      <Typography variant="h6" fontWeight={700}>{item.title}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <Chip size="small" label={item.chip} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}


