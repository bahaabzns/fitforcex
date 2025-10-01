'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Grid } from '@mui/material';
import { Refresh, Delete, Add, Edit } from '@mui/icons-material';

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

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={800}>Base Exercises</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Exercise</Button>
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


