'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Stack } from '@mui/material';
import { Refresh, Delete, Add, Edit, UploadFile } from '@mui/icons-material';

interface ExerciseItem {
  id: string;
  name: string;
  notes?: string | null;
  category?: string | null;
  muscleGroup: string;
  equipmentNeeded?: string | null;
  videoUrl?: string | null;
  isActive?: boolean;
}

export default function DefaultExercisesPage() {
  const [items, setItems] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseItem | null>(null);
  const [form, setForm] = useState<Partial<ExerciseItem>>({ name: '', muscleGroup: '', category: '', equipmentNeeded: '', videoUrl: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadPreview, setUploadPreview] = useState<ExerciseItem[]>([]);
  const [uploadSkipped, setUploadSkipped] = useState<{ index: number; reason: string }[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/api/admin/default-exercises');
      const list = Array.isArray((data as any)?.exercises)
        ? (data as any).exercises
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : Array.isArray(data)
        ? (data as any)
        : [];
      setItems(list as ExerciseItem[]);
    } catch (e) {
      setError('Failed to fetch exercises');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = Array.isArray(items)
    ? items.filter((it) => it.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  const allFilteredSelected = filtered.length > 0 && filtered.every((it) => selectedIds.includes(it.id));
  const someFilteredSelected = filtered.some((it) => selectedIds.includes(it.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.find((it) => it.id === id)));
    } else {
      const filteredIds = filtered.map((it) => it.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const bulkDeleteSelected = async () => {
    try {
      setError(null);
      if (selectedIds.length === 0) return;
      await api.post('/api/admin/default-exercises/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete selected');
    }
  };

  const deleteAll = async () => {
    try {
      setError(null);
      await api.post('/api/admin/default-exercises/bulk-delete', { all: true });
      setSelectedIds([]);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete all');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', muscleGroup: '', category: '', equipmentNeeded: '', videoUrl: '' });
    setDialogOpen(true);
  };

  const openEdit = (it: ExerciseItem) => {
    setEditing(it);
    setForm({ ...it });
    setDialogOpen(true);
  };

  const saveItem = async () => {
    try {
      setError(null);
      if (!form.name || !form.muscleGroup) {
        setError('Name and muscle group are required');
        return;
      }
      if (editing) {
        await api.put(`/api/admin/default-exercises/${editing.id}`, form);
      } else {
        await api.post('/api/admin/default-exercises', form);
      }
      setDialogOpen(false);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save item');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      setError(null);
      await api.delete(`/api/admin/default-exercises/${id}`);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleUploadFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadError(null);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/admin/default-exercises/upload-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      setUploadPreview(items as ExerciseItem[]);
      setUploadSkipped(((data as any)?.skipped || []) as { index: number; reason: string }[]);
      setUploadDialogOpen(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to process file';
      setUploadError(msg);
    } finally {
      e.target.value = '';
    }
  };

  const updatePreviewRow = (index: number, patch: Partial<ExerciseItem>) => {
    setUploadPreview((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const submitBulkImport = async () => {
    try {
      setUploadError(null);
      if (uploadPreview.length === 0) {
        setUploadError('No rows to import');
        return;
      }
      await api.post('/api/admin/default-exercises/bulk-import', { items: uploadPreview });
      setUploadDialogOpen(false);
      setUploadPreview([]);
      setUploadSkipped([]);
      await fetchItems();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to import items';
      setUploadError(msg);
    }
  };

  const downloadSampleCsv = () => {
    const header = [
      'name',
      'muscle_group',
      'category',
      'notes',
      'equipment_needed',
      'video_url',
    ].join(',');
    const sampleRow = [
      'Push Up',
      'Chest',
      'Bodyweight',
      'Classic push up exercise',
      'None',
      'https://example.com/video',
    ].join(',');
    const csv = `${header}\n${sampleRow}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'base-exercises-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={800}>Base Exercises</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outlined" color="error" startIcon={<Delete />} disabled={selectedIds.length === 0} onClick={bulkDeleteSelected}>Delete Selected ({selectedIds.length})</Button>
        <Button variant="outlined" color="error" onClick={deleteAll}>Delete All</Button>
        <Button variant="outlined" onClick={clearSelection} disabled={selectedIds.length === 0}>Clear Selection</Button>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFile />}
        >
          Upload File
          <input hidden type="file" accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleUploadFileChange} />
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Exercise</Button>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchItems}>Refresh</Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {uploadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>{uploadError}</Alert>
      )}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Upload instructions
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                The CSV/XLSX file must have at least these columns:
                <strong> name</strong> (exercise name) and <strong> muscle_group</strong>.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Optional columns: <strong>category</strong>, <strong>notes</strong>, <strong>equipment_needed</strong>,
                and <strong>video_url</strong>. Each row represents one base exercise.
              </Typography>
              <Typography variant="body2">
                Smart reader: you can use friendly headers like <strong>Muscle Group</strong> or <strong>Primary Muscle</strong>;
                the system will automatically map them to the correct field.
              </Typography>
            </Box>
            <Button variant="outlined" size="small" onClick={downloadSampleCsv}>
              Download sample CSV
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <input
                      type="checkbox"
                      aria-label="select all"
                      checked={allFilteredSelected}
                      ref={(el) => { if (el) el.indeterminate = !allFilteredSelected && someFilteredSelected; }}
                      onChange={toggleSelectAllFiltered}
                    />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Muscle Group</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell>Video</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((it) => (
                  <TableRow key={it.id} hover>
                    <TableCell padding="checkbox">
                      <input type="checkbox" checked={selectedIds.includes(it.id)} onChange={() => toggleRow(it.id)} />
                    </TableCell>
                    <TableCell>{it.name}</TableCell>
                    <TableCell>{it.muscleGroup}</TableCell>
                    <TableCell>{it.category || '-'}</TableCell>
                    <TableCell>{it.equipmentNeeded || '-'}</TableCell>
                    <TableCell>{it.videoUrl ? 'Yes' : '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" aria-label="edit" onClick={() => openEdit(it)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" aria-label="delete" onClick={() => deleteItem(it.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Review Imported Exercises</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Required columns in the CSV/XLSX file are <strong>name</strong> and <strong>muscle_group</strong>.
            Optional columns: <strong>category</strong>, <strong>notes</strong>, <strong>equipment_needed</strong>, <strong>video_url</strong>.
            Each row represents a single base exercise.
          </Typography>
          {uploadSkipped.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {uploadSkipped.length} rows were skipped because they were missing required columns (name or muscle_group).
            </Alert>
          )}
          <Box sx={{ mt: 1, maxHeight: 400, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Muscle Group</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell>Video URL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadPreview.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.name}
                        onChange={(e) => updatePreviewRow(index, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.muscleGroup}
                        onChange={(e) => updatePreviewRow(index, { muscleGroup: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.category || ''}
                        onChange={(e) => updatePreviewRow(index, { category: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.equipmentNeeded || ''}
                        onChange={(e) => updatePreviewRow(index, { equipmentNeeded: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.videoUrl || ''}
                        onChange={(e) => updatePreviewRow(index, { videoUrl: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {uploadPreview.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No rows parsed from the file. Please check the columns and try again.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitBulkImport} disabled={uploadPreview.length === 0}>
            Import to Base Exercises
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Exercise' : 'Add Exercise'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Muscle Group" value={form.muscleGroup || ''} onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Category" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Equipment" value={form.equipmentNeeded || ''} onChange={(e) => setForm({ ...form, equipmentNeeded: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Video URL" value={form.videoUrl || ''} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} fullWidth />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveItem}>{editing ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


