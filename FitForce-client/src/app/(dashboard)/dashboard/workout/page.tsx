'use client';

import { useState, useEffect, ChangeEvent, MouseEvent, SyntheticEvent, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import InputAdornment from '@mui/material/InputAdornment';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// project-imports
import MainCard from 'components/MainCard';
import WorkspaceSubscriptionGuard from '@/components/WorkspaceSubscriptionGuard';
import ResponsiveTable from '@/components/ResponsiveTable';
import { RowSelection } from 'components/third-party/react-table';
import { openSnackbar } from '@/api/snackbar';

// Icons
import { Add, Edit, Trash, DocumentUpload, Warning2, SearchNormal1 } from '@wandersonalwes/iconsax-react';

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
  nameArabic?: string;
  gifImage?: string;
  videoUrl?: string;
  instructions?: any;
  notes?: string;
  category?: string;
  equipmentNeeded?: string;
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
    id: 'gif',
    numeric: false,
    disablePadding: false,
    label: 'GIF'
  },
  {
    id: 'name',
    numeric: false,
    disablePadding: true,
    label: 'workout.col.name'
  },
  {
    id: 'muscleGroup',
    numeric: false,
    disablePadding: false,
    label: 'workout.col.muscleGroup'
  },
  {
    id: 'createdAt',
    numeric: false,
    disablePadding: false,
    label: 'workout.col.created'
  },
  {
    id: 'actions',
    numeric: false,
    disablePadding: false,
    label: 'actions'
  }
];

function EnhancedTableHead({ onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort }: EnhancedTableHeadProps) {
  const intl = useIntl();
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
              <FormattedMessage id={headCell.label} defaultMessage="Actions" />
            ) : (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
              >
                {intl.formatMessage({ id: headCell.label, defaultMessage: headCell.label })}
                {orderBy === headCell.id ? (
                  <Box sx={visuallyHidden}>{order === 'desc' ? intl.formatMessage({ id: 'sorted.desc', defaultMessage: 'sorted descending' }) : intl.formatMessage({ id: 'sorted.asc', defaultMessage: 'sorted ascending' })}</Box>
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
  const intl = useIntl();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');

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

  // Image preview dialog
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);

  // Form states
  const [newExercise, setNewExercise] = useState({
    name: '',
    nameArabic: '',
    muscleGroup: '',
    gifImage: '',
    videoUrl: '',
    instructions: '',
    notes: '',
    category: '',
    equipmentNeeded: ''
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
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'builder' | 'logs' | 'ca_day'>('builder');
  // Pagination for import dialog
  const [importPage, setImportPage] = useState(0);
  const [importRowsPerPage, setImportRowsPerPage] = useState(20);
  // Filters for main search
  const [searchEquipmentFilter, setSearchEquipmentFilter] = useState<string>('all');
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<string>('all');
  const [searchMuscleGroupFilter, setSearchMuscleGroupFilter] = useState<string>('all');
  // Equipment and category options (with "Other" support)
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [newEquipmentValue, setNewEquipmentValue] = useState('');
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [equipmentIsOther, setEquipmentIsOther] = useState(false);
  const [categoryIsOther, setCategoryIsOther] = useState(false);
  // Edit dialog "Other" states
  const [editEquipmentIsOther, setEditEquipmentIsOther] = useState(false);
  const [editCategoryIsOther, setEditCategoryIsOther] = useState(false);
  const [editNewEquipmentValue, setEditNewEquipmentValue] = useState('');
  const [editNewCategoryValue, setEditNewCategoryValue] = useState('');
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
  
  // Always show exercises (builder tab is hidden but content is always visible)

  // Extract unique equipment and category options from exercises
  useEffect(() => {
    const equipmentSet = new Set<string>();
    const categorySet = new Set<string>();
    exercises.forEach(ex => {
      if (ex.equipmentNeeded) equipmentSet.add(ex.equipmentNeeded);
      if (ex.category) categorySet.add(ex.category);
    });
    setEquipmentOptions(Array.from(equipmentSet).sort());
    setCategoryOptions(Array.from(categorySet).sort());
  }, [exercises]);

  const handleCreate = async () => {
    if (!newExercise.name.trim() || !newExercise.muscleGroup) {
      setError('Please provide a name and muscle group');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const exerciseToCreate = {
        ...newExercise,
        equipmentNeeded: equipmentIsOther ? newEquipmentValue : newExercise.equipmentNeeded,
        category: categoryIsOther ? newCategoryValue : newExercise.category
      };
      await api.post('/api/workout/exercises', exerciseToCreate);
      setIsCreateDialogOpen(false);
      setNewExercise({ name: '', nameArabic: '', muscleGroup: '', gifImage: '', videoUrl: '', instructions: '', notes: '', category: '', equipmentNeeded: '' });
      setNewEquipmentValue('');
      setNewCategoryValue('');
      setEquipmentIsOther(false);
      setCategoryIsOther(false);
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
      const exerciseToUpdate = {
        ...selectedExercise,
        equipmentNeeded: editEquipmentIsOther ? editNewEquipmentValue : (selectedExercise as any).equipmentNeeded,
        category: editCategoryIsOther ? editNewCategoryValue : (selectedExercise as any).category
      };
      await api.put(`/api/workout/exercises/${selectedExercise.id}`, exerciseToUpdate);
      setIsEditDialogOpen(false);
      setSelectedExercise(null);
      setEditEquipmentIsOther(false);
      setEditCategoryIsOther(false);
      setEditNewEquipmentValue('');
      setEditNewCategoryValue('');
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
    const exercise = exercises.find(e => e.id === id);
    const exerciseName = exercise?.name || 'this exercise';
    if (!confirm(`Are you sure you want to delete "${exerciseName}"? The exercise will be hidden but can be restored if needed.`)) return;

    setDeleting(id);
    setError(null);
    try {
      await api.delete(`/api/workout/exercises/${id}`);
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
      openSnackbar({
        open: true,
        message: `Exercise "${exerciseName}" has been deleted successfully`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Cannot delete exercise because it is used in workout plans. Remove it from plans first.';
      setError(errorMessage);
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected exercise(s)? They will be hidden but can be restored if needed.`)) return;
    setDeleting('multiple');
    setError(null);
    try {
      await Promise.all(selected.map((id) => api.delete(`/api/workout/exercises/${id}`)));
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
      setSelected([]);
      setSelectedValue([]);
      openSnackbar({
        open: true,
        message: `${selected.length} exercise(s) deleted successfully`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' }
      } as any);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Some exercises could not be deleted because they are used in workout plans. Remove them from plans first.';
      setError(errorMessage);
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' }
      } as any);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setSelectedExercise({ ...exercise });
    // Check if category/equipment are in options, if not, set as "Other"
    const ex = exercise as any;
    const hasCategoryInOptions = ex.category && categoryOptions.includes(ex.category);
    const hasEquipmentInOptions = ex.equipmentNeeded && equipmentOptions.includes(ex.equipmentNeeded);
    setEditCategoryIsOther(!hasCategoryInOptions && !!ex.category);
    setEditEquipmentIsOther(!hasEquipmentInOptions && !!ex.equipmentNeeded);
    setEditNewCategoryValue(!hasCategoryInOptions && ex.category ? ex.category : '');
    setEditNewEquipmentValue(!hasEquipmentInOptions && ex.equipmentNeeded ? ex.equipmentNeeded : '');
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

  // Search filtering with equipment, category, and muscle group filters
  const filteredExercises = exercises.filter((exercise) => {
    // Text search
    const matchesSearch = !searchTerm.trim() || 
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.nameArabic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Equipment filter
    const matchesEquipment = searchEquipmentFilter === 'all' || 
      exercise.equipmentNeeded === searchEquipmentFilter;
    
    // Category filter
    const matchesCategory = searchCategoryFilter === 'all' || 
      exercise.category === searchCategoryFilter;
    
    // Muscle group filter
    const matchesMuscleGroup = searchMuscleGroupFilter === 'all' || 
      exercise.muscleGroup === searchMuscleGroupFilter;
    
    return matchesSearch && matchesEquipment && matchesCategory && matchesMuscleGroup;
  });

  // Import handlers
  const handleOpenImport = async () => {
    setIsImportDialogOpen(true);
    setLoadingDefaults(true);
    setError(null);
    resetImportDialog();
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
      resetImportDialog();
      // Refresh the list
      const response = await api.get('/api/workout/exercises');
      setExercises(response.data.exercises || []);
    } catch {
      setError('Failed to import exercises');
    } finally {
      setImporting(false);
    }
  };

  // Helper functions for improved import dialog
  const getCategories = () => {
    const categories = new Set(defaultItems.map(item => item.category).filter(Boolean));
    return Array.from(categories).sort();
  };

  const getFilteredExercises = () => {
    let filtered = defaultItems;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search term
    if (importSearchTerm.trim()) {
      const term = importSearchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.muscleGroup.toLowerCase().includes(term) ||
        (item.category && item.category.toLowerCase().includes(term))
      );
    }

    return filtered;
  };

  // Paginated items for import dialog
  const paginatedImportExercises = useMemo(() => {
    const filtered = getFilteredExercises();
    const start = importPage * importRowsPerPage;
    const end = start + importRowsPerPage;
    return filtered.slice(start, end);
  }, [defaultItems, selectedCategory, importSearchTerm, importPage, importRowsPerPage]);

  const handleSelectAllInCategory = () => {
    const paginatedNames = new Set(paginatedImportExercises.map(item => item.name));
    
    // Check if all paginated exercises are selected
    const allSelected = paginatedNames.size > 0 && Array.from(paginatedNames).every(name => selectedItems.has(name));
    
    if (allSelected) {
      // Deselect all paginated exercises
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        paginatedNames.forEach(name => newSet.delete(name));
        return newSet;
      });
    } else {
      // Select all paginated exercises
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        paginatedNames.forEach(name => newSet.add(name));
        return newSet;
      });
    }
  };

  const handleCategoryChange = (event: SyntheticEvent, newValue: string) => {
    setSelectedCategory(newValue);
    setImportPage(0); // Reset to first page when category changes
  };

  const resetImportDialog = () => {
    setImportSearchTerm('');
    setSelectedCategory('all');
    setSelectedItems(new Set());
    setImportPage(0);
    setImportRowsPerPage(20);
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
    <WorkspaceSubscriptionGuard description="Activate a plan to manage exercises and workout plans.">
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Removed top cover image/banner */}

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
        >
          <RowSelection selected={selected.length} />

          {/* Search Input with Filters */}
          <Box sx={{ mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              fullWidth
              placeholder="Search exercises by name, Arabic name, or muscle group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ maxWidth: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchNormal1 size={20} />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Equipment</InputLabel>
                <Select
                  value={searchEquipmentFilter}
                  label="Equipment"
                  onChange={(e) => setSearchEquipmentFilter(e.target.value)}
                >
                  <MenuItem value="all">All Equipment</MenuItem>
                  {Array.from(new Set(exercises.map(e => e.equipmentNeeded).filter(Boolean))).sort().map((eq) => (
                    <MenuItem key={eq} value={eq}>{eq}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={searchCategoryFilter}
                  label="Category"
                  onChange={(e) => setSearchCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {Array.from(new Set(exercises.map(e => e.category).filter(Boolean))).sort().map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Muscle Group</InputLabel>
                <Select
                  value={searchMuscleGroupFilter}
                  label="Muscle Group"
                  onChange={(e) => setSearchMuscleGroupFilter(e.target.value)}
                >
                  <MenuItem value="all">All Groups</MenuItem>
                  {MUSCLE_GROUPS.map((group) => (
                    <MenuItem key={group} value={group}>{group}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
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
                                  {(isArabic ? row.nameArabic : undefined) || row.name}
                                </Typography>
                                {!isArabic && row.nameArabic && (
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
                                  <FormattedMessage id="workout.col.muscleGroup" defaultMessage="Muscle Group" />
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip label={row.muscleGroup} variant="outlined" size="small" />
                                </Box>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="workout.col.created" defaultMessage="Created" />
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
                          <TableCell>
                            <Avatar
                              variant="rounded"
                              src={row.gifImage}
                              sx={{ width: 56, height: 56, boxShadow: 1, cursor: row.gifImage ? 'pointer' : 'default' }}
                              onClick={(e) => { e.stopPropagation(); if (row.gifImage) setImagePreviewSrc(row.gifImage); }}
                            >
                              {!row.gifImage && (
                                <Typography variant="caption" color="text.secondary">GIF</Typography>
                              )}
                            </Avatar>
                          </TableCell>
                          <TableCell component="th" id={labelId} scope="row" padding="none">
                            {(isArabic ? row.nameArabic : undefined) || row.name}
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
                      <TableCell colSpan={6} />
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
      )}

      {/* {activeTab === 'logs' && (
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
      )} */}

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
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="md" fullWidth>
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
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryIsOther ? 'other' : (newExercise.category || '')}
                label="Category"
                onChange={(e) => {
                  if (e.target.value === 'other') {
                    setCategoryIsOther(true);
                    setNewExercise((prev) => ({ ...prev, category: '' }));
                  } else {
                    setCategoryIsOther(false);
                    setNewExercise((prev) => ({ ...prev, category: e.target.value }));
                  }
                }}
              >
                <MenuItem value="">None</MenuItem>
                {categoryOptions.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            {categoryIsOther && (
            <TextField
              fullWidth
                label="Category (Other)"
                value={newCategoryValue}
                onChange={(e) => setNewCategoryValue(e.target.value)}
                placeholder="Enter new category"
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Equipment Needed</InputLabel>
              <Select
                value={equipmentIsOther ? 'other' : (newExercise.equipmentNeeded || '')}
                label="Equipment Needed"
                onChange={(e) => {
                  if (e.target.value === 'other') {
                    setEquipmentIsOther(true);
                    setNewExercise((prev) => ({ ...prev, equipmentNeeded: '' }));
                  } else {
                    setEquipmentIsOther(false);
                    setNewExercise((prev) => ({ ...prev, equipmentNeeded: e.target.value }));
                  }
                }}
              >
                <MenuItem value="">None</MenuItem>
                {equipmentOptions.map((eq) => (
                  <MenuItem key={eq} value={eq}>{eq}</MenuItem>
                ))}
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            {equipmentIsOther && (
            <TextField
              fullWidth
                label="Equipment Needed (Other)"
                value={newEquipmentValue}
                onChange={(e) => setNewEquipmentValue(e.target.value)}
                placeholder="Enter new equipment"
            />
            )}
            <TextField
              fullWidth
              label="YouTube URL"
              value={newExercise.videoUrl}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, videoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <TextField
              fullWidth
              label="GIF Image URL"
              value={newExercise.gifImage}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, gifImage: e.target.value }))}
              placeholder="https://example.com/exercise.gif"
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Instructions"
              value={newExercise.instructions}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="Step-by-step instructions for the exercise..."
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              value={newExercise.notes}
              onChange={(e) => setNewExercise((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or tips..."
            />
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
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="md" fullWidth>
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
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={editCategoryIsOther ? 'other' : ((selectedExercise as any).category || '')}
                  label="Category"
                  onChange={(e) => {
                    if (e.target.value === 'other') {
                      setEditCategoryIsOther(true);
                      setSelectedExercise((prev) => (prev ? ({ ...prev, category: '' } as any) : null));
                    } else {
                      setEditCategoryIsOther(false);
                      setSelectedExercise((prev) => (prev ? ({ ...prev, category: e.target.value } as any) : null));
                    }
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {categoryOptions.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              {editCategoryIsOther && (
              <TextField
                fullWidth
                  label="Category (Other)"
                  value={editNewCategoryValue}
                  onChange={(e) => setEditNewCategoryValue(e.target.value)}
                  placeholder="Enter new category"
                />
              )}
              <FormControl fullWidth>
                <InputLabel>Equipment Needed</InputLabel>
                <Select
                  value={editEquipmentIsOther ? 'other' : ((selectedExercise as any).equipmentNeeded || '')}
                  label="Equipment Needed"
                  onChange={(e) => {
                    if (e.target.value === 'other') {
                      setEditEquipmentIsOther(true);
                      setSelectedExercise((prev) => (prev ? ({ ...prev, equipmentNeeded: '' } as any) : null));
                    } else {
                      setEditEquipmentIsOther(false);
                      setSelectedExercise((prev) => (prev ? ({ ...prev, equipmentNeeded: e.target.value } as any) : null));
                    }
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {equipmentOptions.map((eq) => (
                    <MenuItem key={eq} value={eq}>{eq}</MenuItem>
                  ))}
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              {editEquipmentIsOther && (
              <TextField
                fullWidth
                  label="Equipment Needed (Other)"
                  value={editNewEquipmentValue}
                  onChange={(e) => setEditNewEquipmentValue(e.target.value)}
                  placeholder="Enter new equipment"
              />
              )}
              <TextField
                fullWidth
                label="YouTube URL"
                value={(selectedExercise as any).videoUrl || ''}
                onChange={(e) => setSelectedExercise((prev) => (prev ? ({ ...prev, videoUrl: e.target.value } as any) : null))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <TextField
                fullWidth
                label="GIF Image URL"
                value={(selectedExercise as any).gifImage || ''}
                onChange={(e) => setSelectedExercise((prev) => (prev ? ({ ...prev, gifImage: e.target.value } as any) : null))}
                placeholder="https://example.com/exercise.gif"
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Instructions"
                value={(selectedExercise as any).instructions || ''}
                onChange={(e) => setSelectedExercise((prev) => (prev ? ({ ...prev, instructions: e.target.value } as any) : null))}
                placeholder="Step-by-step instructions for the exercise..."
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={(selectedExercise as any).notes || ''}
                onChange={(e) => setSelectedExercise((prev) => (prev ? ({ ...prev, notes: e.target.value } as any) : null))}
                placeholder="Additional notes or tips..."
              />
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
              {/* Search Bar */}
              <TextField
                fullWidth
                placeholder="Search exercises by name, muscle group, or category..."
                value={importSearchTerm}
                onChange={(e) => {
                  setImportSearchTerm(e.target.value);
                  setImportPage(0); // Reset to first page when search changes
                }}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchNormal1 size={20} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Category Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                >
                  <Tab label="All" value="all" />
                  {getCategories().map((category) => (
                    <Tab key={category} label={category} value={category} />
                  ))}
                </Tabs>
              </Box>

              {/* Selection Controls */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.size} of {defaultItems.length} selected
                  {getFilteredExercises().length !== defaultItems.length && (
                    <span> ({getFilteredExercises().length} filtered, showing {paginatedImportExercises.length} on this page)</span>
                  )}
                </Typography>
                <Button variant="outlined" size="small" onClick={handleSelectAllInCategory}>
                  {(() => {
                    const paginatedNames = new Set(paginatedImportExercises.map(item => item.name));
                    const allPaginatedSelected = paginatedNames.size > 0 && Array.from(paginatedNames).every(name => selectedItems.has(name));
                    return allPaginatedSelected ? 'Deselect All Shown' : `Select All Shown (${paginatedImportExercises.length})`;
                  })()}
                </Button>
                <Button variant="outlined" size="small" onClick={handleSelectAllImport}>
                  {selectedItems.size === defaultItems.length ? 'Deselect All' : `Select All (${defaultItems.length})`}
                </Button>
              </Stack>

              {/* Exercises Grid */}
              <Box>
                <Stack spacing={2}>
                  {paginatedImportExercises.map((item) => {
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
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar
                              variant="rounded"
                              src={item.gifImage}
                              sx={{ width: 48, height: 48, boxShadow: 1, cursor: item.gifImage ? 'pointer' : 'default' }}
                              onClick={(e) => { e.stopPropagation(); if (item.gifImage) setImagePreviewSrc(item.gifImage); }}
                            >
                              {!item.gifImage && (
                                <Typography variant="caption" color="text.secondary">GIF</Typography>
                              )}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {item.name}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Chip label={item.muscleGroup} variant="outlined" size="small" />
                                {item.category && (
                                  <Chip label={item.category} variant="outlined" size="small" color="secondary" />
                                )}
                              </Stack>
                            </Box>
                          </Stack>
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
                  {paginatedImportExercises.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">
                        No exercises found matching your criteria
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
              
              {/* Pagination */}
              {getFilteredExercises().length > importRowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <TablePagination
                    component="div"
                    count={getFilteredExercises().length}
                    page={importPage}
                    onPageChange={(_, newPage) => setImportPage(newPage)}
                    rowsPerPage={importRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setImportRowsPerPage(parseInt(e.target.value, 10));
                      setImportPage(0);
                    }}
                    rowsPerPageOptions={[10, 20, 50, 100]}
                  />
                </Box>
              )}
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
                          <Box
                            sx={{
                              mt: 2,
                              p: 2,
                              borderRadius: 2,
                              bgcolor: 'info.lighter',
                              border: '2px solid',
                              borderColor: 'info.main',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                          >
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 700,
                                color: 'info.dark',
                                mb: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              💡 Exercise Notes
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'info.darker',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}
                            >
                              {exercise.notes}
                            </Typography>
                          </Box>
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

      {/* Image Preview Dialog */}
      <Dialog
        open={Boolean(imagePreviewSrc)}
        onClose={() => setImagePreviewSrc(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Exercise Preview</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {imagePreviewSrc && (
            <Box sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Box
                component="img"
                src={imagePreviewSrc}
                alt="Exercise GIF"
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: 2,
                  boxShadow: 3
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImagePreviewSrc(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </WorkspaceSubscriptionGuard>
  );
}
