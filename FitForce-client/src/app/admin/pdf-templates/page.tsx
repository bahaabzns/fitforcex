'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Delete, Add, Edit, Visibility, CloudUpload } from '@mui/icons-material';
import { listPdfTemplates, uploadPdfTemplate, assignTemplate, deleteTemplate, getPdfTemplate, PdfTemplate, UploadTemplateData } from '@/api/pdf-templates';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';

export default function PdfTemplatesPage() {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate | null>(null);
  const [viewPlaceholdersOpen, setViewPlaceholdersOpen] = useState(false);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState<UploadTemplateData>({
    name: '',
    kind: 'nutrition',
    isGlobal: false,
    assignedWorkspaceIds: [],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Assignment form state
  const [assignForm, setAssignForm] = useState({
    isGlobal: false,
    assignedWorkspaceIds: [] as string[],
  });
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { templates } = await listPdfTemplates();
      setTemplates(templates);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const { data } = await api.get('/api/admin/workspaces');
      const wsList = Array.isArray(data?.workspaces) ? data.workspaces : [];
      setWorkspaces(wsList.map((w: any) => ({ id: w.id, name: w.name })));
    } catch (e) {
      console.error('Failed to fetch workspaces', e);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchWorkspaces();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.name) {
      openSnackbar('Please select a file and enter a name', 'error');
      return;
    }

    try {
      setUploading(true);
      await uploadPdfTemplate(selectedFile, uploadForm);
      openSnackbar('Template uploaded successfully', 'success');
      setUploadDialogOpen(false);
      setUploadForm({ name: '', kind: 'nutrition', isGlobal: false, assignedWorkspaceIds: [] });
      setSelectedFile(null);
      fetchTemplates();
    } catch (e: any) {
      openSnackbar(e.response?.data?.message || 'Failed to upload template', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplate) return;

    try {
      await assignTemplate(selectedTemplate.id, assignForm);
      openSnackbar('Template assignment updated', 'success');
      setAssignDialogOpen(false);
      fetchTemplates();
    } catch (e: any) {
      openSnackbar(e.response?.data?.message || 'Failed to update assignment', 'error');
    }
  };

  const handleDelete = async (template: PdfTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await deleteTemplate(template.id);
      openSnackbar('Template deleted', 'success');
      fetchTemplates();
    } catch (e: any) {
      openSnackbar(e.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  const handleViewPlaceholders = async (template: PdfTemplate) => {
    try {
      const { template: fullTemplate } = await getPdfTemplate(template.id);
      setPlaceholders(fullTemplate.placeholders || []);
      setPatterns(fullTemplate.patterns || []);
      setViewPlaceholdersOpen(true);
    } catch (e: any) {
      openSnackbar(e.response?.data?.message || 'Failed to load placeholders', 'error');
    }
  };

  const handleOpenAssign = (template: PdfTemplate) => {
    setSelectedTemplate(template);
    setAssignForm({
      isGlobal: template.isGlobal,
      assignedWorkspaceIds: (template.assignedWorkspaceIds || []) as string[],
    });
    setAssignDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">PDF Templates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload PDF templates with placeholders for nutrition and workout plans
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setShowInstructions(true)}
          >
            View Instructions
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Template
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Assignment</TableCell>
                <TableCell>Workspace</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">No templates found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={template.kind}
                        color={template.kind === 'nutrition' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {template.isGlobal ? (
                        <Chip label="Global" color="success" size="small" />
                      ) : (
                        <Chip
                          label={`${template.assignedWorkspaceIds?.length || 0} workspace(s)`}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>{template.workspace?.name || '-'}</TableCell>
                    <TableCell>{new Date(template.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleViewPlaceholders(template)}
                        title="View placeholders"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAssign(template)}
                        title="Edit assignment"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(template)}
                        title="Delete"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload PDF Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template Name"
              fullWidth
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Kind</InputLabel>
              <Select
                value={uploadForm.kind}
                label="Kind"
                onChange={(e) => setUploadForm({ ...uploadForm, kind: e.target.value as 'nutrition' | 'workout' })}
              >
                <MenuItem value="nutrition">Nutrition</MenuItem>
                <MenuItem value="workout">Workout</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUpload />}
              fullWidth
            >
              {selectedFile ? selectedFile.name : 'Select PDF File'}
              <input
                type="file"
                hidden
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </Button>
            <FormControlLabel
              control={
                <Checkbox
                  checked={uploadForm.isGlobal}
                  onChange={(e) => setUploadForm({ ...uploadForm, isGlobal: e.target.checked })}
                />
              }
              label="Global Template (available to all workspaces)"
            />
            {!uploadForm.isGlobal && (
              <FormControl fullWidth>
                <InputLabel>Assign to Workspaces</InputLabel>
                <Select
                  multiple
                  value={uploadForm.assignedWorkspaceIds || []}
                  label="Assign to Workspaces"
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      assignedWorkspaceIds: e.target.value as string[],
                    })
                  }
                >
                  {workspaces.map((ws) => (
                    <MenuItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !uploadForm.name}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={assignForm.isGlobal}
                  onChange={(e) => setAssignForm({ ...assignForm, isGlobal: e.target.checked })}
                />
              }
              label="Global Template (available to all workspaces)"
            />
            {!assignForm.isGlobal && (
              <FormControl fullWidth>
                <InputLabel>Assign to Workspaces</InputLabel>
                <Select
                  multiple
                  value={assignForm.assignedWorkspaceIds}
                  label="Assign to Workspaces"
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      assignedWorkspaceIds: e.target.value as string[],
                    })
                  }
                >
                  {workspaces.map((ws) => (
                    <MenuItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onClose={() => setShowInstructions(false)} maxWidth="lg" fullWidth>
        <DialogTitle>PDF Template Instructions</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>How to Create PDF Templates</Typography>
            <Typography variant="body2" paragraph>
              Create your PDF template in any PDF editor, then add placeholders as text using the format: <code>[placeholder.name]</code>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Available Placeholders</Typography>
            
            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>Common (Both Plans):</Typography>
            <Box component="pre" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontSize: '0.875rem', overflow: 'auto' }}>
{`[workspace.name] - Workspace name
[plan.title] - Plan title
[client.name] - Client full name`}
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>Nutrition Plans:</Typography>
            <Box component="pre" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontSize: '0.875rem', overflow: 'auto' }}>
{`[page.intro] - Page section marker
[cycle.name] - Cycle/day label
[cycle.macros] - Cycle macros (formatted)
[cycle.micros] - Cycle micros (formatted)
[cycle.meal.name] - Meal name
[cycle.meal.fooditem1] - Food item 1
[cycle.meal.fooditem2] - Food item 2
[cycle.meal.fooditem3] - Food item 3
[cycle.meal.fooditem4] - Food item 4
... (continue numbering as needed)`}
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>Workout Plans:</Typography>
            <Box component="pre" sx={{ bgcolor: 'grey.100', p: 1, borderRadius: 1, fontSize: '0.875rem', overflow: 'auto' }}>
{`[day.name] - Day label
[day.exercise1] - Exercise 1
[day.exercise2] - Exercise 2
... (continue numbering as needed)`}
            </Box>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Repeating Patterns</Typography>
            <Typography variant="body2" paragraph>
              When you use numbered placeholders (e.g., <code>fooditem1</code> through <code>fooditem4</code>), the system will:
            </Typography>
            <ul>
              <li>Display up to 4 items per page</li>
              <li>Automatically duplicate the page if there are more items</li>
              <li>Fill duplicated pages with remaining items</li>
            </ul>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Example Template</Typography>
            <Box component="pre" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, fontSize: '0.875rem', overflow: 'auto' }}>
{`NUTRITION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Workspace: [workspace.name]
Client: [client.name]
Plan: [plan.title]

CYCLE: [cycle.name]
Macros: [cycle.macros]

MEAL: [cycle.meal.name]
• [cycle.meal.fooditem1]
• [cycle.meal.fooditem2]
• [cycle.meal.fooditem3]
• [cycle.meal.fooditem4]`}
            </Box>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Placeholders must be typed exactly as shown (case-sensitive, square brackets, no spaces).
                The system will automatically detect placeholders when you upload the template.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstructions(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* View Placeholders Dialog */}
      <Dialog open={viewPlaceholdersOpen} onClose={() => setViewPlaceholdersOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detected Placeholders</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Placeholders ({placeholders.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {placeholders.length === 0 ? (
                  <Typography color="text.secondary">No placeholders detected</Typography>
                ) : (
                  placeholders.map((ph, idx) => (
                    <Chip key={idx} label={ph} size="small" />
                  ))
                )}
              </Box>
            </Box>
            {patterns.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Repeating Patterns:
                </Typography>
                {patterns.map((pattern, idx) => (
                  <Chip
                    key={idx}
                    label={`${pattern.baseName}1-${pattern.maxNumber} (page ${pattern.pageIndex + 1})`}
                    size="small"
                    color="primary"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewPlaceholdersOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

