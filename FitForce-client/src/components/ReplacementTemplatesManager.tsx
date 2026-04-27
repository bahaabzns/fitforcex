'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Autocomplete,
  Paper,
  Divider,
  FormControlLabel,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  listReplacementTemplates,
  createReplacementTemplate,
  updateReplacementTemplate,
  deleteReplacementTemplate,
  applyReplacementTemplate,
  type ReplacementTemplate,
  type ReplacementTemplateItem,
  type FoodItem,
  type CreateReplacementTemplateRequest,
  type UpdateReplacementTemplateRequest,
  type ApplyTemplateRequest,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import { Add, Edit, Trash, Play } from '@wandersonalwes/iconsax-react';
import { MoreVert } from '@mui/icons-material';

interface ReplacementTemplatesManagerProps {
  onApplyTemplate?: (templateId: string) => void;
}

export default function ReplacementTemplatesManager({
  onApplyTemplate,
}: ReplacementTemplatesManagerProps) {
  const [templates, setTemplates] = useState<ReplacementTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReplacementTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<ReplacementTemplate | null>(null);
  const [availableFoods, setAvailableFoods] = useState<FoodItem[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedPlans, setSelectedPlans] = useState<Array<{ id: string; title: string }>>([]);
  const [autoMatchMacros, setAutoMatchMacros] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; template: ReplacementTemplate } | null>(null);

  // Template form state
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateItems, setTemplateItems] = useState<ReplacementTemplateItem[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadAvailableFoods();
    loadAvailablePlans();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await listReplacementTemplates({ includeDefaults: true });
      setTemplates(data.templates);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to load templates',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFoods = async () => {
    try {
      const res = await api.get('/api/nutrition/food-items');
      const foodItems = res.data?.foodItems || res.data || [];
      setAvailableFoods(Array.isArray(foodItems) ? foodItems : []);
    } catch (err) {
      console.error('Failed to load food items:', err);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const res = await api.get('/api/nutrition/plans');
      const plans = res.data?.plans || res.data || [];
      setAvailablePlans(Array.isArray(plans) ? plans : []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateItems([]);
    setIsDefault(false);
    setDialogOpen(true);
  };

  const handleEdit = (template: ReplacementTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setTemplateItems(template.items);
    setIsDefault(template.isDefault);
    setDialogOpen(true);
  };

  const handleDelete = async (template: ReplacementTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await deleteReplacementTemplate(template.id);
      openSnackbar({
        open: true,
        message: 'Template deleted successfully',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);
      loadTemplates();
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to delete template',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    }
  };

  const handleApply = (template: ReplacementTemplate) => {
    setApplyingTemplate(template);
    setSelectedPlans([]);
    setAutoMatchMacros(false);
    setApplyDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      openSnackbar({
        open: true,
        message: 'Template name is required',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
      return;
    }

    if (templateItems.length === 0) {
      openSnackbar({
        open: true,
        message: 'At least one replacement item is required',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
      return;
    }

    try {
      if (editingTemplate) {
        await updateReplacementTemplate(editingTemplate.id, {
          name: templateName,
          description: templateDescription || undefined,
          items: templateItems,
        } as UpdateReplacementTemplateRequest);
        openSnackbar({
          open: true,
          message: 'Template updated successfully',
          variant: 'alert',
          alert: { color: 'success', variant: 'filled' },
        } as any);
      } else {
        await createReplacementTemplate({
          name: templateName,
          description: templateDescription || undefined,
          items: templateItems,
          isDefault,
        } as CreateReplacementTemplateRequest);
        openSnackbar({
          open: true,
          message: 'Template created successfully',
          variant: 'alert',
          alert: { color: 'success', variant: 'filled' },
        } as any);
      }
      setDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to save template',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplate) return;

    try {
      setProcessing(true);
      const response = await applyReplacementTemplate(applyingTemplate.id, {
        planIds: selectedPlans.length > 0 ? selectedPlans.map((p) => p.id) : undefined,
        autoMatchMacros,
      } as ApplyTemplateRequest);

      openSnackbar({
        open: true,
        message: `Template applied: ${response.summary.totalReplaced} items replaced across ${response.summary.totalPlans} plans`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
      } as any);

      setApplyDialogOpen(false);
      onApplyTemplate?.(applyingTemplate.id);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to apply template',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setProcessing(false);
    }
  };

  const addTemplateItem = () => {
    setTemplateItems([
      ...templateItems,
      {
        foodItemId: '',
        replacementId: '',
        priority: templateItems.length,
        notes: '',
      },
    ]);
  };

  const updateTemplateItem = (index: number, updates: Partial<ReplacementTemplateItem>) => {
    const updated = [...templateItems];
    updated[index] = { ...updated[index], ...updates };
    setTemplateItems(updated);
  };

  const removeTemplateItem = (index: number) => {
    setTemplateItems(templateItems.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Replacement Templates</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleCreateNew}>
          Create Template
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No templates found. Create your first template to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {templates.map((template) => (
            <Card key={template.id} variant="outlined">
              <CardHeader
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">{template.name}</Typography>
                    {template.isDefault && (
                      <Chip label="Default" size="small" color="primary" />
                    )}
                  </Box>
                }
                subheader={template.description || 'No description'}
                action={
                  <IconButton
                    onClick={(e) => setMenuAnchor({ el: e.currentTarget, template })}
                  >
                    <MoreVert />
                  </IconButton>
                }
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {template.items.length} replacement{template.items.length !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {template.items.slice(0, 3).map((item, idx) => {
                    const originalFood = availableFoods.find((f) => f.id === item.foodItemId);
                    const replacementFood = availableFoods.find((f) => f.id === item.replacementId);
                    return (
                      <Chip
                        key={idx}
                        label={`${originalFood?.name || 'Unknown'} → ${replacementFood?.name || 'Unknown'}`}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    );
                  })}
                  {template.items.length > 3 && (
                    <Chip
                      label={`+${template.items.length - 3} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Template Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleEdit(menuAnchor.template);
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <Edit size={18} variant="Bold" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleApply(menuAnchor.template);
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <Play size={18} variant="Bold" />
          </ListItemIcon>
          <ListItemText>Apply</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleDelete(menuAnchor.template);
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <Trash size={18} variant="Bold" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create/Edit Template Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Template Name *"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
            />
            {!editingTemplate && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                }
                label="Make this a default template (available to all workspaces)"
              />
            )}

            <Divider />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">Replacement Items</Typography>
                <Button size="small" startIcon={<Add />} onClick={addTemplateItem}>
                  Add Item
                </Button>
              </Box>

              {templateItems.map((item, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Item {index + 1}
                      </Typography>
                      <IconButton size="small" onClick={() => removeTemplateItem(index)}>
                        <Trash size={18} variant="Bold" />
                      </IconButton>
                    </Box>
                    <Autocomplete
                      options={availableFoods}
                      getOptionLabel={(option) => option?.name || ''}
                      value={availableFoods.find((f) => f.id === item.foodItemId) || null}
                      onChange={(_, newValue) =>
                        updateTemplateItem(index, { foodItemId: newValue?.id || '' })
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Original Food *" />
                      )}
                    />
                    <Autocomplete
                      options={availableFoods}
                      getOptionLabel={(option) => option?.name || ''}
                      value={availableFoods.find((f) => f.id === item.replacementId) || null}
                      onChange={(_, newValue) =>
                        updateTemplateItem(index, { replacementId: newValue?.id || '' })
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Replacement Food *" />
                      )}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Priority"
                      value={item.priority}
                      onChange={(e) =>
                        updateTemplateItem(index, { priority: parseInt(e.target.value) || 0 })
                      }
                      inputProps={{ min: 0 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Notes"
                      value={item.notes || ''}
                      onChange={(e) => updateTemplateItem(index, { notes: e.target.value })}
                    />
                  </Stack>
                </Paper>
              ))}

              {templateItems.length === 0 && (
                <Alert severity="info">
                  Add replacement items to define the template. Each item specifies an original food
                  and its replacement.
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={!templateName.trim() || templateItems.length === 0}
          >
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={applyDialogOpen} onClose={() => setApplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Apply Template: {applyingTemplate?.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Autocomplete
              multiple
              options={availablePlans}
              getOptionLabel={(option) => option.title}
              value={selectedPlans}
              onChange={(_, newValue) => setSelectedPlans(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Plans (optional)"
                  placeholder="Leave empty to apply to all plans"
                />
              )}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoMatchMacros}
                  onChange={(e) => setAutoMatchMacros(e.target.checked)}
                />
              }
              label="Auto-match macros"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialogOpen(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyTemplate}
            variant="contained"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Apply Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

