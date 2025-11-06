'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Box, Grid, Card, CardActionArea, CardContent, Typography, Chip, Button, Stack, Divider, Skeleton } from '@mui/material';
import { Inventory2, Restaurant, FitnessCenter, ShoppingCart, AutoAwesome, Insights, People, Logout } from '@mui/icons-material';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import api from '@/utils/axios';

export default function AdminHome() {
  const { adminUser, logout } = useAdminAuth();

  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metrics, setMetrics] = useState<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalRevenueCents: number;
    workspacesCount: number;
    packagesCount: number;
  }>({ totalSubscriptions: 0, activeSubscriptions: 0, totalRevenueCents: 0, workspacesCount: 0, packagesCount: 0 });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setMetricsLoading(true);
        const [financeRes, workspacesRes, packagesRes] = await Promise.all([
          api.get('/api/admin/finance/overview?limit=1&page=1'),
          api.get('/api/admin/workspaces'),
          api.get('/api/admin/workspace-packages')
        ]);

        if (!isMounted) return;

        const totalSubscriptions = financeRes.data?.metrics?.totalSubscriptions ?? 0;
        const activeSubscriptions = financeRes.data?.metrics?.activeSubscriptions ?? 0;
        const totalRevenueCents = financeRes.data?.metrics?.totalRevenueCents ?? 0;
        const workspacesCount = Array.isArray(workspacesRes.data?.workspaces) ? workspacesRes.data.workspaces.length : 0;
        const packagesCount = Array.isArray(packagesRes.data?.packages) ? packagesRes.data.packages.length : 0;

        setMetrics({ totalSubscriptions, activeSubscriptions, totalRevenueCents, workspacesCount, packagesCount });
      } catch (_e) {
        // Silent fail - keep zeros
      } finally {
        if (isMounted) setMetricsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const items = [
    {
      href: '/admin/users',
      title: 'Users',
      desc: 'Create and manage user accounts.',
      icon: <People color="primary" />,
      chip: 'Directory'
    },
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
      href: '/admin/landing',
      title: 'Landing Page',
      desc: 'Manage the global marketing landing page content.',
      icon: <AutoAwesome color="primary" />,
      chip: 'Content'
    },
    {
      href: '/admin/tutorial-videos',
      title: 'Tutorial Videos',
      desc: 'Manage tutorial videos for dashboard pages.',
      icon: <AutoAwesome color="primary" />,
      chip: 'Content'
    },
    {
      href: '/admin/analytics',
      title: 'Payment Analytics',
      desc: 'Revenue, subscriptions, and package performance.',
      icon: <Insights color="primary" />,
      chip: 'Reports'
    },
    {
      href: '/admin/monitoring',
      title: 'Performance',
      desc: 'System performance & monitoring dashboard.',
      icon: <Insights color="primary" />,
      chip: 'Monitoring'
    }
    ,
    {
      href: '/admin/meta-integration',
      title: 'Meta Integration',
      desc: 'Configure Meta (FB/IG/WA/Pixel) credentials & webhooks.',
      icon: <Insights color="primary" />,
      chip: 'Integrations'
    }
  ];

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 }, maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>App Management</Typography>
            <Typography color="text.secondary">
              Welcome, {adminUser?.fullName} ({adminUser?.email})
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={Link} href="/admin/workspaces" variant="contained" size="small">View Workspaces</Button>
            <Button component={Link} href="/admin/packages" variant="outlined" size="small">Manage Packages</Button>
            <Button variant="outlined" startIcon={<Logout />} onClick={logout} size="small">Logout</Button>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          {[{
            label: 'Workspaces', value: metrics.workspacesCount
          },{
            label: 'Packages', value: metrics.packagesCount
          },{
            label: 'Subscriptions', value: metrics.totalSubscriptions
          },{
            label: 'Active Subs', value: metrics.activeSubscriptions
          },{
            label: 'Total Revenue', value: metricsLoading ? null : `EGP ${(metrics.totalRevenueCents / 100).toLocaleString()}`
          }].map((m) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={m.label as string}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{m.label}</Typography>
                  {metricsLoading ? (
                    <Skeleton variant="text" width={80} height={28} />
                  ) : (
                    <Typography variant="h6" fontWeight={800}>{m.value as any}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Grid container spacing={3}>
        {items.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.href}>
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


