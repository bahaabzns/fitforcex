'use client';

import { useState, useEffect, ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';

// MUI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableSortLabel from '@mui/material/TableSortLabel';
import TableRow from '@mui/material/TableRow';
import { visuallyHidden } from '@mui/utils';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';

// project-imports
import MainCard from 'components/MainCard';
import { CSVExport, RowSelection } from 'components/third-party/react-table';

// Icons
import { Add, Edit, Trash, DocumentUpload, Warning2 } from '@wandersonalwes/iconsax-react';

// types
import { KeyedObject } from 'types/root';

type ArrangementOrder = 'asc' | 'desc';

interface EnhancedTableHeadProps {
  onSelectAllClick: (event: ChangeEvent<HTMLInputElement>) => void;
  order: ArrangementOrder;
  orderBy: string;
  numSelected: number;
  rowCount: number;
  onRequestSort: (event: SyntheticEvent, property: string) => void;
}

interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  createdAt: string;
  updatedAt: string;
}

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body'
];

// table filter
function descendingComparator(a: KeyedObject, b: KeyedObject, orderBy: string) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order: ArrangementOrder, orderBy: string) {
  return order === 'desc'
    ? (a: KeyedObject, b: KeyedObject) => descendingComparator(a, b, orderBy)
    : (a: KeyedObject, b: KeyedObject) => -descendingComparator(a, b, orderBy);
}

function stableSort(array: Exercise[], comparator: (a: KeyedObject, b: KeyedObject) => number) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0] as Exercise, b[0] as Exercise);
    if (order !== 0) return order;
    return (a[1] as number) - (b[1] as number);
  });
  return stabilizedThis.map((el) => el[0]);
}

// table header
const headCells = [
  {
    id: 'name',
    numeric: false,
    disablePadding: true,
    label: 'Exercise Name'
  },
  {
    id: 'muscleGroup',
    numeric: false,
    disablePadding: false,
    label: 'Muscle Group'
  },
  {
    id: 'createdAt',
    numeric: false,
    disablePadding: false,
    label: 'Created'
  },
  {
    id: 'actions',
    numeric: false,
    disablePadding: false,
    label: 'Actions'
  }
];

function EnhancedTableHead({ onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort }: EnhancedTableHeadProps) {
  const createSortHandler = (property: string) => (event: SyntheticEvent) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        <TableCell padding="checkbox" sx={{ pl: 3 }}>
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            slotProps={{ input: { 'aria-label': 'select all exercises' } }}
          />
        </TableCell>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? 'right' : 'left'}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            sortDirection={orderBy === headCell.id ? order : undefined}
          >
            {headCell.id === 'actions' ? (
              headCell.label
            ) : (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
              >
                {headCell.label}
                {orderBy === headCell.id ? (
                  <Box sx={visuallyHidden}>{order === 'desc' ? 'sorted descending' : 'sorted ascending'}</Box>
                ) : null}
              </TableSortLabel>
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

export default function WorkoutPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table states
  const [order, setOrder] = useState<ArrangementOrder>('asc');
  const [orderBy, setOrderBy] = useState('name');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedValue, setSelectedValue] = useState<Exercise[]>([]);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Form states
  const [newExercise, setNewExercise] = useState({
    name: '',
    nameArabic: '',
    muscleGroup: ''
  });

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Import states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [defaultItems, setDefaultItems] = useState<Exercise[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetchExercises = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/api/workout/exercises');
        setExercises(response.data.exercises || []);
      } catch {
        setError('Failed to load exercises');
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, [workspaceId]);

  const handleCreate = async () => {
    if (!newExercise.name.trim() || !newExercise.muscleGroup) {
      setError('Please provide a name and muscle group');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await api.post('/api/workout/exercises', newExercise);
      setIsCreateDialogOpen(false);
      setNewExercise({ name: '', nameArabic: '', muscleGroup: '' });
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to create exercise');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedExercise) return;
    if (!selectedExercise.name.trim() || !selectedExercise.muscleGroup) {
      setError('Please provide a name and muscle group');
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      await api.put(`/api/workout/exercises/${selectedExercise.id}`, selectedExercise);
      setIsEditDialogOpen(false);
      setSelectedExercise(null);
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to update exercise');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return;

    setDeleting(id);
    setError(null);
    try {
      await api.delete(`/api/workout/exercises/${id}`);
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to delete exercise');
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all exercises?')) return;

    try {
      await api.delete('/api/workout/exercises/clear-all');
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to clear exercises');
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setSelectedExercise({ ...exercise });
    setIsEditDialogOpen(true);
  };

  // Table handlers
  const handleRequestSort = (event: SyntheticEvent, property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelectedId: string[] = exercises.map((n) => n.id);
      setSelected(newSelectedId);
      setSelectedValue(exercises);
      return;
    }
    setSelected([]);
    setSelectedValue([]);
  };

  const handleClick = (event: MouseEvent<HTMLTableRowElement> | undefined, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1));
    }
    const selectedRowData: Exercise[] = exercises.filter((row) => newSelected.includes(row.id));
    setSelectedValue(selectedRowData);
    setSelected(newSelected);
  };

  const handleChangePage = (event: MouseEvent<HTMLElement> | MouseEvent<HTMLButtonElement, MouseEvent> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | undefined) => {
    setRowsPerPage(parseInt(event?.target.value || '0', 10));
    setPage(0);
  };

  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  // Import handlers
  const handleOpenImport = async () => {
    setIsImportDialogOpen(true);
    setLoadingDefaults(true);
    setError(null);
    try {
      const response = await api.get('/api/workout/exercises/defaults');
      setDefaultItems(response.data.exercises || []);
    } catch {
      setError('Failed to load default exercises');
    } finally {
      setLoadingDefaults(false);
    }
  };

  const handleSelectImportItem = (itemName: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const handleSelectAllImport = () => {
    if (selectedItems.size === defaultItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(defaultItems.map(item => item.name)));
    }
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to import');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const itemsToImport = defaultItems.filter(item => selectedItems.has(item.name));
      await api.post('/api/workout/exercises/import-selected', { items: itemsToImport });
      setIsImportDialogOpen(false);
      setSelectedItems(new Set());
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to import exercises');
    } finally {
      setImporting(false);
    }
  };

  if (!workspaceId) {
    return (
      <MainCard sx={{ borderStyle: 'dashed' }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6">Select a workspace</Typography>
          <Typography color="text.secondary">Open a workspace subdomain to manage workouts.</Typography>
        </Box>
      </MainCard>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading exercises...</Typography>
        </Stack>
      </Box>
    );
  }

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - exercises.length) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Workouts
          </Typography>
          <Typography color="text.secondary">Manage exercises and workout plans</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={<DocumentUpload />} onClick={handleOpenImport}>
            Import Exercises
          </Button>
          {exercises.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<Warning2 />} onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
            Add Exercise
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Exercises Table */}
      {exercises.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography variant="h6" gutterBottom>
              No Exercises
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Add exercises to start building workout plans for your clients
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" startIcon={<DocumentUpload />} onClick={handleOpenImport}>
                Import Default Exercises
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
                Add First Exercise
              </Button>
            </Stack>
          </Box>
        </MainCard>
      ) : (
        <MainCard
          content={false}
          title="Exercises"
          secondary={<CSVExport data={selectedValue.length > 0 ? selectedValue : exercises} filename={'exercises.csv'} />}
        >
          <RowSelection selected={selected.length} />

          {/* table */}
          <TableContainer>
            <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle" size="medium">
              <EnhancedTableHead
                numSelected={selected.length}
                order={order}
                orderBy={orderBy}
                onSelectAllClick={handleSelectAllClick}
                onRequestSort={handleRequestSort}
                rowCount={exercises.length}
              />
              <TableBody>
                {stableSort(exercises, getComparator(order, orderBy))
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, index) => {
                    if (typeof row === 'number') return null;
                    const isItemSelected = isSelected(row.id);
                    const labelId = `enhanced-table-checkbox-${index}`;

                    return (
                      <TableRow
                        hover
                        onClick={(event) => handleClick(event, row.id)}
                        role="checkbox"
                        aria-checked={isItemSelected}
                        tabIndex={-1}
                        key={row.id}
                        selected={isItemSelected}
                      >
                        <TableCell sx={{ pl: 3 }} padding="checkbox">
                          <Checkbox color="primary" checked={isItemSelected} slotProps={{ input: { 'aria-labelledby': labelId } }} />
                        </TableCell>
                        <TableCell component="th" id={labelId} scope="row" padding="none">
                          {row.name}
                        </TableCell>
                        <TableCell>
                          <Chip label={row.muscleGroup} variant="outlined" size="small" />
                        </TableCell>
                        <TableCell>
                          {new Date(row.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}>
                              <Edit size={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                              disabled={deleting === row.id}
                            >
                              {deleting === row.id ? <CircularProgress size={16} /> : <Trash size={16} />}
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {emptyRows > 0 && (
                  <TableRow sx={{ height: 53 * emptyRows }}>
                    <TableCell colSpan={5} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider />
          {/* table pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={exercises.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </MainCard>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Exercise</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Create a new exercise with muscle group information
          </Typography>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Exercise Name"
              value={newExercise.name}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Push-ups"
            />
            <TextField
              fullWidth
              label="Exercise Name (Arabic)"
              value={newExercise.nameArabic}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, nameArabic: e.target.value }))}
              placeholder="مثال: تمرين الضغط"
            />
            <FormControl fullWidth>
              <InputLabel>Muscle Group</InputLabel>
              <Select
                value={newExercise.muscleGroup}
                label="Muscle Group"
                onChange={(e) => setNewExercise((prev) => ({ ...prev, muscleGroup: e.target.value }))}
              >
                {MUSCLE_GROUPS.map((group) => (
                  <MenuItem key={group} value={group}>
                    {group}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <Add />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Exercise</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Update the exercise information
          </Typography>
          {selectedExercise && (
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Exercise Name"
                value={selectedExercise.name}
                onChange={(e) => setSelectedExercise((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                placeholder="e.g., Push-ups"
              />
              <TextField
                fullWidth
                label="Exercise Name (Arabic)"
                value={(selectedExercise as any).nameArabic || ''}
                onChange={(e) => setSelectedExercise((prev) => (prev ? ({ ...prev, nameArabic: e.target.value } as any) : null))}
                placeholder="مثال: تمرين الضغط"
              />
              <FormControl fullWidth>
                <InputLabel>Muscle Group</InputLabel>
                <Select
                  value={selectedExercise.muscleGroup}
                  label="Muscle Group"
                  onChange={(e) => setSelectedExercise((prev) => (prev ? { ...prev, muscleGroup: e.target.value } : null))}
                >
                  {MUSCLE_GROUPS.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={updating}
            startIcon={updating ? <CircularProgress size={16} /> : <Edit />}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Import Exercises</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Select exercises to add to your workspace
          </Typography>
          
          {loadingDefaults ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress />
                <Typography color="text.secondary">Loading default exercises...</Typography>
              </Stack>
            </Box>
          ) : (
            <>
              {/* Selection Controls */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.size} of {defaultItems.length} selected
                </Typography>
                <Button variant="outlined" size="small" onClick={handleSelectAllImport}>
                  {selectedItems.size === defaultItems.length ? 'Deselect All' : `Select All (${defaultItems.length})`}
                </Button>
              </Stack>

              {/* Exercises Grid */}
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                <Stack spacing={2}>
                  {defaultItems.map((item) => {
                    const isSelected = selectedItems.has(item.name);
                    return (
                      <Box
                        key={item.name}
                        sx={{
                          p: 2,
                          border: 1,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: isSelected ? 'primary.lighter' : 'action.hover' }
                        }}
                        onClick={() => handleSelectImportItem(item.name)}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {item.name}
                            </Typography>
                            <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                              <Chip label={item.muscleGroup} variant="outlined" size="small" />
                            </Stack>
                          </Box>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              border: 2,
                              borderColor: isSelected ? 'primary.main' : 'text.secondary',
                              bgcolor: isSelected ? 'primary.main' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {isSelected && (
                              <Typography variant="body2" color="primary.contrastText" sx={{ fontSize: 14 }}>
                                ✓
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={selectedItems.size === 0 || importing}
            startIcon={importing ? <CircularProgress size={16} /> : <DocumentUpload />}
          >
            Import Selected ({selectedItems.size})
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
