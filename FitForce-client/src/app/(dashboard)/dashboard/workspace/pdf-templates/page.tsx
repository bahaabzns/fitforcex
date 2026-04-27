"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/utils/axios";
import PdfBuilder from "@/components/PdfBuilder";
import ImageAssetManager from "@/components/ImageAssetManager";
import { useAppSelector } from "@/store";
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Chip, 
  Container, 
  Grid, 
  IconButton, 
  InputAdornment, 
  Paper, 
  TextField, 
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { Search, Refresh, Save, Visibility, Download, Image as ImageIcon } from '@mui/icons-material';

type Template = {
  id: string;
  name: string;
  kind: "workout" | "nutrition" | string;
  html?: string | null;
  schema?: any;
  updatedAt: string;
};

export default function PdfTemplatesWorkspacePage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [kind, setKind] = useState<"workout" | "nutrition">("workout");
  const [name, setName] = useState("");
  const [html, setHtml] = useState<string>(
    "<div style=\"padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial\">" +
      "<h1 style=\"margin:0 0 8px\">{{plan.title}}</h1>" +
      "<div style=\"color:#666;margin-bottom:12px\">Client: {{client.fullName}}</div>" +
      "<p>Start building your template by dragging blocks from the left.</p>" +
    "</div>"
  );
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  async function fetchTemplates() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/templates`, { params: { kind } });
      setTemplates((res.data?.templates as any[]) || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const canSave = useMemo(() => name.trim().length > 0 && html.trim().length > 0 && !saving, [name, html, saving]);

  const mockData = useMemo(() => {
    if (kind === 'workout') {
      return { plan: { title: '3-Day Split' }, client: { fullName: 'John Doe' } };
    }
    return { plan: { title: 'Nutrition Plan' }, client: { fullName: 'Jane Doe' } };
  }, [kind]);

  async function saveTemplate() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/templates`, { name: name.trim(), kind, html });
      setName("");
      await fetchTemplates();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function previewTemplate(id: string) {
    setPreviewing(id);
    try {
      const res = await api.get(`/api/templates/${id}/preview`);
      const url = res.data?.pdfUrl as string | undefined;
      if (url) window.open(url, "_blank");
    } catch {}
    setPreviewing(null);
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ borderBottom: 1, borderColor: 'grey.200' }}>
        <Container maxWidth="xl">
          <Box sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box>
                  <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'grey.900' }}>
                    PDF Templates
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'grey.600', mt: 0.5 }}>
                    Create and manage PDF templates for workout and nutrition plans
                  </Typography>
                </Box>
                
                {/* Template Type Selector */}
                <Paper sx={{ display: 'flex', bgcolor: 'grey.100', p: 0.5 }}>
                  <Button
                    onClick={() => setKind('workout')}
                    variant={kind === 'workout' ? 'contained' : 'text'}
                    size="small"
                    sx={{ 
                      minWidth: 100,
                      bgcolor: kind === 'workout' ? 'white' : 'transparent',
                      color: kind === 'workout' ? 'grey.900' : 'grey.600',
                      boxShadow: kind === 'workout' ? 1 : 0,
                      '&:hover': {
                        bgcolor: kind === 'workout' ? 'grey.50' : 'grey.200'
                      }
                    }}
                  >
                    💪 Workout
                  </Button>
                  <Button
                    onClick={() => setKind('nutrition')}
                    variant={kind === 'nutrition' ? 'contained' : 'text'}
                    size="small"
                    sx={{ 
                      minWidth: 100,
                      bgcolor: kind === 'nutrition' ? 'white' : 'transparent',
                      color: kind === 'nutrition' ? 'grey.900' : 'grey.600',
                      boxShadow: kind === 'nutrition' ? 1 : 0,
                      '&:hover': {
                        bgcolor: kind === 'nutrition' ? 'grey.50' : 'grey.200'
                      }
                    }}
                  >
                    🥗 Nutrition
                  </Button>
                </Paper>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates..."
                  size="small"
                  sx={{ width: 250 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  onClick={fetchTemplates}
                  variant="outlined"
                  startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Refresh"}
                </Button>
              </Box>
            </Box>
          </Box>
        </Container>
      </Paper>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper elevation={0} sx={{ mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Template Builder" icon={<Save />} />
            <Tab label="Image Assets" icon={<ImageIcon />} />
          </Tabs>
        </Paper>

        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* Left Column - Template Builder */}
            <Grid item xs={12} lg={8}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Template Name Input */}
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Template Name
                  </Typography>
                  <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter template name..."
                    fullWidth
                    size="small"
                  />
                </CardContent>
              </Card>

              {/* PDF Builder */}
              <Card elevation={1}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Template Builder
                    </Typography>
                    <Chip 
                      label={kind === 'workout' ? '💪 Workout' : '🥗 Nutrition'} 
                      size="small" 
                      variant="outlined"
                    />
                  </Box>
                  
                  <PdfBuilder
                    value={html}
                    onChange={setHtml}
                    constants={{ fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial', primaryColor: '#1976d2' }}
                    previewData={mockData}
                    workspaceId={workspaceId}
                  />
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button
                        onClick={saveTemplate}
                        disabled={!canSave}
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                        sx={{
                          bgcolor: 'primary.main',
                          '&:hover': { bgcolor: 'primary.dark' },
                          '&:disabled': { bgcolor: 'grey.300' }
                        }}
                      >
                        {saving ? "Saving..." : "Save Template"}
                      </Button>
                      {error && (
                        <Alert severity="error" sx={{ py: 0 }}>
                          {error}
                        </Alert>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Grid>

          {/* Right Column - Existing Templates */}
          <Grid item xs={12} lg={4}>
            <Card elevation={1} sx={{ position: 'sticky', top: 24 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Existing Templates
                  </Typography>
                  <Chip 
                    label={`${templates.length} ${templates.length === 1 ? 'template' : 'templates'}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                
                <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {templates.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())).map((t) => (
                    <Card key={t.id} elevation={0} sx={{ mb: 2, border: 1, borderColor: 'grey.200', '&:hover': { boxShadow: 2 } }}>
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                            {t.name}
                          </Typography>
                          <Chip 
                            label={`${t.kind === 'workout' ? '💪' : '🥗'} ${t.kind}`}
                            size="small"
                            color={t.kind === 'workout' ? 'primary' : 'success'}
                            variant="outlined"
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: 'grey.500', mb: 2, display: 'block' }}>
                          Updated: {new Date(t.updatedAt).toLocaleDateString()}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            onClick={() => previewTemplate(t.id)}
                            variant="outlined"
                            size="small"
                            startIcon={previewing === t.id ? <CircularProgress size={12} /> : <Visibility />}
                            disabled={previewing === t.id}
                            sx={{ flex: 1 }}
                          >
                            {previewing === t.id ? "Previewing..." : "Preview"}
                          </Button>
                          <Button
                            onClick={() => { setSelectedTemplateId(t.id); setName(t.name + ' Copy'); setHtml(t.html || '<div></div>'); }}
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            sx={{ flex: 1 }}
                          >
                            Load
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {!loading && templates.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ color: 'grey.400', mb: 1 }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'grey.500' }}>
                        No templates found
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'grey.400' }}>
                        Create your first template using the builder
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        )}

        {activeTab === 1 && (
          <Box>
            {workspaceId ? (
              <ImageAssetManager 
                workspaceId={workspaceId}
                showInsertButton={false}
              />
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please select a workspace to manage image assets.
              </Alert>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}


