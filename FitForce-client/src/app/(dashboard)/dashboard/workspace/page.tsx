'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { setWorkspace } from '@/store/slices/workspaceSlice';
import api from '@/utils/axios';
import { APP_CONFIG } from '@/lib/config';

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
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';

// project-imports
import MainCard from 'components/MainCard';
import ResponsiveTable from '@/components/ResponsiveTable';
import FileUpload from 'components/FileUpload';
import LandingPageEditor from 'components/LandingPageEditor';
import TemplateBuilder from '@/components/TemplateBuilder';

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

type PdfTemplate = {
  id: string;
  name: string;
  kind: 'workout' | 'nutrition' | string;
  schema: any;
  previewUrl?: string | null;
  updatedAt: string;
};

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
  // Templates state
  const [tplKind, setTplKind] = useState<'workout' | 'nutrition'>('workout');
  const [tplsLoading, setTplsLoading] = useState(false);
  const [tplsError, setTplsError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [tplName, setTplName] = useState('');
  const [builderSchema, setBuilderSchema] = useState<any | null>(null);
  const [tplCreating, setTplCreating] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  // Schema vs Fixed-config toggle and config state
  const [tplUseConfig, setTplUseConfig] = useState(true);
  const [cfgOrientation, setCfgOrientation] = useState<'phone' | 'tablet'>('phone');
  const [cfgCover, setCfgCover] = useState('');
  const [cfgCycle, setCfgCycle] = useState('');
  const [cfgCycles, setCfgCycles] = useState<string[]>([]);
  const [cfgMealsBg, setCfgMealsBg] = useState('');
  const [cfgExtraPages, setCfgExtraPages] = useState<Array<{ src: string; placement: 'top' | 'bottom' }>>([]);
  const [cfgMealsMode, setCfgMealsMode] = useState<'one_per_page' | 'multi_per_page'>('multi_per_page');
  const [cfgImageHalf, setCfgImageHalf] = useState(true);
  const [cfgTableStyle, setCfgTableStyle] = useState<'simple' | 'zebra' | 'boxed' | 'compact' | 'striped_dark' | 'boxed_bold'>('simple');
  const [cfgTableColor, setCfgTableColor] = useState<string>('#1976d2');
  const [cfgItemsPerPage, setCfgItemsPerPage] = useState(12);

  const canCreateTpl = useMemo(
    () => tplName.trim().length > 0 && !!builderSchema && !tplCreating,
    [tplName, builderSchema, tplCreating]
  );

  async function fetchTemplates(kindParam?: 'workout' | 'nutrition') {
    if (!workspaceId) return;
    setTplsLoading(true);
    setTplsError(null);
    try {
      const res = await api.get('/api/templates', { params: { kind: kindParam || tplKind } });
      setTemplates(res.data?.templates || []);
    } catch (e: any) {
      setTplsError(e?.message || 'Failed to load templates');
    } finally {
      setTplsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplKind, workspaceId]);


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
            <Tab label="PDF Templates" />
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
                      endAdornment: <InputAdornment position="end">.{APP_CONFIG.frontendDomain}</InputAdornment>
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
                  
                  <Grid container spacing={2}>
                    <Grid item xs={8} sm={9} md={10}>
                      <TextField
                        fullWidth
                        label="Primary Color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#3B82F6"
                        helperText="Enter a hex color code (e.g., #3B82F6)"
                      />
                    </Grid>
                    <Grid item xs={4} sm={3} md={2}>
                      <TextField
                        fullWidth
                        type="color"
                        label="Pick"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        inputProps={{ style: { padding: 0, height: 48 } }}
                      />
                    </Grid>
                  </Grid>
                  
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

        {/* PDF Templates Tab */}
        <TabPanel value={activeTab} index={3}>
          <Stack spacing={3}>
            <Card>
              <CardHeader>
                <Typography variant="h6" component="h2">
                  Create Template
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Define a template schema for workout or nutrition PDFs
                </Typography>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Name"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        placeholder="Workout Simple v1"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel id="tpl-kind-label">Kind</InputLabel>
                        <Select
                          labelId="tpl-kind-label"
                          value={tplKind}
                          label="Kind"
                          onChange={(e) => setTplKind(e.target.value as any)}
                        >
                          <MenuItem value="workout">workout</MenuItem>
                          <MenuItem value="nutrition">nutrition</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                    <Stack direction="row" spacing={2} alignItems="center">
                      {tplUseConfig && (
                        <Button
                          variant="outlined"
                          onClick={async () => {
                            try {
                              const backgrounds: any = {};
                              if (cfgCover.trim()) backgrounds.cover = cfgCover.trim();
                              if (tplKind === 'nutrition') {
                                if (cfgCycles.length > 0) backgrounds.cycle = cfgCycles; else if (cfgCycle.trim()) backgrounds.cycle = cfgCycle.trim();
                              }
                              if (cfgMealsBg.trim()) backgrounds.meals = cfgMealsBg.trim();
                              const res = await api.post('/api/templates/preview', {
                                kind: tplKind,
                                config: {
                                  orientation: cfgOrientation,
                                  backgrounds,
                                  mealsLayout: {
                                    mode: cfgMealsMode,
                                    imageHalf: cfgImageHalf,
                                    itemsPerPage: Math.max(1, Number(cfgItemsPerPage) || 1),
                                    tableStyle: cfgTableStyle,
                                    tableColor: cfgTableColor
                                  }
                                }
                              });
                              const url = res.data?.pdfUrl; if (url) window.open(url, '_blank');
                            } catch (e) {}
                          }}
                        >
                          Live Preview
                        </Button>
                      )}
                    <Button
                      variant="contained"
                      disabled={tplUseConfig ? !(tplName.trim().length > 0) || tplCreating : !canCreateTpl}
                      onClick={async () => {
                        if (!tplName.trim()) return;
                        setTplCreating(true);
                        setTplsError(null);
                        try {
                          if (!tplUseConfig) {
                            if (!builderSchema) return;
                            await api.post('/api/templates', { name: tplName.trim(), kind: tplKind, schema: builderSchema });
                          } else {
                            const backgrounds: any = {};
                            if (cfgCover.trim()) backgrounds.cover = cfgCover.trim();
                            if (tplKind === 'nutrition') {
                              if (cfgCycles.length > 0) backgrounds.cycle = cfgCycles;
                              else if (cfgCycle.trim()) backgrounds.cycle = cfgCycle.trim();
                            }
                            if (cfgMealsBg.trim()) backgrounds.meals = cfgMealsBg.trim();
                            if (cfgExtraPages.length > 0) backgrounds.extra = cfgExtraPages;
                            await api.post('/api/templates', {
                              name: tplName.trim(),
                              kind: tplKind,
                              config: {
                                orientation: cfgOrientation,
                                backgrounds,
                                mealsLayout: {
                                  mode: cfgMealsMode,
                                  imageHalf: cfgImageHalf,
                                  itemsPerPage: Math.max(1, Number(cfgItemsPerPage) || 1),
                                  tableStyle: cfgTableStyle,
                                  tableColor: cfgTableColor
                                }
                              }
                            });
                          }
                          setTplName('');
                          setBuilderSchema(null);
                          setTplUseConfig(false);
                          await fetchTemplates();
                        } catch (e: any) {
                          setTplsError(e?.message || 'Failed to create template');
                        } finally {
                          setTplCreating(false);
                        }
                      }}
                    >
                      {tplCreating ? 'Saving...' : 'Save Template'}
                    </Button>
                    {tplsError && <Typography color="error" variant="body2">{tplsError}</Typography>}
                  </Stack>

                  {tplUseConfig ? (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth>
                            <InputLabel id="cfg-orientation-label">Orientation</InputLabel>
                            <Select labelId="cfg-orientation-label" label="Orientation" value={cfgOrientation} onChange={(e) => setCfgOrientation(e.target.value as any)}>
                              <MenuItem value="phone">phone (A4 portrait)</MenuItem>
                              <MenuItem value="tablet">tablet (A4 landscape)</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField fullWidth type="number" label="Items per page" value={cfgItemsPerPage} onChange={(e) => setCfgItemsPerPage(Math.max(1, Number(e.target.value) || 1))} />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth>
                            <InputLabel id="cfg-meals-mode-label">{tplKind === 'workout' ? 'Exercises mode' : 'Meals mode'}</InputLabel>
                            <Select labelId="cfg-meals-mode-label" label={tplKind === 'workout' ? 'Exercises mode' : 'Meals mode'} value={cfgMealsMode} onChange={(e) => setCfgMealsMode(e.target.value as any)}>
                              <MenuItem value="multi_per_page">multi_per_page</MenuItem>
                              <MenuItem value="one_per_page">one_per_page</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Divider sx={{ my: 1 }} />
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Extra background pages</Typography>
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                              <Button variant="outlined" size="small" onClick={() => { if (cfgExtraPages.length < 10) setCfgExtraPages((arr) => [...arr, { src: '', placement: 'bottom' }]); }}>Add Extra Page</Button>
                              {cfgExtraPages.map((p, idx) => (
                                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                                  <Chip label={`Page ${idx + 1}`} />
                                  <FileUpload
                                    workspaceId={workspace?.id || ''}
                                    uploadType="landing"
                                    maxSize={5}
                                    onUploadComplete={(url) => setCfgExtraPages((arr) => arr.map((it, i) => i === idx ? { ...it, src: url } : it))}
                                  />
                                  <FormControl size="small">
                                    <Select value={p.placement} onChange={(e) => setCfgExtraPages((arr) => arr.map((it, i) => i === idx ? { ...it, placement: e.target.value as 'top' | 'bottom' } : it))}>
                                      <MenuItem value="top">top</MenuItem>
                                      <MenuItem value="bottom">bottom</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <Button size="small" onClick={() => idx>0 && setCfgExtraPages((arr) => { const copy=[...arr]; const t=copy[idx-1]; copy[idx-1]=copy[idx]; copy[idx]=t; return copy; })} disabled={idx===0}>↑</Button>
                                  <Button size="small" onClick={() => idx<cfgExtraPages.length-1 && setCfgExtraPages((arr) => { const copy=[...arr]; const t=copy[idx+1]; copy[idx+1]=copy[idx]; copy[idx]=t; return copy; })} disabled={idx===cfgExtraPages.length-1}>↓</Button>
                                  <Button size="small" color="error" onClick={() => setCfgExtraPages((arr) => arr.filter((_, i) => i !== idx))}>✕</Button>
                                </Stack>
                              ))}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">Upload one or more images; each will become a full extra page.</Typography>
                          </Stack>
                        </Grid>
                      </Grid>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Cover background</Typography>
                            <FileUpload
                              workspaceId={workspace?.id || ''}
                              uploadType="landing"
                              maxSize={5}
                              onUploadComplete={(url) => setCfgCover(url)}
                            />
                            {cfgCover && <Typography variant="caption" color="text.secondary">Uploaded</Typography>}
                          </Stack>
                        </Grid>
                        {tplKind === 'nutrition' && (
                          <Grid item xs={12} md={4}>
                            <Stack spacing={1}>
                              <Typography variant="subtitle2">Cycle background(s)</Typography>
                              <FileUpload
                                workspaceId={workspace?.id || ''}
                                uploadType="landing"
                                maxSize={5}
                                onUploadComplete={(url) => setCfgCycles((arr) => [...arr, url])}
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {cfgCycles.map((u, i) => (
                                  <Chip key={i} label={`Cycle ${i + 1}`} onDelete={() => setCfgCycles((arr) => arr.filter((_, idx) => idx !== i))} />
                                ))}
                              </Stack>
                              {!cfgCycles.length && (
                                <>
                                  <Typography variant="caption" color="text.secondary">Or upload a single cycle background</Typography>
                                  <FileUpload
                                    workspaceId={workspace?.id || ''}
                                    uploadType="landing"
                                    maxSize={5}
                                    onUploadComplete={(url) => setCfgCycle(url)}
                                  />
                                  {cfgCycle && <Typography variant="caption" color="text.secondary">Single cycle uploaded</Typography>}
                                </>
                              )}
                            </Stack>
                          </Grid>
                        )}
                        <Grid item xs={12} md={4}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">{tplKind === 'workout' ? 'Exercises background' : 'Meals background'}</Typography>
                            <FileUpload
                              workspaceId={workspace?.id || ''}
                              uploadType="landing"
                              maxSize={5}
                              onUploadComplete={(url) => setCfgMealsBg(url)}
                            />
                            {cfgMealsBg && <Typography variant="caption" color="text.secondary">Uploaded</Typography>}
                          </Stack>
                        </Grid>
                      </Grid>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>Table style</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {(['simple','zebra','boxed','compact','striped_dark','boxed_bold'] as const).map((style) => (
                              <Box key={style}
                                onClick={() => setCfgTableStyle(style)}
                                sx={{
                                  width: 120,
                                  borderRadius: 1,
                                  border: '2px solid',
                                  borderColor: cfgTableStyle === style ? 'primary.main' : 'divider',
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  mr: 1,
                                  mb: 1,
                                  bgcolor: 'background.paper'
                                }}
                                title={style}
                              >
                                <Box sx={{ height: 16, bgcolor: style==='boxed_bold' ? 'grey.400' : style==='boxed' ? 'grey.300' : 'grey.200' }} />
                                <Box sx={{ p: 1 }}>
                                  {[0,1,2].map((i) => (
                                    <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '64px 24px 24px', gap: 0.5, alignItems: 'center',
                                      bgcolor: (style==='zebra' || style==='striped_dark') && i%2===0 ? (style==='striped_dark' ? 'grey.200' : 'grey.100') : 'transparent',
                                      borderBottom: (style==='boxed' || style==='boxed_bold') ? '1px solid #e5e7eb' : 'none' }}>
                                      <Box sx={{ height: 8, bgcolor: 'grey.300', borderRadius: 0.5 }} />
                                      <Box sx={{ height: 8, bgcolor: 'grey.300', borderRadius: 0.5 }} />
                                      <Box sx={{ height: 8, bgcolor: 'grey.300', borderRadius: 0.5 }} />
                                    </Box>
                                  ))}
                                </Box>
                                <Box sx={{ px: 1, pb: 1 }}>
                                  <Typography variant="caption" color="text.secondary">{style}</Typography>
                                </Box>
                              </Box>
                            ))}
                          </Stack>
                        </Grid>
                        {tplKind === 'workout' && (
                          <Grid item xs={12} md={6}>
                            <TextField fullWidth type="color" label="Table color" value={cfgTableColor} onChange={(e) => setCfgTableColor(e.target.value)} helperText="Header background color (workout only)" />
                          </Grid>
                        )}
                        {cfgMealsMode === 'one_per_page' && (
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                              <InputLabel id="cfg-image-half-label">Image half height</InputLabel>
                              <Select labelId="cfg-image-half-label" label="Image half height" value={cfgImageHalf ? 'true' : 'false'} onChange={(e) => setCfgImageHalf(e.target.value === 'true')}>
                                <MenuItem value="true">true (50%)</MenuItem>
                                <MenuItem value="false">false (35%)</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                  <Typography variant="h6" component="h2">Templates</Typography>
                  <Button variant="outlined" onClick={() => fetchTemplates()}>{tplsLoading ? 'Loading...' : 'Refresh'}</Button>
                </Stack>
              </CardHeader>
              <CardContent>
                <Grid container spacing={2}>
                  {templates.map((t) => (
                    <Grid key={t.id} item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardHeader
                          title={<Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" sx={{ mr: 1 }}>{t.name}</Typography>
                            <Chip size="small" label={t.kind} variant="outlined" />
                          </Stack>}
                          subheader={<Typography variant="caption" color="text.secondary">Updated {new Date(t.updatedAt).toLocaleString()}</Typography>}
                        />
                        <CardContent>
                          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Button size="small" variant="outlined" onClick={async () => {
                              try {
                                const res = await api.get(`/api/templates/${t.id}/preview`);
                                const url = res.data?.pdfUrl;
                                if (url) window.open(url, '_blank');
                              } catch {}
                            }}>Preview PDF</Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {templates.length === 0 && !tplsLoading && (
                    <Grid item xs={12}>
                      <Alert severity="info">No templates for this kind yet.</Alert>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>
        <Dialog fullScreen open={builderOpen} onClose={() => setBuilderOpen(false)}>
          <DialogContent sx={{ p: 2 }}>
            <TemplateBuilder
              open={builderOpen}
              onClose={() => setBuilderOpen(false)}
              value={builderSchema}
              workspaceId={workspace?.id}
              kind={tplKind}
              onSave={(schema) => {
                setBuilderSchema(schema);
                setBuilderOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </MainCard>
    </Box>
  );
}