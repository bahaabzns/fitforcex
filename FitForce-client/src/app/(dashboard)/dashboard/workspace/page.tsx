'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace } from '@/store/slices/workspaceSlice';
import api from '@/utils/axios';

// MUI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import InputAdornment from '@mui/material/InputAdornment';

// project-imports
import MainCard from 'components/MainCard';
import FileUpload from 'components/FileUpload';
import LandingPageEditor from 'components/LandingPageEditor';

// Icons
import { Settings, Warning2 } from '@wandersonalwes/iconsax-react';

interface WorkspaceData {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  brandingLogoUrl?: string | null;
  brandingPrimaryHex?: string | null;
  landingConfig?: {
    title?: string;
    subtitle?: string;
    heroImage?: string;
    ctaText?: string;
    ctaUrl?: string;
    testimonials?: Array<{
      quote: string;
      author: string;
      role: string;
    }>;
  } | null;
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

export default function WorkspacePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const subdomain = useAppSelector((s) => s.workspace.subdomain);

  const [workspace, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Form states
  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');

  // Loading states
  const [saving, setSaving] = useState(false);
  const [brandingLoading, setBrandingLoading] = useState(false);

  // Success/Error states
  const [brandingSuccess, setBrandingSuccess] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain) {
      setError('No workspace subdomain found');
      setLoading(false);
      return;
    }

    const fetchWorkspace = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/workspaces/by-subdomain/${subdomain}`);
        const ws = response.data?.workspace;
        const owner = !!response.data?.isOwner;
        
        setIsOwner(owner);
        setWorkspaceData(ws);
        setWorkspaceName(ws?.name || '');
        setLogoUrl(ws?.brandingLogoUrl || '');
        setPrimaryColor(ws?.brandingPrimaryHex || '#3B82F6');
        
        if (owner && ws?.id && workspaceId !== ws.id) {
          dispatch(setWorkspace({ id: ws.id, subdomain }));
        }
      } catch {
        setError('Failed to load workspace data');
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [subdomain, workspaceId, dispatch]);

  const handleBrandingSave = async () => {
    if (!workspace?.id) return;
    
    setBrandingLoading(true);
    setBrandingError(null);
    setBrandingSuccess(false);

    try {
      const response = await api.put(`/api/workspaces/${workspace.id}/branding`, {
        brandingLogoUrl: logoUrl || null,
        brandingPrimaryHex: primaryColor || null
      });
      
      setWorkspaceData(prev => prev ? { 
        ...prev, 
        brandingLogoUrl: response.data.workspace.brandingLogoUrl,
        brandingPrimaryHex: response.data.workspace.brandingPrimaryHex
      } : null);
      
      setBrandingSuccess(true);
      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch {
      setBrandingError('Failed to save branding');
    } finally {
      setBrandingLoading(false);
    }
  };

  const handleGeneralSave = async () => {
    if (!workspace?.id) return;
    
    setSaving(true);
    try {
      await api.put(`/api/workspaces/${workspace.id}`, {
        name: workspaceName
      });
      
      setWorkspaceData(prev => prev ? { 
        ...prev, 
        name: workspaceName
      } : null);
    } catch {
      setError('Failed to save workspace settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace?.id) return;
    
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/workspaces/${workspace.id}`);
      router.push('/dashboard');
    } catch {
      setError('Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading workspace...</Typography>
        </Stack>
      </Box>
    );
  }

  if (isOwner === false) {
    return (
      <MainCard sx={{ borderColor: 'error.main' }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Warning2 size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <Typography variant="h6" color="error" gutterBottom>
            Access Restricted
          </Typography>
          <Typography color="text.secondary">
            You are not the owner of this workspace. Redirecting to main site...
          </Typography>
        </Box>
      </MainCard>
    );
  }

  if (error) {
    return (
      <MainCard>
        <Alert severity="error">{error}</Alert>
      </MainCard>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            bgcolor: 'primary.lighter',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Settings size={24} style={{ color: '#1976d2' }} />
        </Box>
        <Box>
          <Typography variant="h4" gutterBottom>
            Workspace Settings
          </Typography>
          <Typography color="text.secondary">
            Manage the workspace configuration, branding, and billing
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <MainCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="General" />
            <Tab label="Branding" />
            <Tab label="Landing Page" />
          </Tabs>
        </Box>

        {/* General Tab */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={3}>
            <Card>
              <CardHeader>
                <Typography variant="h6" component="h2">
                  General
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Workspace name and subdomain
                </Typography>
              </CardHeader>
              <CardContent>
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                  />
                  <TextField
                    fullWidth
                    label="Subdomain"
                    value={workspace?.subdomain || ''}
                    disabled
                    InputProps={{
                      startAdornment: <InputAdornment position="start">https://</InputAdornment>,
                      endAdornment: <InputAdornment position="end">.nano.com</InputAdornment>
                    }}
                  />
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      onClick={handleGeneralSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button variant="outlined" startIcon={<Settings />}>
                      Advanced
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card sx={{ borderColor: 'error.main' }}>
              <CardHeader>
                <Typography variant="h6" component="h2" color="error">
                  Danger Zone
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Delete this workspace
                </Typography>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Deleting a workspace is irreversible. All data will be permanently removed.
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleDeleteWorkspace}
                  >
                    Delete Workspace
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* Branding Tab */}
        <TabPanel value={activeTab} index={1}>
          <Stack spacing={3}>
            {brandingError && <Alert severity="error">{brandingError}</Alert>}
            {brandingSuccess && <Alert severity="success">Branding updated successfully!</Alert>}
            
            <Card>
              <CardHeader>
                <Typography variant="h6" component="h2">
                  Branding
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Customize your workspace branding
                </Typography>
              </CardHeader>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Logo
                    </Typography>
                    <FileUpload
                      onUploadComplete={(imageUrl) => {
                        setLogoUrl(imageUrl);
                      }}
                      currentImageUrl={workspace?.brandingLogoUrl || ""}
                      workspaceId={workspace?.id || ""}
                      uploadType="branding"
                      maxSize={5}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Upload your workspace logo (PNG, JPG, or SVG, max 5MB)
                    </Typography>
                  </Box>
                  
                  <TextField
                    fullWidth
                    label="Primary Color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3B82F6"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">#</InputAdornment>
                    }}
                    helperText="Enter a hex color code (e.g., #3B82F6)"
                  />
                  
                  {/* Preview */}
                  {(workspace?.brandingLogoUrl || workspace?.brandingPrimaryHex) && (
                    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Preview
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {workspace.brandingLogoUrl ? (
                          <Box
                            component="img"
                            src={workspace.brandingLogoUrl}
                            alt="Logo preview"
                            sx={{ width: 32, height: 32, borderRadius: 1 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: workspace.brandingPrimaryHex || '#3B82F6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Settings size={16} style={{ color: 'white' }} />
                          </Box>
                        )}
                        <Typography variant="h6">{workspace.name}</Typography>
                      </Stack>
                    </Box>
                  )}

                  <Button
                    variant="contained"
                    onClick={handleBrandingSave}
                    disabled={brandingLoading}
                  >
                    {brandingLoading ? 'Saving...' : 'Save Branding'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* Landing Page Tab */}
        <TabPanel value={activeTab} index={2}>
          {workspace?.id ? (
            <LandingPageEditor
              workspaceId={workspace.id}
              initialConfig={workspace.landingConfig || {}}
              onSave={(config) => {
                setWorkspaceData(prev => prev ? { ...prev, landingConfig: config } : null);
              }}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}
        </TabPanel>
      </MainCard>
    </Box>
  );
}