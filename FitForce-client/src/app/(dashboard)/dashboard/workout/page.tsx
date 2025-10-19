'use client';

import { useState, useEffect, ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
import useSWR from 'swr';
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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// project-imports
import MainCard from 'components/MainCard';
import ResponsiveTable from '@/components/ResponsiveTable';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [activeTab, setActiveTab] = useState<'builder' | 'logs' | 'ca_day'>('builder');
  // CaDay catalog state
  const [caDays, setCaDays] = useState<Array<{ id: string; name: string; imageUrl?: string; url?: string; urls?: string[] }>>([]);
  const [loadingCaDays, setLoadingCaDays] = useState(false);
  const [isAddCaDayOpen, setIsAddCaDayOpen] = useState(false);
  const [newCaDay, setNewCaDay] = useState<{ name: string; imageUrl?: string; url?: string; urls?: string[] }>({ name: '' });
  const [uploadingCaDay, setUploadingCaDay] = useState(false);

  // Workout log details dialog state
  const [workoutLogDetailsOpen, setWorkoutLogDetailsOpen] = useState(false);
  const [selectedWorkoutLog, setSelectedWorkoutLog] = useState<any>(null);

  // Handler for opening workout log details
  const handleViewWorkoutLogDetails = (log: any) => {
    setSelectedWorkoutLog(log);
    setWorkoutLogDetailsOpen(true);
  };

  // Workspace-wide workout logs for Logs tab
  const { data: logsData, isLoading: logsLoading, mutate: refreshLogs } = useSWR(
    activeTab === 'logs' ? 'workspace-workout-logs' : null,
    async () => {
      const res = await api.get(`/api/workout/logs`);
      return res.data as { workoutLogs: any[] };
    }
  );

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
    // Load CaDays when tab switches to ca_day
    if (activeTab === 'ca_day') {
      (async () => {
        setLoadingCaDays(true);
        try {
          const res = await api.get('/api/workout/caday');
          setCaDays(res.data.caDays || []);
        } finally {
          setLoadingCaDays(false);
        }
      })();
    }
  }, [workspaceId, activeTab]);

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
      setError('Cannot delete exercise because it is used in workout plans. Remove it from plans first.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected exercise(s)?`)) return;
    try {
      await Promise.all(selected.map((id) => api.delete(`/api/workout/exercises/${id}`)));
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
      setSelected([]);
      setSelectedValue([]);
    } catch {
      setError('Some exercises could not be deleted because they are used in workout plans. Remove them from plans first.');
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

  // Search filtering
  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.nameArabic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      {/* Cover Image */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 200, sm: 250, md: 300 },
          borderRadius: 2,
          overflow: 'hidden',
          mb: 2
        }}
      >
        <img
          src="https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgnyvmff0002bsvhvv6hb607/template-assets/1760461859261-b2.jpeg"
          alt="Workout Cover"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center'
          }}
        />
        {/* Optional overlay for better text readability if needed */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3))',
            display: 'flex',
            alignItems: 'flex-end',
            p: 3
          }}
        >
          <Typography
            variant="h3"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            Exercise Library
          </Typography>
        </Box>
      </Box>

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
          {selected.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<Trash />} onClick={handleDeleteSelected}>
              Delete Selected ({selected.length})
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
            Add Exercise
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Tabs */}
      <Stack direction="row" spacing={1}>
        <Button variant={activeTab === 'builder' ? 'contained' : 'outlined'} size="small" onClick={() => setActiveTab('builder')}>Builder</Button>
        <Button variant={activeTab === 'ca_day' ? 'contained' : 'outlined'} size="small" onClick={() => setActiveTab('ca_day')}>ca_day</Button>
        <Button variant={activeTab === 'logs' ? 'contained' : 'outlined'} size="small" onClick={() => setActiveTab('logs')}>Logs</Button>
      </Stack>

      {/* Exercises Table */}
      {activeTab === 'builder' && (exercises.length === 0 ? (
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

          {/* Search Input */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search exercises by name, Arabic name, or muscle group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ maxWidth: 400 }}
            />
          </Box>

          {/* table */}
          {isMobile ? (
            // Mobile Cards View
            <Grid container spacing={2}>
              {stableSort(filteredExercises, getComparator(order, orderBy))
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row, index) => {
                  if (typeof row === 'number') return null;
                  const isItemSelected = isSelected(row.id);

                  return (
                    <Grid item xs={12} key={row.id}>
                      <Card 
                        sx={{ 
                          transition: 'all 0.2s',
                          border: isItemSelected ? '2px solid' : '1px solid',
                          borderColor: isItemSelected ? 'primary.main' : 'divider',
                          '&:hover': {
                            boxShadow: 4,
                            transform: 'translateY(-2px)'
                          }
                        }}
                        onClick={(event) => handleClick(event, row.id)}
                      >
                        <CardContent>
                          <Stack spacing={2}>
                            {/* Header with Checkbox and Name */}
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Checkbox 
                                color="primary" 
                                checked={isItemSelected} 
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6">
                                  {row.name}
                                </Typography>
                                {row.nameArabic && (
                                  <Typography variant="body2" color="text.secondary">
                                    {row.nameArabic}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>

                            <Divider />

                            {/* Exercise Details */}
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  Muscle Group
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip label={row.muscleGroup} variant="outlined" size="small" />
                                </Box>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  Created
                                </Typography>
                                <Typography variant="body2">
                                  {new Date(row.createdAt).toLocaleDateString()}
                                </Typography>
                              </Grid>
                            </Grid>

                            <Divider />

                            {/* Actions */}
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Edit size={16} />}
                                onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={deleting === row.id ? <CircularProgress size={16} /> : <Trash size={16} />}
                                onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                                disabled={deleting === row.id}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
            </Grid>
          ) : (
            // Desktop Table View
            <ResponsiveTable>
              <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle" size="medium">
                <EnhancedTableHead
                  numSelected={selected.length}
                  order={order}
                  orderBy={orderBy}
                  onSelectAllClick={handleSelectAllClick}
                  onRequestSort={handleRequestSort}
                  rowCount={filteredExercises.length}
                />
                <TableBody>
                  {stableSort(filteredExercises, getComparator(order, orderBy))
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
            </ResponsiveTable>
          )}
          <Divider />
          {/* table pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredExercises.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </MainCard>
      ))}

      {activeTab === 'logs' && (
        <MainCard title="Workout Logs" secondary={<Button variant="outlined" size="small" onClick={() => refreshLogs()}>Refresh</Button>}>
          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {Array.isArray(logsData?.workoutLogs) && logsData!.workoutLogs.length > 0 ? (
                <Stack spacing={1.5}>
                  {logsData!.workoutLogs.map((log: any) => (
                    <Card key={log.id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => handleViewWorkoutLogDetails(log)}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{log.workoutPlan?.title || 'Workout'}</Typography>
                              <Typography variant="caption" color="text.secondary">Day {Number(log.dayIndex) + 1}</Typography>
                            </Box>
                            <Chip label={log.completed ? 'Completed' : 'In Progress'} color={log.completed ? 'success' : 'warning'} size="small" />
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ color: 'text.secondary' }}>
                            <Typography variant="body2">{new Date(log.date).toLocaleDateString()}</Typography>
                            <Typography variant="body2">{log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : 'Not completed'}</Typography>
                            <Typography variant="body2">{Array.isArray(log.exercises) ? `${log.exercises.length} exercises` : '-'}</Typography>
                          </Stack>
                          {log.notes && (
                            <Typography variant="body2" sx={{ mt: 1 }}>{log.notes}</Typography>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No workout logs found</Typography>
              )}
            </>
          )}
        </MainCard>
      )}

      {activeTab === 'ca_day' && (
        <MainCard title="ca_day" secondary={<Button variant="contained" size="small" onClick={() => setIsAddCaDayOpen(true)}>Add</Button>}>
          {loadingCaDays ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {caDays.map((c) => (
                <Grid item xs={12} sm={6} md={4} key={c.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar src={c.imageUrl} variant="rounded" />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>{c.name}</Typography>
                          {c.url && (
                            <Typography variant="body2" color="primary" component="a" href={c.url} target="_blank" rel="noreferrer">
                              Open Link
                            </Typography>
                          )}
                          {c.urls && c.urls.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {c.urls.map((url, index) => (
                                <Typography key={index} variant="body2" color="primary" component="a" href={url} target="_blank" rel="noreferrer" sx={{ display: 'block', fontSize: '0.75rem' }}>
                                  Link {index + 1}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Box>
                        <IconButton color="error" onClick={async () => {
                          if (!confirm('Delete this ca_day item?')) return;
                          await api.delete(`/api/workout/caday/${c.id}`);
                          const res = await api.get('/api/workout/caday');
                          setCaDays(res.data.caDays || []);
                        }}>
                          <Trash />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
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

      {/* Add CaDay Dialog */}
      <Dialog open={isAddCaDayOpen} onClose={() => setIsAddCaDayOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add ca_day</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={newCaDay.name} onChange={(e) => setNewCaDay((p) => ({ ...p, name: e.target.value }))} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button component="label" variant="outlined" startIcon={uploadingCaDay ? <CircularProgress size={16} /> : <DocumentUpload />} disabled={uploadingCaDay}>
                {newCaDay.imageUrl ? 'Change Image' : 'Upload Image'}
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploadingCaDay(true);
                    const pres = await api.post('/api/upload/landing/presigned', {
                      workspaceId,
                      filename: file.name,
                      contentType: file.type || 'image/jpeg'
                    });
                    const { uploadUrl, publicUrl } = pres.data;
                    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
                    setNewCaDay((p) => ({ ...p, imageUrl: publicUrl }));
                  } finally {
                    setUploadingCaDay(false);
                    if (e.currentTarget) e.currentTarget.value = '';
                  }
                }} />
              </Button>
              {newCaDay.imageUrl && (
                <Avatar src={newCaDay.imageUrl} variant="rounded" sx={{ width: 56, height: 56 }} />
              )}
            </Stack>
            <TextField label="Single URL (Legacy)" value={newCaDay.url || ''} onChange={(e) => setNewCaDay((p) => ({ ...p, url: e.target.value }))} fullWidth />
            
            {/* Multiple URLs Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Multiple URLs
              </Typography>
              <Stack spacing={1}>
                {(newCaDay.urls || []).map((url: string, index: number) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      label={`URL ${index + 1}`}
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...(newCaDay.urls || [])];
                        newUrls[index] = e.target.value;
                        setNewCaDay((p) => ({ ...p, urls: newUrls }));
                      }}
                    />
                    <IconButton
                      color="error"
                      onClick={() => {
                        const newUrls = [...(newCaDay.urls || [])];
                        newUrls.splice(index, 1);
                        setNewCaDay((p) => ({ ...p, urls: newUrls }));
                      }}
                    >
                      <Trash size={16} />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  variant="outlined"
                  startIcon={<Add size={16} />}
                  onClick={() => {
                    const currentUrls = newCaDay.urls || [];
                    setNewCaDay((p) => ({ ...p, urls: [...currentUrls, ''] }));
                  }}
                >
                  Add URL
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddCaDayOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            if (!newCaDay.name.trim()) return;
            await api.post('/api/workout/caday', newCaDay);
            setIsAddCaDayOpen(false);
            setNewCaDay({ name: '', urls: [] });
            const res = await api.get('/api/workout/caday');
            setCaDays(res.data.caDays || []);
          }}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Workout Log Details Dialog */}
      <Dialog
        open={workoutLogDetailsOpen}
        onClose={() => setWorkoutLogDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Workout Details
        </DialogTitle>
        <DialogContent>
          {selectedWorkoutLog && (
            <Stack spacing={3}>
              {/* Basic Info */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Workout Information
                </Typography>
                <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Client
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1">
                        {selectedWorkoutLog.client?.fullName || 'Unknown Client'}
                      </Typography>
                      {selectedWorkoutLog.client?.code && (
                        <Chip 
                          label={`#${selectedWorkoutLog.client.code}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Workout Plan
                    </Typography>
                    <Typography variant="body1">
                      {selectedWorkoutLog.workoutPlan?.title || 'Workout'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Day
                    </Typography>
                    <Typography variant="body1">
                      Day {Number(selectedWorkoutLog.dayIndex) + 1}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Date
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedWorkoutLog.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedWorkoutLog.completed ? 'Completed' : 'In Progress'}
                      color={selectedWorkoutLog.completed ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                </Stack>
                
                {selectedWorkoutLog.startTime && selectedWorkoutLog.endTime && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {selectedWorkoutLog.startTime} - {selectedWorkoutLog.endTime}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Exercises */}
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Exercises ({selectedWorkoutLog.exercises?.length || 0})
                </Typography>
                <Stack spacing={2}>
                  {selectedWorkoutLog.exercises?.map((exercise: any, index: number) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {exercise.exerciseName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Target: {exercise.targetSets} sets x {exercise.targetReps} reps
                          {exercise.targetWeight && ` @ ${exercise.targetWeight}kg`}
                        </Typography>
                        
                        {/* Sets */}
                        <Stack spacing={1}>
                          {exercise.sets?.map((set: any, setIndex: number) => (
                            <Box key={setIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ minWidth: '60px' }}>
                                Set {setIndex + 1}:
                              </Typography>
                              {set.reps && (
                                <Chip label={`${set.reps} reps`} size="small" variant="outlined" />
                              )}
                              {set.weight && (
                                <Chip label={`${set.weight}kg`} size="small" variant="outlined" />
                              )}
                              {set.restTime && (
                                <Chip label={`${set.restTime}s rest`} size="small" variant="outlined" />
                              )}
                              {set.completed && (
                                <Chip label="Completed" size="small" color="success" />
                              )}
                              {set.completedAt && (
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(set.completedAt).toLocaleTimeString()}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                        
                        {exercise.notes && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            Notes: {exercise.notes}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>

              {/* General Notes */}
              {selectedWorkoutLog.notes && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    General Notes
                  </Typography>
                  <Typography variant="body2">
                    {selectedWorkoutLog.notes}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkoutLogDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
