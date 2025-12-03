'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Stack } from '@mui/material';
import { Refresh, Delete, Add, Edit, UploadFile } from '@mui/icons-material';

interface FoodItem {
  id: string;
  name: string;
  nameArabic?: string | null;
  category?: string | null;
  servingSize?: number | null;
  unit?: string | null;
  unitArabic?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isActive?: boolean;
  // Micronutrients
  water?: number | null;
  ash?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  calcium?: number | null;
  phosphorous?: number | null;
  magnesium?: number | null;
  iron?: number | null;
  zinc?: number | null;
  copper?: number | null;
  manganese?: number | null;
  fluoride?: number | null;
  selenium?: number | null;
  vitamin_a?: number | null;
  vitamin_c?: number | null;
  vitamin_b1?: number | null;
  vitamin_b2?: number | null;
  vitamin_b5?: number | null;
  vitamin_b6?: number | null;
  vitamin_b12?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;
  niacin?: number | null;
  folic_acid?: number | null;
  choline?: number | null;
  betaine?: number | null;
}

export default function DefaultFoodItemsPage() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<Partial<FoodItem>>({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, category: '', servingSize: undefined, unit: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMicros, setShowMicros] = useState<boolean>(false);
  const [uploadPreview, setUploadPreview] = useState<FoodItem[]>([]);
  const [uploadSkipped, setUploadSkipped] = useState<{ index: number; reason: string }[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/api/admin/default-food-items');
      const list = Array.isArray((data as any)?.foodItems)
        ? (data as any).foodItems
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : Array.isArray(data)
        ? (data as any)
        : [];
      setItems(list as FoodItem[]);
    } catch (e) {
      setError('Failed to fetch food items');
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
      // unselect all filtered
      setSelectedIds((prev) => prev.filter((id) => !filtered.find((it) => it.id === id)));
    } else {
      // select all filtered
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
      await api.post('/api/admin/default-food-items/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete selected');
    }
  };

  const deleteAll = async () => {
    try {
      setError(null);
      await api.post('/api/admin/default-food-items/bulk-delete', { all: true });
      setSelectedIds([]);
      await fetchItems();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete all');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, category: '', servingSize: undefined, unit: '' });
    setDialogOpen(true);
  };

  const openEdit = (it: FoodItem) => {
    setEditing(it);
    setForm({ ...it });
    setDialogOpen(true);
  };

  const saveItem = async () => {
    try {
      setError(null);
      if (!form.name || typeof form.calories !== 'number') {
        setError('Name and calories are required');
        return;
      }
      if (editing) {
        await api.put(`/api/admin/default-food-items/${editing.id}`, form);
      } else {
        await api.post('/api/admin/default-food-items', form);
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
      await api.delete(`/api/admin/default-food-items/${id}`);
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
      const { data } = await api.post('/api/admin/default-food-items/upload-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      setUploadPreview(items as FoodItem[]);
      setUploadSkipped(((data as any)?.skipped || []) as { index: number; reason: string }[]);
      setUploadDialogOpen(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to process file';
      setUploadError(msg);
    } finally {
      e.target.value = '';
    }
  };

  const updatePreviewRow = (index: number, patch: Partial<FoodItem>) => {
    setUploadPreview((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const submitBulkImport = async () => {
    try {
      setUploadError(null);
      if (uploadPreview.length === 0) {
        setUploadError('No rows to import');
        return;
      }
      await api.post('/api/admin/default-food-items/bulk-import', { items: uploadPreview });
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
      'name_arabic',
      'category',
      'serving_size',
      'unit',
      'calories',
      'protein',
      'carbs',
      'fat',
    ].join(',');
    const sampleRow = [
      'Apple',
      'تفاح',
      'Fruit',
      '100',
      'g',
      '52',
      '0.3',
      '14',
      '0.2',
    ].join(',');
    const csv = `${header}\n${sampleRow}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'base-food-items-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight={800}>Base Food Items</Typography>
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
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Item</Button>
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
                <strong> name</strong> (English name) and <strong> calories</strong>.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Optional columns: <strong>category</strong>, <strong>serving_size</strong>, <strong>unit</strong>,
                <strong> protein</strong>, <strong> carbs</strong>, <strong> fat</strong>, and micronutrients like
                <strong> water</strong>, <strong> fiber</strong>, <strong> vitamins</strong>, and <strong> minerals</strong>.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                For Arabic names, you can add a column called <strong>name_arabic</strong>, <strong>arabic_name</strong>,
                or <strong>name_ar</strong>. The system will automatically detect and save it to the Arabic name field.
              </Typography>
              <Typography variant="body2">
                Smart reader: if you use columns like <strong>Name EN</strong> and <strong>Name AR</strong>, the system will
                map English to the main name and Arabic to the Arabic name automatically. Each row represents one base food item.
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
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Calories</TableCell>
                  <TableCell align="right">Protein</TableCell>
                  <TableCell align="right">Carbs</TableCell>
                  <TableCell align="right">Fat</TableCell>
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
                    <TableCell>{it.category || '-'}</TableCell>
                    <TableCell align="right">{it.calories}</TableCell>
                    <TableCell align="right">{it.protein}</TableCell>
                    <TableCell align="right">{it.carbs}</TableCell>
                    <TableCell align="right">{it.fat}</TableCell>
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
        <DialogTitle>Review Imported Food Items</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Required columns in the CSV/XLSX file are <strong>name</strong> and <strong>calories</strong>.
            Optional columns: <strong>category</strong>, <strong>serving_size</strong>, <strong>unit</strong>,
            <strong>protein</strong>, <strong>carbs</strong>, <strong>fat</strong>, and the various micronutrients
            (water, fiber, vitamins, minerals, etc.). Each row represents a single base food item.
          </Typography>
          {uploadSkipped.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {uploadSkipped.length} rows were skipped because they were missing required columns (name or calories).
            </Alert>
          )}
          <Box sx={{ mt: 1, maxHeight: 400, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Name (EN)</TableCell>
                  <TableCell>Name (AR)</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Calories</TableCell>
                  <TableCell align="right">Protein</TableCell>
                  <TableCell align="right">Carbs</TableCell>
                  <TableCell align="right">Fat</TableCell>
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
                        value={row.nameArabic || ''}
                        onChange={(e) => updatePreviewRow(index, { nameArabic: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.category || ''}
                        onChange={(e) => updatePreviewRow(index, { category: e.target.value })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.calories}
                        onChange={(e) => updatePreviewRow(index, { calories: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.protein}
                        onChange={(e) => updatePreviewRow(index, { protein: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.carbs}
                        onChange={(e) => updatePreviewRow(index, { carbs: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.fat}
                        onChange={(e) => updatePreviewRow(index, { fat: Number(e.target.value) })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {uploadPreview.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
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
            Import to Base Food Items
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Food Item' : 'Add Food Item'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField label="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Category" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Calories" type="number" value={form.calories as number} onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Protein" type="number" value={form.protein as number} onChange={(e) => setForm({ ...form, protein: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Carbs" type="number" value={form.carbs as number} onChange={(e) => setForm({ ...form, carbs: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Fat" type="number" value={form.fat as number} onChange={(e) => setForm({ ...form, fat: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Serving Size" type="number" value={(form.servingSize as number) || 0} onChange={(e) => setForm({ ...form, servingSize: Number(e.target.value) })} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Unit" value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <Button size="small" onClick={() => setShowMicros((v) => !v)}>{showMicros ? 'Hide Micronutrients' : 'Show Micronutrients'}</Button>
            </Grid>
            {showMicros && (
              <>
                <Grid item xs={12} md={4}>
                  <TextField label="Water" type="number" value={(form.water as number) ?? ''} onChange={(e) => setForm({ ...form, water: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Fiber" type="number" value={(form.fiber as number) ?? ''} onChange={(e) => setForm({ ...form, fiber: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Sodium" type="number" value={(form.sodium as number) ?? ''} onChange={(e) => setForm({ ...form, sodium: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Potassium" type="number" value={(form.potassium as number) ?? ''} onChange={(e) => setForm({ ...form, potassium: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Calcium" type="number" value={(form.calcium as number) ?? ''} onChange={(e) => setForm({ ...form, calcium: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Phosphorous" type="number" value={(form.phosphorous as number) ?? ''} onChange={(e) => setForm({ ...form, phosphorous: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Magnesium" type="number" value={(form.magnesium as number) ?? ''} onChange={(e) => setForm({ ...form, magnesium: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Iron" type="number" value={(form.iron as number) ?? ''} onChange={(e) => setForm({ ...form, iron: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Zinc" type="number" value={(form.zinc as number) ?? ''} onChange={(e) => setForm({ ...form, zinc: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Copper" type="number" value={(form.copper as number) ?? ''} onChange={(e) => setForm({ ...form, copper: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Manganese" type="number" value={(form.manganese as number) ?? ''} onChange={(e) => setForm({ ...form, manganese: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Fluoride" type="number" value={(form.fluoride as number) ?? ''} onChange={(e) => setForm({ ...form, fluoride: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Selenium" type="number" value={(form.selenium as number) ?? ''} onChange={(e) => setForm({ ...form, selenium: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit A" type="number" value={(form.vitamin_a as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_a: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit C" type="number" value={(form.vitamin_c as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_c: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit B1" type="number" value={(form.vitamin_b1 as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_b1: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit B2" type="number" value={(form.vitamin_b2 as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_b2: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit B5" type="number" value={(form.vitamin_b5 as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_b5: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit B6" type="number" value={(form.vitamin_b6 as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_b6: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit B12" type="number" value={(form.vitamin_b12 as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_b12: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit D" type="number" value={(form.vitamin_d as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_d: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit E" type="number" value={(form.vitamin_e as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_e: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Vit K" type="number" value={(form.vitamin_k as number) ?? ''} onChange={(e) => setForm({ ...form, vitamin_k: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Niacin" type="number" value={(form.niacin as number) ?? ''} onChange={(e) => setForm({ ...form, niacin: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Folic Acid" type="number" value={(form.folic_acid as number) ?? ''} onChange={(e) => setForm({ ...form, folic_acid: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Choline" type="number" value={(form.choline as number) ?? ''} onChange={(e) => setForm({ ...form, choline: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Betaine" type="number" value={(form.betaine as number) ?? ''} onChange={(e) => setForm({ ...form, betaine: e.target.value === '' ? null : Number(e.target.value) })} fullWidth />
                </Grid>
              </>
            )}
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


