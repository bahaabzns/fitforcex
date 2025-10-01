'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Refresh, Delete, Add, Edit } from '@mui/icons-material';

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
}

export default function DefaultFoodItemsPage() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<Partial<FoodItem>>({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0, category: '', servingSize: undefined, unit: '' });

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

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Base Food Items</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Item</Button>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchItems}>Refresh</Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
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


