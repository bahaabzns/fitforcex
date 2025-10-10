"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  TextField, 
  Typography,
  Modal,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import { Close, Visibility, Image as ImageIcon, Search } from '@mui/icons-material';
import ImageAssetManager from './ImageAssetManager';
import api from '@/utils/axios';

export type PdfBuilderProps = {
  value: string;
  onChange: (html: string) => void;
  constants?: { fontFamily?: string; primaryColor?: string; textColor?: string };
  previewData?: Record<string, any>;
  extraBlocks?: Array<{ id: string; label: string; snippet: string }>;
  workspaceId?: string;
};

type Block = { id: string; label: string; snippet: string };

interface TemplateAsset {
  id: string;
  name: string;
  description: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function applyConstants(snippet: string, constants?: PdfBuilderProps["constants"]): string {
  if (!constants) return snippet;
  let out = snippet;
  if (constants.fontFamily) {
    out = out.replace(/font-family:[^;"']+([;"'])/g, `font-family:${constants.fontFamily}$1`);
  }
  if (constants.primaryColor) {
    out = out.replace(/#1976d2/gi, constants.primaryColor);
  }
  if (constants.textColor) {
    out = out.replace(/color:\s*#[0-9a-f]{3,6}/gi, `color:${constants.textColor}`);
  }
  return out;
}

const DEFAULT_BLOCKS: Block[] = [
  { id: "h1", label: "Heading", snippet: `<h2 style=\"margin:16px 0 8px\">Section Title</h2>` },
  { id: "p", label: "Paragraph", snippet: `<p style=\"margin:0 0 8px\">Write something here...</p>` },
  { id: "div", label: "Divider", snippet: `<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:12px 0\"/>` },
  { id: "row2", label: "2-Column Row", snippet: `<div style=\"display:flex;gap:12px\"><div style=\"flex:1\">Left</div><div style=\"flex:1\">Right</div></div>` },
  { id: "client", label: "Client Name", snippet: `<div>Client: {{client.fullName}}</div>` },
  { id: "plan", label: "Plan Title", snippet: `<div>{{plan.title}}</div>` },
  { id: "img", label: "Image", snippet: `<img src=\"{{item.imageUrl}}\" alt=\"\" style=\"max-width:100%;height:auto;border-radius:6px\"/>` },
  { id: "tbl_workout", label: "Table (Workout)", snippet: `<table style=\"width:100%;border-collapse:collapse;margin-top:8px\">`+
      `<thead><tr>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Exercise</th>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Sets</th>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Reps</th>`+
      `</tr></thead><tbody>`+
      `<!-- Backend can render exercise rows here using data -->`+
      `</tbody></table>` },
  { id: "tbl_nutrition", label: "Table (Nutrition)", snippet: `<table style=\"width:100%;border-collapse:collapse;margin-top:8px\">`+
      `<thead><tr>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Meal</th>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Food</th>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Servings</th>`+
      `<th style=\"text-align:left;border:1px solid #e5e7eb;padding:6px;background:#f3f4f6\">Calories</th>`+
      `</tr></thead><tbody>`+
      `<!-- Backend can render meal rows here using data -->`+
      `</tbody></table>` }
];

function resolvePlaceholders(text: string, data?: Record<string, any>): string {
  if (!data) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const parts = String(key).split(".");
    let val: any = data;
    for (const p of parts) {
      if (val && typeof val === "object" && p in val) val = val[p]; else return "";
    }
    return val == null ? "" : String(val);
  });
}

export default function PdfBuilder({ value, onChange, constants, previewData, extraBlocks, workspaceId }: PdfBuilderProps) {
  const [html, setHtml] = useState<string>(value);
  const [filter, setFilter] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [imageAssets, setImageAssets] = useState<TemplateAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setHtml(value); }, [value]);
  useEffect(() => { onChange(html); }, [html]);

  // Load image assets when workspaceId changes
  useEffect(() => {
    if (workspaceId && workspaceId.trim() !== '') {
      loadImageAssets();
    } else {
      setImageAssets([]); // Clear assets if no workspaceId
    }
  }, [workspaceId]);

  const loadImageAssets = async () => {
    try {
      setAssetsLoading(true);
      const response = await api.get('/api/templates/assets', { headers: { 'x-workspace-id': workspaceId || '' } });
      const assets = response.data?.assets || [];
      setImageAssets(assets);
    } catch (error) {
      console.error('Error loading image assets:', error);
      setImageAssets([]); // Set empty array on error
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleAssetInsert = (asset: TemplateAsset) => {
    const imageSnippet = `<img src="${asset.url}" alt="${asset.name}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0"/>`;
    const snippet = applyConstants(imageSnippet, constants);
    const next = html.replace(/<\/div>\s*$/, `${snippet}</div>`);
    setHtml(next === html ? html + snippet : next);
  };

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/html") || e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const snippet = applyConstants(raw, constants);
    // append near end, before closing container if present
    const next = html.replace(/<\/div>\s*$/, `${snippet}</div>`);
    setHtml(next === html ? html + snippet : next);
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); }

  function makeDraggable(b: Block) {
    return (
      <Card 
        key={b.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/html", b.snippet);
          e.dataTransfer.setData("text/plain", b.snippet);
          e.dataTransfer.effectAllowed = "copy";
        }}
        elevation={1}
        sx={{ 
          cursor: 'move', 
          '&:hover': { 
            elevation: 3,
            bgcolor: 'grey.50'
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {b.label}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const blocks = useMemo(() => {
    const all = [...DEFAULT_BLOCKS, ...(extraBlocks || [])];
    return all.filter(b => b.label.toLowerCase().includes(filter.toLowerCase()));
  }, [filter, extraBlocks]);

  const imageBlocks = useMemo(() => {
    if (!imageAssets || !Array.isArray(imageAssets)) {
      return [];
    }
    return imageAssets.map(asset => ({
      id: `img_${asset.id}`,
      label: asset.name,
      snippet: `<img src="${asset.url}" alt="${asset.name}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0"/>`
    }));
  }, [imageAssets]);

  const previewHtml = useMemo(() => resolvePlaceholders(html, previewData), [html, previewData]);
  const previewWrapped = useMemo(() => {
    const baseCss = `
      :root { --primary: ${constants?.primaryColor || '#1976d2'}; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 16px; font-family: ${constants?.fontFamily || 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial'}; color: ${constants?.textColor || '#111827'}; font-size: 12px; }
      h1,h2,h3 { margin: 0 0 8px; font-weight: 600; }
      p { margin: 0 0 8px; }
      hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; }
      thead th { background: #f3f4f6; }
      img { max-width: 100%; height: auto; }
    `;
    return `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>${baseCss}</style></head><body>${previewHtml}</body></html>`;
  }, [previewHtml, constants?.primaryColor, constants?.fontFamily, constants?.textColor]);

  return (
    <>
      <Grid container spacing={3}>
        {/* Left Column - Blocks & Assets */}
        <Grid item xs={12} lg={3}>
          <Card elevation={0} sx={{ bgcolor: 'grey.50' }}>
            <CardContent sx={{ p: 0 }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Blocks" />
                <Tab label="Images" />
              </Tabs>
              
              <Box sx={{ p: 2 }}>
                {activeTab === 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Building Blocks
                    </Typography>
                    <TextField
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search blocks..."
                      size="small"
                      fullWidth
                      sx={{ mb: 2 }}
                      InputProps={{
                        startAdornment: <Search sx={{ mr: 1, color: 'grey.500' }} />
                      }}
                    />
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {blocks.map(makeDraggable)}
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, mt: 3 }}>
                      Quick Placeholders
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Button 
                        size="small"
                        variant="outlined"
                        onClick={() => setHtml((v) => v + '{{plan.title}}')}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {'{{plan.title}}'}
                      </Button>
                      <Button 
                        size="small"
                        variant="outlined"
                        onClick={() => setHtml((v) => v + '{{client.fullName}}')}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {'{{client.fullName}}'}
                      </Button>
                      <Button 
                        size="small"
                        variant="outlined"
                        onClick={() => setHtml((v) => v + '{{coach.name}}')}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {'{{coach.name}}'}
                      </Button>
                      <Button 
                        size="small"
                        variant="outlined"
                        onClick={() => setHtml((v) => v + '{{generatedAt}}')}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {'{{generatedAt}}'}
                      </Button>
                    </Box>
                  </>
                )}
                
                {activeTab === 1 && (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Image Assets
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Button size="small" variant="outlined" onClick={loadImageAssets}>Refresh</Button>
                      <Button size="small" variant="contained" onClick={() => setAssetsOpen(true)}>Manage Images</Button>
                    </Box>
                    {assetsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : imageBlocks.length === 0 ? (
                      <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                        No images uploaded yet. Upload images to use them in your templates.
                      </Alert>
                    ) : (
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {imageBlocks.map(makeDraggable)}
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Center Column - Canvas */}
        <Grid item xs={12} lg={6}>
          <Card elevation={1}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                p: 2, 
                borderBottom: 1, 
                borderColor: 'grey.200' 
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Template Canvas
                </Typography>
                <Button
                  onClick={() => setShowPreview(true)}
                  size="small"
                  variant="contained"
                  startIcon={<Visibility />}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Preview
                </Button>
              </Box>
              <Box
                ref={canvasRef}
                onDrop={onDrop}
                onDragOver={onDragOver}
                sx={{
                  minHeight: 400,
                  p: 2,
                  bgcolor: 'grey.50',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'grey.200', bgcolor: 'grey.50' }}>
                <Typography variant="caption" sx={{ color: 'grey.500' }}>
                  Drag blocks here. Use placeholders like {"{{plan.title}}"} and {"{{client.fullName}}"}.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - HTML Editor */}
        <Grid item xs={12} lg={3}>
          <Card elevation={1}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'grey.200' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  HTML Source
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <TextField
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  multiline
                  rows={16}
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Enter HTML code here..."
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.75rem'
                    }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Modal */}
      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        <Paper sx={{
          width: '90%',
          maxWidth: '1200px',
          height: '90%',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'grey.200' 
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Template Preview
            </Typography>
            <IconButton onClick={() => setShowPreview(false)}>
              <Close />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <iframe 
              title="preview" 
              style={{ width: '100%', height: '100%', border: 'none' }}
              srcDoc={previewWrapped} 
            />
          </Box>
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'grey.200', bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'grey.600' }}>
                This preview shows how your template will look with sample data
              </Typography>
              <Button
                onClick={() => setShowPreview(false)}
                variant="contained"
                size="small"
              >
                Close Preview
              </Button>
            </Box>
          </Box>
        </Paper>
      </Modal>

      {/* Manage Images Modal - reuse ImageAssetManager so uploads are immediately available */}
      <Modal
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
      >
        <Paper sx={{ width: '90%', maxWidth: 900, maxHeight: '85%', overflow: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'grey.200' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Manage Images</Typography>
            <IconButton onClick={() => setAssetsOpen(false)}><Close /></IconButton>
          </Box>
          <Box sx={{ p: 2 }}>
            <ImageAssetManager
              workspaceId={workspaceId || ''}
              showInsertButton
              onAssetInsert={(asset) => {
                handleAssetInsert(asset);
                // refresh the left image list to include new uploads
                loadImageAssets();
              }}
              onAssetSelect={(asset) => {
                handleAssetInsert(asset);
                loadImageAssets();
              }}
            />
          </Box>
        </Paper>
      </Modal>
    </>
  );
}


