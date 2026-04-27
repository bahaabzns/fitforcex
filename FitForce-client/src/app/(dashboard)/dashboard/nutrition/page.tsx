'use client';

import { useState, useEffect, ChangeEvent, MouseEvent, SyntheticEvent, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Autocomplete from '@mui/material/Autocomplete';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import CardHeader from '@mui/material/CardHeader';
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

// Icons
import { Add, Edit, Trash, DocumentUpload, SearchNormal1, Information, Filter, CloseCircle, ArrowUp2, Refresh } from '@wandersonalwes/iconsax-react';

// Food Replacements API
import {
  getFoodItemReplacements,
  addFoodItemReplacement,
  updateFoodItemReplacement,
  deleteFoodItemReplacement,
  type FoodReplacement,
} from '@/api/food-replacements';

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

interface FoodItem {
  id: string;
  name: string;
  nameArabic?: string;
  category?: string;
  categoryArabic?: string;
  unit?: string;
  unitArabic?: string;
  servingSize?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Micronutrients (optional)
  water?: number;
  ash?: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  phosphorous?: number;
  magnesium?: number;
  iron?: number;
  zinc?: number;
  copper?: number;
  manganese?: number;
  fluoride?: number;
  selenium?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_b1?: number;
  vitamin_b2?: number;
  vitamin_b5?: number;
  vitamin_b6?: number;
  vitamin_b12?: number;
  vitamin_d?: number;
  vitamin_e?: number;
  vitamin_k?: number;
  niacin?: number;
  folic_acid?: number;
  choline?: number;
  betaine?: number;
  createdAt: string;
  updatedAt: string;
}

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

function stableSort(array: FoodItem[], comparator: (a: KeyedObject, b: KeyedObject) => number) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0] as FoodItem, b[0] as FoodItem);
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
    label: 'nutrition.col.name'
  },
  {
    id: 'calories',
    numeric: true,
    disablePadding: false,
    label: 'nutrition.col.calories'
  },
  {
    id: 'protein',
    numeric: true,
    disablePadding: false,
    label: 'nutrition.col.protein'
  },
  {
    id: 'carbs',
    numeric: true,
    disablePadding: false,
    label: 'nutrition.col.carbs'
  },
  {
    id: 'fat',
    numeric: true,
    disablePadding: false,
    label: 'nutrition.col.fat'
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
            slotProps={{ input: { 'aria-label': 'select all food items' } }}
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

export default function NutritionPage() {
  const intl = useIntl();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');

  // Removed Recipes tab - only Food Items now
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters for main search - Multiselect arrays
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<string[]>([]);
  const [searchUnitFilter, setSearchUnitFilter] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Table states
  const [order, setOrder] = useState<ArrangementOrder>('asc');
  const [orderBy, setOrderBy] = useState('name');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedValue, setSelectedValue] = useState<FoodItem[]>([]);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  const [replacements, setReplacements] = useState<FoodReplacement[]>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [addingReplacement, setAddingReplacement] = useState(false);
  const [selectedReplacementFood, setSelectedReplacementFood] = useState<FoodItem | null>(null);
  const [replacementPriority, setReplacementPriority] = useState(0);
  const [replacementNotes, setReplacementNotes] = useState('');

  // Form states
  const [newFoodItem, setNewFoodItem] = useState({
    name: '',
    nameArabic: '',
    category: '',
    unit: '',
    unitArabic: '',
    servingSize: undefined as number | undefined,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: undefined as number | undefined,
    ash: undefined as number | undefined,
    fiber: undefined as number | undefined,
    sodium: undefined as number | undefined,
    potassium: undefined as number | undefined,
    calcium: undefined as number | undefined,
    phosphorous: undefined as number | undefined,
    magnesium: undefined as number | undefined,
    iron: undefined as number | undefined,
    zinc: undefined as number | undefined,
    copper: undefined as number | undefined,
    manganese: undefined as number | undefined,
    fluoride: undefined as number | undefined,
    selenium: undefined as number | undefined,
    vitamin_a: undefined as number | undefined,
    vitamin_c: undefined as number | undefined,
    vitamin_b1: undefined as number | undefined,
    vitamin_b2: undefined as number | undefined,
    vitamin_b5: undefined as number | undefined,
    vitamin_b6: undefined as number | undefined,
    vitamin_b12: undefined as number | undefined,
    vitamin_d: undefined as number | undefined,
    vitamin_e: undefined as number | undefined,
    vitamin_k: undefined as number | undefined,
    niacin: undefined as number | undefined,
    folic_acid: undefined as number | undefined,
    choline: undefined as number | undefined,
    betaine: undefined as number | undefined,
  });

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Import states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [defaultItems, setDefaultItems] = useState<FoodItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [nutritionImportSearchTerm, setNutritionImportSearchTerm] = useState('');
  const [selectedNutritionCategory, setSelectedNutritionCategory] = useState<string>('all');
  // Pagination for import dialog
  const [importPage, setImportPage] = useState(0);
  const [importRowsPerPage, setImportRowsPerPage] = useState(20);

  // Recipes removed

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetchFoodItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/api/nutrition/food-items');
        setFoodItems(response.data.foodItems || []);
      } catch {
        setError('Failed to load food items');
      } finally {
        setLoading(false);
      }
    };

    fetchFoodItems();
  }, [workspaceId]);

  // Recipes loading removed

  const handleCreate = async () => {
    if (!newFoodItem.name.trim() || newFoodItem.calories <= 0) {
      setError('Please provide a name and valid calories');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      // Auto-determine category if not provided - set default to "Other"
      const foodItemToCreate = {
        ...newFoodItem,
        category: newFoodItem.category || 'Other'
      };
      await api.post('/api/nutrition/food-items', foodItemToCreate);
      setIsCreateDialogOpen(false);
      setNewFoodItem({ name: '', nameArabic: '', category: '', unit: '', unitArabic: '', servingSize: undefined, calories: 0, protein: 0, carbs: 0, fat: 0, water: undefined, ash: undefined, fiber: undefined, sodium: undefined, potassium: undefined, calcium: undefined, phosphorous: undefined, magnesium: undefined, iron: undefined, zinc: undefined, copper: undefined, manganese: undefined, fluoride: undefined, selenium: undefined, vitamin_a: undefined, vitamin_c: undefined, vitamin_b1: undefined, vitamin_b2: undefined, vitamin_b5: undefined, vitamin_b6: undefined, vitamin_b12: undefined, vitamin_d: undefined, vitamin_e: undefined, vitamin_k: undefined, niacin: undefined, folic_acid: undefined, choline: undefined, betaine: undefined });
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to create food item');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedFoodItem) return;
    if (!selectedFoodItem.name.trim() || selectedFoodItem.calories <= 0) {
      setError('Please provide a name and valid calories');
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const { id, createdAt, updatedAt, workspaceId: _ws, deletedAt, ...payload } = selectedFoodItem as any;
      // Auto-determine category if not provided - set default to "Other"
      if (!payload.category) {
        payload.category = 'Other';
      }
      await api.put(`/api/nutrition/food-items/${selectedFoodItem.id}`, payload);
      setIsEditDialogOpen(false);
      setSelectedFoodItem(null);
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to update food item');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this food item?')) return;

    setDeleting(id);
    setError(null);
    try {
      await api.delete(`/api/nutrition/food-items/${id}`);
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to delete food item');
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all food items?')) return;

    try {
      await api.delete('/api/nutrition/food-items/clear-all');
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to clear food items');
    }
  };

  const handleEdit = (foodItem: FoodItem) => {
    setSelectedFoodItem({ ...foodItem });
    setIsEditDialogOpen(true);
    setEditTab(0);
    setReplacements([]);
  };

  const loadReplacements = async (foodItemId: string) => {
    try {
      setLoadingReplacements(true);
      const data = await getFoodItemReplacements(foodItemId);
      setReplacements(data.replacements);
    } catch (err: any) {
      setError(err?.message || 'Failed to load replacements');
    } finally {
      setLoadingReplacements(false);
    }
  };

  const handleAddReplacement = async () => {
    if (!selectedFoodItem || !selectedReplacementFood) {
      setError('Please select a replacement food');
      return;
    }

    try {
      setAddingReplacement(true);
      setError(null);
      await addFoodItemReplacement(selectedFoodItem.id, {
        replacementId: selectedReplacementFood.id,
        priority: replacementPriority,
        notes: replacementNotes || undefined,
      });
      await loadReplacements(selectedFoodItem.id);
      setSelectedReplacementFood(null);
      setReplacementPriority(0);
      setReplacementNotes('');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to add replacement');
    } finally {
      setAddingReplacement(false);
    }
  };

  const handleDeleteReplacement = async (replacementId: string) => {
    if (!selectedFoodItem || !confirm('Are you sure you want to remove this replacement?')) return;

    try {
      setError(null);
      await deleteFoodItemReplacement(selectedFoodItem.id, replacementId);
      await loadReplacements(selectedFoodItem.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete replacement');
    }
  };

  // Table handlers
  const handleRequestSort = (event: SyntheticEvent, property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelectedId: string[] = foodItems.map((n) => n.id);
      setSelected(newSelectedId);
      setSelectedValue(foodItems);
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
    const selectedRowData: FoodItem[] = foodItems.filter((row) => newSelected.includes(row.id));
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

  // Search filtering with category and unit filters (multiselect)
  const filteredFoodItems = foodItems.filter((item) => {
    // Text search
    const matchesSearch = !searchTerm.trim() || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.nameArabic && item.nameArabic.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Category filter (multiselect)
    const matchesCategory = searchCategoryFilter.length === 0 || 
      (item.category && searchCategoryFilter.includes(item.category));
    
    // Unit filter (multiselect)
    const matchesUnit = searchUnitFilter.length === 0 || 
      (item.unit && searchUnitFilter.includes(item.unit));
    
    return matchesSearch && matchesCategory && matchesUnit;
  });

  // Count active filters
  const activeFiltersCount = searchCategoryFilter.length + searchUnitFilter.length;
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearchCategoryFilter([]);
    setSearchUnitFilter([]);
    setSearchTerm('');
  };

  // Import handlers
  const handleOpenImport = async () => {
    setIsImportDialogOpen(true);
    setLoadingDefaults(true);
    setError(null);
    resetNutritionImportDialog();
    try {
      const response = await api.get('/api/nutrition/food-items/defaults');
      setDefaultItems(response.data.foodItems || []);
    } catch {
      setError('Failed to load default food items');
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
      await api.post('/api/nutrition/food-items/import-selected', { items: itemsToImport });
      setIsImportDialogOpen(false);
      resetNutritionImportDialog();
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to import food items');
    } finally {
      setImporting(false);
    }
  };

  const handleNutritionCategoryChange = (event: SyntheticEvent, newValue: string) => {
    setSelectedNutritionCategory(newValue);
    setImportPage(0); // Reset to first page when category changes
  };

  const handleSelectAllInNutritionCategory = () => {
    // Check if all paginated items are selected
    const allPaginatedSelected = paginatedNutritionNames.size > 0 && Array.from(paginatedNutritionNames).every(name => selectedItems.has(name));
    
    if (allPaginatedSelected) {
      // Deselect all paginated items
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        paginatedNutritionNames.forEach(name => newSet.delete(name));
        return newSet;
      });
    } else {
      // Select all paginated items
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        paginatedNutritionNames.forEach(name => newSet.add(name));
        return newSet;
      });
    }
  };

  const resetNutritionImportDialog = () => {
    setNutritionImportSearchTerm('');
    setSelectedNutritionCategory('all');
    setSelectedItems(new Set());
    setImportPage(0);
    setImportRowsPerPage(20);
  };

  // Memoized values to prevent infinite re-renders
  const nutritionCategories = useMemo(() => {
    const categories = new Set(defaultItems.map(item => item.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [defaultItems]);
  
  const filteredNutritionItems = useMemo(() => {
    let filtered = defaultItems;

    // Filter by category
    if (selectedNutritionCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedNutritionCategory);
    }

    // Filter by search term
    if (nutritionImportSearchTerm.trim()) {
      const term = nutritionImportSearchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        (item.nameArabic && item.nameArabic.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [defaultItems, selectedNutritionCategory, nutritionImportSearchTerm]);
  
  // Paginated items for import dialog
  const paginatedNutritionItems = useMemo(() => {
    const start = importPage * importRowsPerPage;
    const end = start + importRowsPerPage;
    return filteredNutritionItems.slice(start, end);
  }, [filteredNutritionItems, importPage, importRowsPerPage]);
  
  const filteredNutritionNames = useMemo(() => new Set(filteredNutritionItems.map(item => item.name)), [filteredNutritionItems]);
  const paginatedNutritionNames = useMemo(() => new Set(paginatedNutritionItems.map(item => item.name)), [paginatedNutritionItems]);

  if (!workspaceId) {
    return (
      <MainCard sx={{ borderStyle: 'dashed' }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6">Select a workspace</Typography>
          <Typography color="text.secondary">Open a workspace subdomain to manage nutrition.</Typography>
        </Box>
      </MainCard>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading food items...</Typography>
        </Stack>
      </Box>
    );
  }

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - foodItems.length) : 0;

  return (
    <WorkspaceSubscriptionGuard description="Activate a plan to manage nutrition items and recipes.">
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
            <FormattedMessage id="Nutrition" defaultMessage="Nutrition" />
          </Typography>
          <Typography color="text.secondary">
            <FormattedMessage id="nutrition.subtitle" defaultMessage="Manage food items and nutrition database" />
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Food Items Table */}
      {foodItems.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography variant="h6" gutterBottom>
              No Food Items
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Add food items to start building nutrition plans for your clients
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" startIcon={<DocumentUpload />} onClick={handleOpenImport}>
                Import Default Items
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
                Add First Item
              </Button>
            </Stack>
          </Box>
        </MainCard>
      ) : (
        <MainCard
          content={false}
          title="Food Items"
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ p: 2, pt: 0 }}>
            <Button variant="outlined" startIcon={<DocumentUpload />} onClick={handleOpenImport}>
              Import Items
            </Button>
            {selected.length > 0 && (
              <Button variant="outlined" color="error" startIcon={<Trash />} onClick={() => {
                if (!confirm(`Delete ${selected.length} selected item(s)?`)) return;
                Promise.all(selected.map((id) => api.delete(`/api/nutrition/food-items/${id}`)))
                  .then(async () => {
                    const response = await api.get('/api/nutrition/food-items');
                    setFoodItems(response.data.foodItems || []);
                    setSelected([]);
                    setSelectedValue([]);
                  })
                  .catch(() => setError('Failed to delete selected items'));
              }}>
                Delete Selected ({selected.length})
              </Button>
            )}
            <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
              Add Food Item
            </Button>
          </Stack>
          <RowSelection selected={selected.length} />

          {/* Enhanced Search and Filters Section */}
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardHeader
              avatar={
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: 'primary.lighter',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Filter size={20} />
                </Box>
              }
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Filters
                  </Typography>
                  {activeFiltersCount > 0 && (
                    <Chip 
                      label={activeFiltersCount} 
                      size="small" 
                      color="primary"
                      sx={{ height: 20, fontSize: '0.75rem', fontWeight: 600 }}
                    />
                  )}
                </Box>
              }
              subheader={
                <Typography variant="body2" color="text.secondary">
                  {activeFiltersCount > 0 
                    ? `${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''} active • ${filteredFoodItems.length} food item${filteredFoodItems.length !== 1 ? 's' : ''} found`
                    : `Showing all ${filteredFoodItems.length} food item${filteredFoodItems.length !== 1 ? 's' : ''}`
                  }
                </Typography>
              }
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  {activeFiltersCount > 0 && (
                    <Button
                      size="small"
                      startIcon={<CloseCircle size={16} />}
                      onClick={clearAllFilters}
                      sx={{ textTransform: 'none' }}
                    >
                      Clear All
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    sx={{ 
                      transform: filtersExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
                      transition: 'transform 0.3s'
                    }}
                  >
                    <ArrowUp2 size={20} />
                  </IconButton>
                </Stack>
              }
              sx={{ pb: filtersExpanded ? 1 : 0 }}
            />
            <Collapse in={filtersExpanded}>
              <CardContent>
                <Stack spacing={3}>
                  {/* Search Bar */}
                  <TextField
                    fullWidth
                    placeholder="Search food items by name or Arabic name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchNormal1 size={20} />
                        </InputAdornment>
                      ),
                      endAdornment: searchTerm && (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setSearchTerm('')}
                            edge="end"
                          >
                            <CloseCircle size={18} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ 
                      bgcolor: 'background.default',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />

                  {/* Active Filter Chips */}
                  {activeFiltersCount > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Active Filters:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {searchCategoryFilter.map((cat) => (
                          <Chip
                            key={cat}
                            label={`Category: ${cat}`}
                            size="small"
                            onDelete={() => setSearchCategoryFilter(prev => prev.filter(f => f !== cat))}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                        {searchUnitFilter.map((unit) => (
                          <Chip
                            key={unit}
                            label={`Unit: ${unit}`}
                            size="small"
                            onDelete={() => setSearchUnitFilter(prev => prev.filter(f => f !== unit))}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Filter Dropdowns */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={Array.from(new Set(foodItems.map(f => f.category).filter(Boolean))).sort()}
                        value={searchCategoryFilter}
                        onChange={(_, newValue) => setSearchCategoryFilter(newValue)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Category"
                            placeholder="Select categories..."
                            sx={{
                              bgcolor: 'background.default',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2
                              }
                            }}
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option}
                              label={option}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))
                        }
                        PaperComponent={(props) => (
                          <Paper {...props} sx={{ borderRadius: 2, mt: 1 }} />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        multiple
                        size="small"
                        options={Array.from(new Set(foodItems.map(f => f.unit).filter(Boolean))).sort()}
                        value={searchUnitFilter}
                        onChange={(_, newValue) => setSearchUnitFilter(newValue)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Unit"
                            placeholder="Select units..."
                            sx={{
                              bgcolor: 'background.default',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2
                              }
                            }}
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option}
                              label={option}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))
                        }
                        PaperComponent={(props) => (
                          <Paper {...props} sx={{ borderRadius: 2, mt: 1 }} />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Collapse>
          </Card>

          {/* table */}
          {isMobile ? (
            // Mobile Cards View
            <Grid container spacing={2}>
              {stableSort(filteredFoodItems, getComparator(order, orderBy))
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
                              </Box>
                            </Stack>

                            <Divider />

                            {/* Nutritional Information */}
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="nutrition.col.calories" defaultMessage="Calories (per serving)" />
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {row.calories} kcal
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="nutrition.col.protein" defaultMessage="Protein (g)" />
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {row.protein}g
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="nutrition.col.carbs" defaultMessage="Carbs (g)" />
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {row.carbs}g
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">
                                  <FormattedMessage id="nutrition.col.fat" defaultMessage="Fat (g)" />
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {row.fat}g
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
                                <FormattedMessage id="edit" defaultMessage="Edit" />
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={deleting === row.id ? <CircularProgress size={16} /> : <Trash size={16} />}
                                onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                                disabled={deleting === row.id}
                              >
                                <FormattedMessage id="delete" defaultMessage="Delete" />
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
                  rowCount={filteredFoodItems.length}
                />
                <TableBody>
                  {stableSort(filteredFoodItems, getComparator(order, orderBy))
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
                            {(isArabic ? row.nameArabic : undefined) || row.name}
                          </TableCell>
                          <TableCell align="right">{row.calories}</TableCell>
                          <TableCell align="right">{row.protein}</TableCell>
                          <TableCell align="right">{row.carbs}</TableCell>
                          <TableCell align="right">{row.fat}</TableCell>
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
                      <TableCell colSpan={7} />
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
            count={filteredFoodItems.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </MainCard>
      )}


      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Food Item</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Create a new food item with nutritional information
          </Typography>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={createTab} onChange={(_, v) => setCreateTab(v)}>
              <Tab label="Main Details" />
              <Tab label="Micronutrients" />
            </Tabs>
          </Box>
          {createTab === 0 && (
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Food Name"
                value={newFoodItem.name}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Chicken Breast"
              />
              <TextField
                fullWidth
                label="Food Name (Arabic)"
                value={newFoodItem.nameArabic}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, nameArabic: e.target.value }))}
                placeholder="مثال: صدور الدجاج"
              />
              <FormControl fullWidth>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  label="Category"
                  value={newFoodItem.category}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, category: e.target.value as string }))}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="Protein">Protein</MenuItem>
                  <MenuItem value="Carb">Carb</MenuItem>
                  <MenuItem value="Fat">Fat</MenuItem>
                  <MenuItem value="Vegetable">Vegetable</MenuItem>
                  <MenuItem value="Fruit">Fruit</MenuItem>
                  <MenuItem value="Dairy">Dairy</MenuItem>
                  <MenuItem value="Beverage">Beverage</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Serving Size"
                  type="number"
                  value={newFoodItem.servingSize ?? ''}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, servingSize: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  placeholder="100"
                />
                <TextField
                  fullWidth
                  label="Unit"
                  value={newFoodItem.unit}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="g, ml, etc."
                />
              </Stack>
              <TextField
                fullWidth
                label="Unit (Arabic)"
                value={newFoodItem.unitArabic}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, unitArabic: e.target.value }))}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Calories (per serving)"
                  type="number"
                  value={newFoodItem.calories}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                  placeholder="165"
                  helperText="Calories per serving"
                />
                <TextField
                  fullWidth
                  label="Protein (g per serving)"
                  type="number"
                  value={newFoodItem.protein}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
                  placeholder="31"
                  helperText="Protein grams per serving"
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Carbs (g per serving)"
                  type="number"
                  value={newFoodItem.carbs}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  helperText="Carbohydrates grams per serving"
                />
                <TextField
                  fullWidth
                  label="Fat (g per serving)"
                  type="number"
                  value={newFoodItem.fat}
                  onChange={(e) => setNewFoodItem((prev) => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
                  placeholder="3.6"
                  helperText="Fat grams per serving"
                />
              </Stack>
            </Stack>
          )}
          {createTab === 1 && (
            <Grid container spacing={2}>
              {[
                ['water','Water (g)'],['ash','Ash (g)'],['fiber','Fiber (g)'],['sodium','Sodium (mg)'],['potassium','Potassium (mg)'],
                ['calcium','Calcium (mg)'],['phosphorous','Phosphorous (mg)'],['magnesium','Magnesium (mg)'],['iron','Iron (mg)'],['zinc','Zinc (mg)'],
                ['copper','Copper (mg)'],['manganese','Manganese (mg)'],['fluoride','Fluoride (mcg)'],['selenium','Selenium (mcg)'],
                ['vitamin_a','Vitamin A (mcg)'],['vitamin_c','Vitamin C (mg)'],['vitamin_b1','Vitamin B1 (mg)'],['vitamin_b2','Vitamin B2 (mg)'],
                ['vitamin_b5','Vitamin B5 (mg)'],['vitamin_b6','Vitamin B6 (mg)'],['vitamin_b12','Vitamin B12 (mcg)'],
                ['vitamin_d','Vitamin D (mcg)'],['vitamin_e','Vitamin E (mg)'],['vitamin_k','Vitamin K (mcg)'],
                ['niacin','Niacin (mg)'],['folic_acid','Folic Acid (mcg)'],['choline','Choline (mg)'],['betaine','Betaine (mg)']
              ].map(([key,label]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <TextField
                    fullWidth
                    label={label as string}
                    type="number"
                    value={(newFoodItem as any)[key] ?? ''}
                    onChange={(e) => setNewFoodItem((prev) => ({ ...prev, [key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  />
                </Grid>
              ))}
            </Grid>
          )}
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
        <DialogTitle>Edit Food Item</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Update the nutritional information for this food item
          </Typography>
          {selectedFoodItem && (
            <>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={editTab} onChange={(_, v) => {
                  setEditTab(v);
                  if (v === 2 && selectedFoodItem) {
                    // Load replacements when switching to Replacements tab
                    loadReplacements(selectedFoodItem.id);
                  }
                }}>
                  <Tab label="Main Details" />
                  <Tab label="Micronutrients" />
                  <Tab label="Replacements" />
                </Tabs>
              </Box>
              {editTab === 0 && (
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Food Name"
                    value={selectedFoodItem.name}
                    onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                    placeholder="e.g., Chicken Breast"
                  />
                  <TextField
                    fullWidth
                    label="Food Name (Arabic)"
                    value={selectedFoodItem.nameArabic || ''}
                    onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, nameArabic: e.target.value } : null))}
                  />
                  <FormControl fullWidth>
                    <InputLabel id="edit-category-label">Category</InputLabel>
                    <Select
                      labelId="edit-category-label"
                      label="Category"
                      value={selectedFoodItem.category || ''}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, category: e.target.value as string } : null))}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="Protein">Protein</MenuItem>
                      <MenuItem value="Carb">Carb</MenuItem>
                      <MenuItem value="Fat">Fat</MenuItem>
                      <MenuItem value="Vegetable">Vegetable</MenuItem>
                      <MenuItem value="Fruit">Fruit</MenuItem>
                      <MenuItem value="Dairy">Dairy</MenuItem>
                      <MenuItem value="Beverage">Beverage</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Serving Size"
                      type="number"
                      value={selectedFoodItem.servingSize ?? ''}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, servingSize: e.target.value === '' ? undefined : Number(e.target.value) } : null))}
                    />
                    <TextField
                      fullWidth
                      label="Unit"
                      value={selectedFoodItem.unit || ''}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, unit: e.target.value } : null))}
                    />
                  </Stack>
                  <TextField
                    fullWidth
                    label="Unit (Arabic)"
                    value={selectedFoodItem.unitArabic || ''}
                    onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, unitArabic: e.target.value } : null))}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Calories (per serving)"
                      type="number"
                      value={selectedFoodItem.calories}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, calories: parseInt(e.target.value) || 0 } : null))}
                      placeholder="165"
                    />
                    <TextField
                      fullWidth
                      label="Protein (g)"
                      type="number"
                      value={selectedFoodItem.protein}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, protein: parseFloat(e.target.value) || 0 } : null))}
                      placeholder="31"
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Carbs (g)"
                      type="number"
                      value={selectedFoodItem.carbs}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, carbs: parseFloat(e.target.value) || 0 } : null))}
                      placeholder="0"
                    />
                    <TextField
                      fullWidth
                      label="Fat (g)"
                      type="number"
                      value={selectedFoodItem.fat}
                      onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, fat: parseFloat(e.target.value) || 0 } : null))}
                      placeholder="3.6"
                    />
                  </Stack>
                </Stack>
              )}
              {editTab === 1 && (
                <Grid container spacing={2}>
                  {[
                    ['water','Water (g)'],['ash','Ash (g)'],['fiber','Fiber (g)'],['sodium','Sodium (mg)'],['potassium','Potassium (mg)'],
                    ['calcium','Calcium (mg)'],['phosphorous','Phosphorous (mg)'],['magnesium','Magnesium (mg)'],['iron','Iron (mg)'],['zinc','Zinc (mg)'],
                    ['copper','Copper (mg)'],['manganese','Manganese (mg)'],['fluoride','Fluoride (mcg)'],['selenium','Selenium (mcg)'],
                    ['vitamin_a','Vitamin A (mcg)'],['vitamin_c','Vitamin C (mg)'],['vitamin_b1','Vitamin B1 (mg)'],['vitamin_b2','Vitamin B2 (mg)'],
                    ['vitamin_b5','Vitamin B5 (mg)'],['vitamin_b6','Vitamin B6 (mg)'],['vitamin_b12','Vitamin B12 (mcg)'],
                    ['vitamin_d','Vitamin D (mcg)'],['vitamin_e','Vitamin E (mg)'],['vitamin_k','Vitamin K (mcg)'],
                    ['niacin','Niacin (mg)'],['folic_acid','Folic Acid (mcg)'],['choline','Choline (mg)'],['betaine','Betaine (mg)']
                  ].map(([key,label]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <TextField
                        fullWidth
                        label={label as string}
                        type="number"
                        value={(selectedFoodItem as any)[key] ?? ''}
                        onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, [key as string]: e.target.value === '' ? undefined : Number(e.target.value) } as any : null))}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
              {editTab === 2 && selectedFoodItem && (
                <Stack spacing={3}>
                  <Typography variant="body2" color="text.secondary">
                    Define replacement foods for <strong>{selectedFoodItem.name}</strong>. These will appear when coaches replace this food in nutrition plans.
                  </Typography>

                  {/* Add Replacement Section */}
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Add Replacement
                      </Typography>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        <Autocomplete
                          options={foodItems.filter(f => f.id !== selectedFoodItem.id)}
                          getOptionLabel={(option) => option.name}
                          value={selectedReplacementFood}
                          onChange={(_, newValue) => setSelectedReplacementFood(newValue)}
                          renderInput={(params) => (
                            <TextField {...params} label="Select Replacement Food" placeholder="Search for a food item..." />
                          )}
                          renderOption={(props, option) => (
                            <Box component="li" {...props}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">{option.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.calories} kcal • P: {option.protein}g • C: {option.carbs}g • F: {option.fat}g
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        />
                        <Stack direction="row" spacing={2}>
                          <TextField
                            label="Priority"
                            type="number"
                            value={replacementPriority}
                            onChange={(e) => setReplacementPriority(Number(e.target.value))}
                            helperText="Lower number = higher priority (0 = highest)"
                            sx={{ flex: 1 }}
                            inputProps={{ min: 0 }}
                          />
                          <TextField
                            label="Notes (optional)"
                            value={replacementNotes}
                            onChange={(e) => setReplacementNotes(e.target.value)}
                            placeholder="e.g., Good alternative"
                            sx={{ flex: 2 }}
                          />
                        </Stack>
                        <Button
                          variant="contained"
                          startIcon={<Add />}
                          onClick={handleAddReplacement}
                          disabled={!selectedReplacementFood || addingReplacement}
                        >
                          {addingReplacement ? 'Adding...' : 'Add Replacement'}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* Existing Replacements List */}
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Existing Replacements ({replacements.length})
                    </Typography>
                    {loadingReplacements ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={32} />
                      </Box>
                    ) : replacements.length === 0 ? (
                      <Alert severity="info">
                        No replacements defined yet. Add one above to get started.
                      </Alert>
                    ) : (
                      <Stack spacing={1} sx={{ mt: 2 }}>
                        {replacements.map((replacement) => (
                          <Card key={replacement.id} variant="outlined">
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body1" fontWeight={600}>
                                    {replacement.replacement.name}
                                  </Typography>
                                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                    <Chip size="small" label={`${replacement.replacement.calories} kcal`} color="error" variant="outlined" />
                                    <Chip size="small" label={`P: ${replacement.replacement.protein}g`} variant="outlined" />
                                    <Chip size="small" label={`C: ${replacement.replacement.carbs}g`} variant="outlined" />
                                    <Chip size="small" label={`F: ${replacement.replacement.fat}g`} variant="outlined" />
                                    <Chip size="small" label={`Priority: ${replacement.priority}`} color="primary" variant="outlined" />
                                  </Stack>
                                  {replacement.notes && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                      {replacement.notes}
                                    </Typography>
                                  )}
                                </Box>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteReplacement(replacement.id)}
                                  title="Remove replacement"
                                >
                                  <Trash size={18} />
                                </IconButton>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              )}
            </>
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
        <DialogTitle>Import Food Items</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Select food items to add to your workspace
          </Typography>
          
          {loadingDefaults ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress />
                <Typography color="text.secondary">Loading default food items...</Typography>
              </Stack>
            </Box>
          ) : (
            <>
              {/* Search Bar */}
              <TextField
                fullWidth
                placeholder="Search food items by name, Arabic name, or category..."
                value={nutritionImportSearchTerm}
                onChange={(e) => {
                  setNutritionImportSearchTerm(e.target.value);
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
                  value={selectedNutritionCategory}
                  onChange={handleNutritionCategoryChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                >
                  <Tab label="All" value="all" />
                  {nutritionCategories.map((category) => (
                    <Tab key={category} label={category} value={category} />
                  ))}
                </Tabs>
              </Box>

              {/* Selection Controls */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.size} of {defaultItems.length} selected
                  {filteredNutritionItems.length !== defaultItems.length && (
                    <span> ({filteredNutritionItems.length} filtered, showing {paginatedNutritionItems.length} on this page)</span>
                  )}
                </Typography>
                <Button variant="outlined" size="small" onClick={handleSelectAllInNutritionCategory}>
                  {(() => {
                    const allPaginatedSelected = paginatedNutritionNames.size > 0 && Array.from(paginatedNutritionNames).every(name => selectedItems.has(name));
                    return allPaginatedSelected ? 'Deselect All Shown' : `Select All Shown (${paginatedNutritionItems.length})`;
                  })()}
                </Button>
                <Button variant="outlined" size="small" onClick={handleSelectAllImport}>
                  {selectedItems.size === defaultItems.length ? 'Deselect All' : `Select All (${defaultItems.length})`}
                </Button>
              </Stack>

              {/* Food Items Grid */}
              <Box>
                <Stack spacing={2}>
                  {paginatedNutritionItems.map((item) => {
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
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              {item.category && (
                                <Chip label={item.category} variant="outlined" size="small" color="secondary" />
                              )}
                            </Stack>
                            <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Calories: {item.calories}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Protein: {item.protein}g
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Carbs: {item.carbs}g
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Fat: {item.fat}g
                              </Typography>
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
                  {paginatedNutritionItems.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">
                        No food items found matching your criteria
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
              
              {/* Pagination */}
              {filteredNutritionItems.length > importRowsPerPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <TablePagination
                    component="div"
                    count={filteredNutritionItems.length}
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
    </Box>
    </WorkspaceSubscriptionGuard>
  );
}
