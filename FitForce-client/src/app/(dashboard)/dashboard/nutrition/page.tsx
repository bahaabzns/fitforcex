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
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

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

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
    label: 'Food Name'
  },
  {
    id: 'calories',
    numeric: true,
    disablePadding: false,
    label: 'Calories (per 100g)'
  },
  {
    id: 'protein',
    numeric: true,
    disablePadding: false,
    label: 'Protein (g)'
  },
  {
    id: 'carbs',
    numeric: true,
    disablePadding: false,
    label: 'Carbs (g)'
  },
  {
    id: 'fat',
    numeric: true,
    disablePadding: false,
    label: 'Fat (g)'
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

export default function NutritionPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Form states
  const [newFoodItem, setNewFoodItem] = useState({
    name: '',
    nameArabic: '',
    category: '',
    categoryArabic: '',
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

  const handleCreate = async () => {
    if (!newFoodItem.name.trim() || newFoodItem.calories <= 0) {
      setError('Please provide a name and valid calories');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await api.post('/api/nutrition/food-items', newFoodItem);
      setIsCreateDialogOpen(false);
      setNewFoodItem({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
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
      await api.put(`/api/nutrition/food-items/${selectedFoodItem.id}`, selectedFoodItem);
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

  // Import handlers
  const handleOpenImport = async () => {
    setIsImportDialogOpen(true);
    setLoadingDefaults(true);
    setError(null);
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
      setSelectedItems(new Set());
      // Refresh the list
      const response = await api.get('/api/nutrition/food-items');
      setFoodItems(response.data.foodItems || []);
    } catch {
      setError('Failed to import food items');
    } finally {
      setImporting(false);
    }
  };

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
            Nutrition
          </Typography>
          <Typography color="text.secondary">Manage food items and nutrition plans</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={<DocumentUpload />} onClick={handleOpenImport}>
            Import Items
          </Button>
          {foodItems.length > 0 && (
            <Button variant="outlined" color="error" startIcon={<Warning2 />} onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setIsCreateDialogOpen(true)}>
            Add Food Item
          </Button>
        </Stack>
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
          secondary={<CSVExport data={selectedValue.length > 0 ? selectedValue : foodItems} filename={'food-items.csv'} />}
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
                rowCount={foodItems.length}
              />
              <TableBody>
                {stableSort(foodItems, getComparator(order, orderBy))
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
          </TableContainer>
          <Divider />
          {/* table pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={foodItems.length}
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
            <TextField
              fullWidth
              label="Category (Arabic)"
              value={newFoodItem.categoryArabic}
              onChange={(e) => setNewFoodItem((prev) => ({ ...prev, categoryArabic: e.target.value }))}
            />
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
                label="Calories (per 100g)"
                type="number"
                value={newFoodItem.calories}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, calories: parseInt(e.target.value) || 0 }))}
                placeholder="165"
              />
              <TextField
                fullWidth
                label="Protein (g)"
                type="number"
                value={newFoodItem.protein}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
                placeholder="31"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="Carbs (g)"
                type="number"
                value={newFoodItem.carbs}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
              <TextField
                fullWidth
                label="Fat (g)"
                type="number"
                value={newFoodItem.fat}
                onChange={(e) => setNewFoodItem((prev) => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
                placeholder="3.6"
              />
            </Stack>

            {/* Optional micronutrients */}
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
        <DialogTitle>Edit Food Item</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Update the nutritional information for this food item
          </Typography>
          {selectedFoodItem && (
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Food Name"
                value={selectedFoodItem.name}
                onChange={(e) => setSelectedFoodItem((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                placeholder="e.g., Chicken Breast"
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  label="Calories (per 100g)"
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
              {/* Selection Controls */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.size} of {defaultItems.length} selected
                </Typography>
                <Button variant="outlined" size="small" onClick={handleSelectAllImport}>
                  {selectedItems.size === defaultItems.length ? 'Deselect All' : `Select All (${defaultItems.length})`}
                </Button>
              </Stack>

              {/* Food Items Grid */}
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
