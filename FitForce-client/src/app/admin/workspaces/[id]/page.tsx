'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/utils/axios';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import OverviewTab from './components/OverviewTab';
import TeamMembersTab from './components/TeamMembersTab';
import SubscriptionTab from './components/SubscriptionTab';
import OwnersTab from './components/OwnersTab';

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  members: Array<{
    id: string;
    user: {
      id: string;
      fullName: string;
      email: string;
    };
    role: {
      id: string;
      name: string;
    };
    createdAt: string;
  }>;
  workspaceSubscription?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    package: {
      id: string;
      name: string;
      durationMonths: number;
      priceCents: number;
    };
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`workspace-tabpanel-${index}`}
      aria-labelledby={`workspace-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/api/admin/workspaces/${workspaceId}`);
      setWorkspace(data.workspace);
    } catch (e) {
      setError('Failed to fetch workspace details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefresh = () => {
    fetchWorkspace();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !workspace) {
    return (
      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Workspace not found'}
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.back()}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          color="inherit"
          href="/admin/workspaces"
          onClick={(e) => {
            e.preventDefault();
            router.push('/admin/workspaces');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Workspaces
        </Link>
        <Typography color="text.primary">{workspace.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/admin/workspaces')}
        >
          Back to Workspaces
        </Button>
        <Typography variant="h4" fontWeight={800}>
          {workspace.name}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={handleRefresh}>
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="workspace management tabs">
            <Tab label="Overview" id="workspace-tab-0" aria-controls="workspace-tabpanel-0" />
            <Tab label="Team Members" id="workspace-tab-1" aria-controls="workspace-tabpanel-1" />
            <Tab label="Subscription" id="workspace-tab-2" aria-controls="workspace-tabpanel-2" />
            <Tab label="Owners" id="workspace-tab-3" aria-controls="workspace-tabpanel-3" />
            <Tab label="Exercises" id="workspace-tab-4" aria-controls="workspace-tabpanel-4" />
            <Tab label="Food Items" id="workspace-tab-5" aria-controls="workspace-tabpanel-5" />
          </Tabs>
        </Box>

        <CardContent>
          <TabPanel value={activeTab} index={0}>
            <OverviewTab workspace={workspace} onRefresh={handleRefresh} />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <TeamMembersTab workspace={workspace} onRefresh={handleRefresh} />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <SubscriptionTab workspace={workspace} onRefresh={handleRefresh} />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <OwnersTab workspace={workspace} onRefresh={handleRefresh} />
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => window.location.href = `/admin/workspaces/${workspaceId}/exercises`}
              >
                Manage Workspace Exercises
              </Button>
            </Box>
          </TabPanel>
          <TabPanel value={activeTab} index={5}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => window.location.href = `/admin/workspaces/${workspaceId}/food-items`}
              >
                Manage Workspace Food Items
              </Button>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}
