'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useIntl } from 'react-intl';
import api from '@/utils/axios';
import ResponsiveTable from '@/components/ResponsiveTable';
const WorkspaceSubscriptionGuard = dynamic(() => import('@/components/WorkspaceSubscriptionGuard'), { ssr: false });
import { useAppSelector, useAppDispatch } from '@/store';
import { setSubmittedCount } from '@/store/slices/queueSlice';

// MUI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import { AttachFile, Assignment, FilterList, Close } from '@mui/icons-material';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import { FormattedMessage } from 'react-intl';
import useMediaQuery from '@mui/material/useMediaQuery';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Checkbox from '@mui/material/Checkbox';
import Toolbar from '@mui/material/Toolbar';
import AppBar from '@mui/material/AppBar';
import TableSortLabel from '@mui/material/TableSortLabel';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Pagination from '@mui/material/Pagination';

type QueueStatus = 'pending' | 'sent' | 'completed' | 'archived';

interface QueueItem {
  id: string;
  clientId?: string;
  clientName: string;
  clientCode?: number | null;
  clientPackageName?: string | null;
  clientPackageDurationMonths?: number | null;
  formTitle: string;
  formType?: 'nutrition' | 'workout' | string | null;
  createdAt?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  status: QueueStatus;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedById?: string | null;
  assignedByName?: string | null;
  assignedAt?: string | null;
}

interface TeamMember {
  id: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  role: {
    id: string;
    name: string;
  };
}

interface QueueResponse {
  items: QueueItem[];
  hasFormsRead: boolean;
  assignedToMe: boolean;
}

function statusColor(s: QueueStatus) {
  switch (s) {
    case 'pending':
      return 'warning';
    case 'sent':
      return 'info';
    case 'completed':
      return 'success';
    case 'archived':
      return 'default';
    default:
      return 'default';
  }
}

function statusLabelIntl(intl: any, s: QueueStatus) {
  switch (s) {
    case 'pending':
      return intl.formatMessage({ id: 'queue.status.pending', defaultMessage: 'Schedules' });
    case 'sent':
      return intl.formatMessage({ id: 'queue.status.sent', defaultMessage: 'Form Requests' });
    case 'completed':
      return intl.formatMessage({ id: 'queue.status.completed', defaultMessage: 'Form Submissions' });
    case 'archived':
      return intl.formatMessage({ id: 'queue.status.archived', defaultMessage: 'Done' });
    default:
      return s;
  }
}

function formatFormType(intl: any, type?: string | null) {
  if (!type) return '';
  const t = String(type).toLowerCase();
  if (t === 'nutrition') return intl.formatMessage({ id: 'queue.type.nutrition', defaultMessage: 'Nutrition' });
  if (t === 'workout') return intl.formatMessage({ id: 'queue.type.workout', defaultMessage: 'Workout' });
  return type;
}

export default function QueuePage() {
  const intl = useIntl();
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<number>(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewSubmission, setViewSubmission] = useState<any | null>(null);
  
  // react-table states
  const [rowSelection, setRowSelection] = useState({});

  // Packages for filtering and display
  const [packages, setPackages] = useState<any[]>([]);

  // Filtering and search state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [activeColumnFilter, setActiveColumnFilter] = useState<'id' | 'client' | 'form' | 'package' | null>(null);
  const [packageMultiFilter, setPackageMultiFilter] = useState<string[]>([]);
  const [showPackageMultiSelect, setShowPackageMultiSelect] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Pagination state
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // New state for assignment functionality
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hasFormsRead, setHasFormsRead] = useState(true);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<QueueItem | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuSubmission, setMenuSubmission] = useState<QueueItem | null>(null);
  
  // Bulk selection state
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkSelectedAssignee, setBulkSelectedAssignee] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Advanced filters state
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    clientNames: [] as string[],
    clientCodes: [] as string[],
    packages: [] as string[],
    formTitles: [] as string[],
    formTypes: [] as string[],
    assignees: [] as string[],
    statuses: [] as string[],
    dateRange: {
      createdFrom: '',
      createdTo: '',
      scheduledFrom: '',
      scheduledTo: '',
      sentFrom: '',
      sentTo: '',
      completedFrom: '',
      completedTo: ''
    }
  });
  
  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    return {
      clientNames: [...new Set(items.map(item => item.clientName))].filter(Boolean).sort(),
      clientCodes: [...new Set(items.map(item => item.clientCode).filter(Boolean))].sort(),
      packages: [...new Set(items.map(item => item.clientPackageName).filter(Boolean))].sort(),
      formTitles: [...new Set(items.map(item => item.formTitle))].filter(Boolean).sort(),
      formTypes: [...new Set(items.map(item => item.formType).filter(Boolean))].sort(),
      assignees: [...new Set(items.map(item => item.assignedToName).filter(Boolean))].sort(),
      statuses: ['pending', 'sent', 'completed', 'archived']
    };
  }, [items]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const userId = useAppSelector((state) => state.auth.user?.id);
  const workspaceId = useAppSelector((state) => state.workspace.id);
  const dispatch = useAppDispatch();

  // Clear selection when tab changes
  useEffect(() => {
    setRowSelection({});
  }, [tab]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load queue with assignment filter
        const queueUrl = assignedToMe ? '/api/forms/queue?assignedToMe=true' : '/api/forms/queue';
        const queueRes = await api.get(queueUrl);
        const queueData: QueueResponse = queueRes.data;
        
        setItems(Array.isArray(queueData?.items) ? queueData.items : []);
        setHasFormsRead(queueData.hasFormsRead);
        setAssignedToMe(queueData.assignedToMe);
        
        // Update submitted count in Redux
        const completedCount = Array.isArray(queueData?.items)
          ? queueData.items.filter((item: QueueItem) => item.status === 'completed').length
          : 0;
        dispatch(setSubmittedCount(completedCount));
        
        // Load team members for assignment dropdown
        const membersRes = await api.get('/api/team/members');
        setTeamMembers(membersRes.data?.members || []);
      } catch {
        setError('Failed to load queue');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignedToMe]);

  // Load packages for package filter
  useEffect(() => {
    const loadPackages = async () => {
      try {
        if (!workspaceId) return;
        const res = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
        setPackages(res.data?.packages || []);
      } catch (err) {
        // Fallback: ignore if packages can't be loaded
        setPackages([]);
      }
    };

    loadPackages();
  }, [workspaceId]);


  const counts = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      sent: items.filter((i) => i.status === 'sent').length,
      completed: items.filter((i) => i.status === 'completed').length,
      archived: items.filter((i) => i.status === 'archived').length
    };
  }, [items]);

  // Filter and sort items
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = items.filter((it) => {
      const byStatus = statusFilter === 'all' ? true : it.status === statusFilter;

      let byText = true;
      if (q) {
        if (activeColumnFilter === 'id') {
          const codeStr = it.clientCode != null ? String(it.clientCode) : (it.clientId || '').toLowerCase();
          byText = codeStr.toLowerCase().includes(q);
        } else if (activeColumnFilter === 'client') {
          byText = it.clientName.toLowerCase().includes(q);
        } else if (activeColumnFilter === 'form') {
          byText = it.formTitle.toLowerCase().includes(q);
        } else if (activeColumnFilter === 'package') {
          byText = (it.clientPackageName || '').toLowerCase().includes(q);
        } else {
          byText = it.clientName.toLowerCase().includes(q) || it.formTitle.toLowerCase().includes(q);
        }
      }

      // Apply advanced filters
      let byAdvancedFilters = true;
      
      // Client names filter
      if (advancedFilters.clientNames.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.clientNames.includes(it.clientName);
      }
      
      // Client codes filter
      if (advancedFilters.clientCodes.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.clientCodes.includes(String(it.clientCode));
      }
      
      // Packages filter
      if (advancedFilters.packages.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.packages.includes(it.clientPackageName || '');
      }
      
      // Form titles filter
      if (advancedFilters.formTitles.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.formTitles.includes(it.formTitle);
      }
      
      // Form types filter
      if (advancedFilters.formTypes.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.formTypes.includes(it.formType || '');
      }
      
      // Assignees filter
      if (advancedFilters.assignees.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.assignees.includes(it.assignedToName || '');
      }
      
      // Statuses filter
      if (advancedFilters.statuses.length > 0) {
        byAdvancedFilters = byAdvancedFilters && advancedFilters.statuses.includes(it.status);
      }
      
      // Date range filters
      if (advancedFilters.dateRange.createdFrom) {
        const createdDate = it.createdAt ? new Date(it.createdAt) : null;
        const fromDate = new Date(advancedFilters.dateRange.createdFrom);
        byAdvancedFilters = byAdvancedFilters && (!createdDate || createdDate >= fromDate);
      }
      
      if (advancedFilters.dateRange.createdTo) {
        const createdDate = it.createdAt ? new Date(it.createdAt) : null;
        const toDate = new Date(advancedFilters.dateRange.createdTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        byAdvancedFilters = byAdvancedFilters && (!createdDate || createdDate <= toDate);
      }
      
      // Similar logic for other date filters...
      if (advancedFilters.dateRange.completedFrom) {
        const completedDate = it.completedAt ? new Date(it.completedAt) : null;
        const fromDate = new Date(advancedFilters.dateRange.completedFrom);
        byAdvancedFilters = byAdvancedFilters && (!completedDate || completedDate >= fromDate);
      }
      
      if (advancedFilters.dateRange.completedTo) {
        const completedDate = it.completedAt ? new Date(it.completedAt) : null;
        const toDate = new Date(advancedFilters.dateRange.completedTo);
        toDate.setHours(23, 59, 59, 999);
        byAdvancedFilters = byAdvancedFilters && (!completedDate || completedDate <= toDate);
      }

      return byStatus && byText && byAdvancedFilters;
    });

    // Apply package multi-select filter (if any) - keep for backward compatibility
    if (packageMultiFilter.length > 0) {
      result = result.filter((it) => packageMultiFilter.includes(it.clientPackageName || ''));
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];

      // Handle date sorting
      if (sortField === 'createdAt' || sortField === 'scheduledAt' || sortField === 'sentAt' || sortField === 'completedAt' || sortField === 'assignedAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      // Handle string sorting
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = typeof bVal === 'string' ? bVal.toLowerCase() : '';
      }

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return result;
  }, [items, search, statusFilter, sortField, sortDirection, activeColumnFilter, packageMultiFilter, advancedFilters]);

  // Get only completed items for bulk operations
  const completedItems = useMemo(() => {
    return filtered.filter(item => item.status === 'completed');
  }, [filtered]);

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(completedItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const isAllSelected = completedItems.length > 0 && selectedItems.size === completedItems.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < completedItems.length;

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, endIndex);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, search, assignedToMe, activeColumnFilter, packageMultiFilter, advancedFilters]);

  // Clear all advanced filters
  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      clientNames: [],
      clientCodes: [],
      packages: [],
      formTitles: [],
      formTypes: [],
      assignees: [],
      statuses: [],
      dateRange: {
        createdFrom: '',
        createdTo: '',
        scheduledFrom: '',
        scheduledTo: '',
        sentFrom: '',
        sentTo: '',
        completedFrom: '',
        completedTo: ''
      }
    });
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    Object.keys(advancedFilters).forEach(key => {
      if (key === 'dateRange') {
        const dates = advancedFilters.dateRange;
        count += Object.values(dates).filter(val => val).length;
      } else {
        count += (advancedFilters as any)[key].length;
      }
    });
    return count;
  }, [advancedFilters]);

  const openView = async (id: string) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewError(null);
    setViewSubmission(null);
    try {
      const res = await api.get(`/api/forms/submissions/${id}`);
      setViewSubmission(res.data?.submission || null);
    } catch {
      setViewError('Failed to load submission');
    } finally {
      setViewLoading(false);
    }
  };

  // Assignment handlers
  const openAssignDialog = (submission: QueueItem) => {
    setSelectedSubmission(submission);
    setSelectedAssignee('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedSubmission || !selectedAssignee) return;
    
    setAssigning(true);
    try {
      await api.post(`/api/forms/submissions/${selectedSubmission.id}/assign`, {
        assignedToId: selectedAssignee,
      });
      setAssignDialogOpen(false);
      // Reload queue
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign form');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (submission: QueueItem) => {
    try {
      await api.post(`/api/forms/submissions/${submission.id}/unassign`);
      // Reload queue
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unassign form');
    }
  };

  // Bulk assignment handlers
  const handleBulkAssignOpen = () => {
    setBulkSelectedAssignee('');
    setBulkAssignDialogOpen(true);
  };

  const handleBulkAssign = async () => {
    if (!bulkSelectedAssignee || selectedItems.size === 0) return;
    
    setBulkAssigning(true);
    try {
      // Assign all selected items
      const promises = Array.from(selectedItems).map(id => 
        api.post(`/api/forms/submissions/${id}/assign`, {
          assignedToId: bulkSelectedAssignee,
        })
      );
      
      await Promise.all(promises);
      setBulkAssignDialogOpen(false);
      setSelectedItems(new Set());
      // Reload queue
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign forms');
    } finally {
      setBulkAssigning(false);
    }
  };

  const openMenu = (event: React.MouseEvent<HTMLElement>, submission: QueueItem) => {
    setMenuAnchor(event.currentTarget);
    setMenuSubmission(submission);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuSubmission(null);
  };

  // Filter team members by appropriate permission
  const getFilteredTeamMembers = (formType: string) => {
    return teamMembers.filter(member => {
      // Owner can be assigned anything
      if (member.role.name === 'owner') return true;
      
      // Check permissions based on form type
      if (formType === 'nutrition') {
        // For nutrition forms, we need members with nutrition.manage permission
        // This is a simplified check - in a real app you'd check actual permissions
        return ['owner', 'admin', 'trainer'].includes(member.role.name);
      } else if (formType === 'workout') {
        // For workout forms, we need members with workout.manage permission
        return ['owner', 'admin', 'trainer'].includes(member.role.name);
      }
      
      return false;
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary"><FormattedMessage id="queue.loading" defaultMessage="Loading queue…" /></Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <WorkspaceSubscriptionGuard description="Activate a plan to access the forms queue and assignments.">
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4"><FormattedMessage id="queue.title" defaultMessage="Queue" /></Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Bulk Action Toolbar - Desktop */}
      {selectedItems.size > 0 && !isMobile && (
        <Box 
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'primary.contrastText',
            borderRadius: 1,
            py: 2,
            px: 3
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ flexGrow: 1 }}>
              {intl.formatMessage({ id: 'queue.selected.count', defaultMessage: '{count} selected' }, { count: selectedItems.size })}
            </Typography>
            <Button 
              variant="outlined"
              onClick={() => setSelectedItems(new Set())}
              sx={{ 
                borderColor: 'primary.light',
                color: 'primary.contrastText',
                '&:hover': {
                  borderColor: 'primary.dark',
                  bgcolor: 'action.hover'
                }
              }}
            >
              <FormattedMessage id="queue.clearSelection" defaultMessage="Clear Selection" />
            </Button>
            <Button 
              variant="contained"
              color="secondary"
              startIcon={<Assignment />}
              onClick={handleBulkAssignOpen}
              disabled={completedItems.length === 0}
              sx={{ 
                bgcolor: 'background.paper',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: 'background.default'
                }
              }}
            >
              <FormattedMessage id="queue.assignSelected" defaultMessage="Assign Selected" />
            </Button>
          </Stack>
        </Box>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              placeholder={
                activeColumnFilter === 'id' ? 'Search by ID' :
                activeColumnFilter === 'client' ? 'Search by client name' :
                activeColumnFilter === 'package' ? 'Search by package' :
                activeColumnFilter === 'form' ? 'Search by form title' :
                intl.formatMessage({ id: 'queue.search.placeholder', defaultMessage: 'Search by client or form title' })
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {hasFormsRead && (
              <FormControlLabel
                control={
                  <Switch
                    checked={assignedToMe}
                    onChange={(e) => setAssignedToMe(e.target.checked)}
                  />
                }
                label={intl.formatMessage({ id: 'queue.filter.assignedToMe', defaultMessage: 'Show My Assignments Only' })}
              />
            )}
          </Stack>

          {/* Column Filters (ID, Client, Package, Form) */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Button size="small" variant={activeColumnFilter === 'id' ? 'contained' : 'text'} onClick={() => { setActiveColumnFilter(activeColumnFilter === 'id' ? null : 'id'); setSearch(''); }}>
              #
            </Button>
            <Button size="small" variant={activeColumnFilter === 'client' ? 'contained' : 'text'} onClick={() => { setActiveColumnFilter(activeColumnFilter === 'client' ? null : 'client'); setSearch(''); }}>
              <FormattedMessage id="queue.col.client" defaultMessage="Client" />
            </Button>
            <Button size="small" variant={activeColumnFilter === 'package' ? 'contained' : 'text'} onClick={() => { setShowPackageMultiSelect(!showPackageMultiSelect); setActiveColumnFilter(showPackageMultiSelect ? null : 'package'); }}>
              <FormattedMessage id="queue.col.currentPackage" defaultMessage="Current Package" />
            </Button>
            <Button size="small" variant={activeColumnFilter === 'form' ? 'contained' : 'text'} onClick={() => { setActiveColumnFilter(activeColumnFilter === 'form' ? null : 'form'); setSearch(''); }}>
              <FormattedMessage id="queue.col.form" defaultMessage="Form" />
            </Button>
            
            {/* Advanced Filters Button */}
            <Button
              size="small"
              variant={activeFiltersCount > 0 ? 'contained' : 'outlined'}
              startIcon={<FilterList />}
              onClick={() => setAdvancedFiltersOpen(true)}
              sx={{ 
                ml: 2,
                position: 'relative',
                ...(activeFiltersCount > 0 && {
                  '&::after': {
                    content: `"${activeFiltersCount}"`,
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: 'error.main',
                    color: 'error.contrastText',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }
                })
              }}
            >
              Advanced Filters
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button
                size="small"
                variant="text"
                color="error"
                onClick={clearAdvancedFilters}
                sx={{ ml: 1 }}
              >
                Clear All
              </Button>
            )}
          </Stack>

          {/* Package multi-select */}
          {showPackageMultiSelect && (
            <Box sx={{ mb: 2 }}>
              <FormControl sx={{ minWidth: 240 }}>
                <InputLabel id="package-multi-select-label">Package</InputLabel>
                <Select
                  labelId="package-multi-select-label"
                  multiple
                  value={packageMultiFilter}
                  onChange={(event) => setPackageMultiFilter(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
                  label="Package"
                  renderValue={(selected) => (selected as string[]).join(', ')}
                  size="small"
                >
                    {packages.map((pkg) => (
                    <MenuItem key={pkg.id} value={pkg.name}>
                      <Checkbox checked={packageMultiFilter.indexOf(pkg.name) > -1} />
                      <ListItemText primary={pkg.name} secondary={`${pkg.durationMonths} month${pkg.durationMonths === 1 ? '' : 's'}`} />
                    </MenuItem>
                  ))}
                </Select>
                <Button size="small" onClick={() => { setShowPackageMultiSelect(false); }} sx={{ mt: 1 }}>Done</Button>
              </FormControl>
            </Box>
          )}

          {/* Status Tabs */}
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              const map = ['all', 'pending', 'sent', 'completed', 'archived'] as const;
              setStatusFilter(map[v] as QueueStatus | 'all');
            }}
            sx={{ mb: 2 }}
          >
            <Tab label={`${intl.formatMessage({ id: 'queue.tab.all', defaultMessage: 'All' })} (${counts.all})`} />
            <Tab label={`${intl.formatMessage({ id: 'queue.status.pending', defaultMessage: 'Schedules' })} (${counts.pending})`} />
            <Tab label={`${intl.formatMessage({ id: 'queue.status.sent', defaultMessage: 'Form Requests' })} (${counts.sent})`} />
            <Tab label={`${intl.formatMessage({ id: 'queue.status.completed', defaultMessage: 'Form Submissions' })} (${counts.completed})`} />
            <Tab label={`${intl.formatMessage({ id: 'queue.status.archived', defaultMessage: 'Done' })} (${counts.archived})`} />
          </Tabs>

          {isMobile ? (
            // Mobile Cards View
            <Grid container spacing={2}>
              {/* Bulk Action Bar for Mobile (for completed status only) */}
              {tab === 3 && completedItems.length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Checkbox
                          checked={isAllSelected}
                          indeterminate={isSomeSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                        <Typography>
                          {intl.formatMessage({ id: 'queue.selectAll', defaultMessage: 'Select All ({count})' }, { count: completedItems.length })}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {selectedItems.size > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                    <CardContent>
                      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <Typography>
                          {selectedItems.size} selected
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button 
                            size="small" 
                            variant="outlined"
                            onClick={() => setSelectedItems(new Set())}
                            sx={{ 
                              borderColor: 'primary.light',
                              color: 'primary.contrastText',
                              '&:hover': {
                                borderColor: 'primary.dark',
                                bgcolor: 'action.hover'
                              }
                            }}
                          >
                            <FormattedMessage id="queue.clear" defaultMessage="Clear" />
                          </Button>
                          <Button 
                            size="small" 
                            variant="contained"
                            color="secondary"
                            startIcon={<Assignment />}
                            onClick={handleBulkAssignOpen}
                            sx={{ 
                              bgcolor: 'background.paper',
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: 'background.default'
                              }
                            }}
                          >
                            <FormattedMessage id="queue.assign" defaultMessage="Assign" />
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {filtered.map((row) => (
                <Grid item xs={12} key={row.id}>
                  <Card 
                    sx={{ 
                      transition: 'all 0.2s',
                      border: selectedItems.has(row.id) ? '2px solid' : undefined,
                      borderColor: selectedItems.has(row.id) ? 'primary.main' : undefined,
                      '&:hover': {
                        boxShadow: 4,
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <CardContent>
                      <Stack spacing={2}>
                        {/* Header with Checkbox (only for completed status), Avatar and Status */}
                        <Stack direction="row" spacing={2} alignItems="center">
                          {row.status === 'completed' && hasFormsRead && (
                            <Checkbox
                              checked={selectedItems.has(row.id)}
                              onChange={(e) => handleSelectItem(row.id, e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {row.clientName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6">
                              {row.clientName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {(isArabic ? (row as any).formTitleArabic : undefined) || row.formTitle}
                            </Typography>
                            {row.clientCode && (
                              <Typography variant="caption" color="text.secondary">
                                ID: {row.clientCode}
                              </Typography>
                            )}
                          </Box>
                          <Chip 
                            size="small" 
                            color={statusColor(row.status) as any} 
                            label={statusLabelIntl(intl, row.status)} 
                            variant="outlined" 
                          />
                        </Stack>

                        <Divider />

                        {/* Form Type */}
                        {row.formType && (
                          <Box>
                            <Chip 
                              size="small" 
                              label={formatFormType(intl, row.formType)} 
                              variant="outlined"
                              color="primary"
                            />
                          </Box>
                        )}

                        {/* Assignment Info */}
                        {row.assignedToName && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Assigned to: {row.assignedToName}
                            </Typography>
                            {row.assignedAt && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Assigned: {new Date(row.assignedAt).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                        )}

                        <Divider />

                        {/* Timeline Details */}
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Created At
                            </Typography>
                            <Typography variant="body2">
                              {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Scheduled
                            </Typography>
                            <Typography variant="body2">
                              {row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Sent
                            </Typography>
                            <Typography variant="body2">
                              {row.sentAt ? new Date(row.sentAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Completed
                            </Typography>
                            <Typography variant="body2">
                              {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Grid>
                        </Grid>

                        <Divider />

                        {/* Actions */}
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          {row.status === 'completed' && (
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => openView(row.id)}
                            >
                              <FormattedMessage id="queue.viewSubmission" defaultMessage="View Submission" />
                            </Button>
                          )}
                          
                          {/* Assignment Actions */}
                          {row.status === 'completed' && hasFormsRead && !row.assignedToId && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Assignment />}
                              onClick={() => openAssignDialog(row)}
                            >
                              <FormattedMessage id="queue.assign" defaultMessage="Assign" />
                            </Button>
                          )}
                          
                          {/* Create Plan Actions */}
                          {row.status === 'completed' && row.formType && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Assignment />}
                              onClick={() => {
                                if (row.formType === 'nutrition') {
                                  window.location.href = `/dashboard/clients/${row.clientId}/nutrition`;
                                } else if (row.formType === 'workout') {
                                  window.location.href = `/dashboard/clients/${row.clientId}/workout`;
                                } else {
                                  // For "other" type, just go to client page
                                  window.location.href = `/dashboard/clients/${row.clientId}`;
                                }
                              }}
                            >
                              {row.formType === 'other' 
                                ? intl.formatMessage({ id: 'queue.viewClient', defaultMessage: 'View Client' })
                                : intl.formatMessage({ id: 'queue.makePlan', defaultMessage: 'Make {type} Plan' }, { type: row.formType === 'nutrition' ? intl.formatMessage({ id: 'queue.type.nutrition', defaultMessage: 'Nutrition' }) : intl.formatMessage({ id: 'queue.type.workout', defaultMessage: 'Workout' }) })
                              }
                            </Button>
                          )}
                          
                          {/* Menu for additional actions */}
                          {hasFormsRead && (
                            <IconButton
                              size="small"
                              onClick={(e) => openMenu(e, row)}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          )}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                  ))}
                  {paginatedItems.length === 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                        <FormattedMessage id="queue.empty" defaultMessage="No queue items match your filters" />
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          ) : (
            // Desktop Table View
            <ResponsiveTable minWidth={900}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      {tab === 3 && completedItems.length > 0 && (
                        <Checkbox
                          indeterminate={isSomeSelected}
                          checked={isAllSelected}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'clientName'}
                        direction={sortField === 'clientName' ? sortDirection : 'asc'}
                        onClick={() => handleSort('clientName')}
                        IconComponent={sortField === 'clientName' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.client" defaultMessage="Client" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <TableSortLabel
                        active={sortField === 'clientCode'}
                        direction={sortField === 'clientCode' ? sortDirection : 'asc'}
                        onClick={() => handleSort('clientCode')}
                        IconComponent={sortField === 'clientCode' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.clientId" defaultMessage="Client ID" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'clientPackageName'}
                        direction={sortField === 'clientPackageName' ? sortDirection : 'asc'}
                        onClick={() => handleSort('clientPackageName')}
                        IconComponent={sortField === 'clientPackageName' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.currentPackage" defaultMessage="Current Package" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'formTitle'}
                        direction={sortField === 'formTitle' ? sortDirection : 'asc'}
                        onClick={() => handleSort('formTitle')}
                        IconComponent={sortField === 'formTitle' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.form" defaultMessage="Form" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'assignedToName'}
                        direction={sortField === 'assignedToName' ? sortDirection : 'asc'}
                        onClick={() => handleSort('assignedToName')}
                        IconComponent={sortField === 'assignedToName' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.assignedTo" defaultMessage="Assigned To" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <TableSortLabel
                        active={sortField === 'createdAt'}
                        direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('createdAt')}
                        IconComponent={sortField === 'createdAt' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.createdAt" defaultMessage="Created At" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <TableSortLabel
                        active={sortField === 'scheduledAt'}
                        direction={sortField === 'scheduledAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('scheduledAt')}
                        IconComponent={sortField === 'scheduledAt' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.scheduledAt" defaultMessage="Scheduled" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <TableSortLabel
                        active={sortField === 'sentAt'}
                        direction={sortField === 'sentAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('sentAt')}
                        IconComponent={sortField === 'sentAt' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.sentAt" defaultMessage="Sent" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <TableSortLabel
                        active={sortField === 'completedAt'}
                        direction={sortField === 'completedAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('completedAt')}
                        IconComponent={sortField === 'completedAt' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.completedAt" defaultMessage="Completed" />
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'status'}
                        direction={sortField === 'status' ? sortDirection : 'asc'}
                        onClick={() => handleSort('status')}
                        IconComponent={sortField === 'status' ? (sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : undefined}
                      >
                        <FormattedMessage id="queue.col.status" defaultMessage="Status" />
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedItems.map((row) => (
                    <TableRow 
                      key={row.id}
                      sx={{
                        backgroundColor: selectedItems.has(row.id) ? 'action.selected' : undefined
                      }}
                    >
                      <TableCell padding="checkbox">
                        {row.status === 'completed' && hasFormsRead && (
                          <Checkbox
                            checked={selectedItems.has(row.id)}
                            onChange={(e) => handleSelectItem(row.id, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </TableCell>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.clientCode ?? '-'}</TableCell>
                      <TableCell>
                        {row.clientPackageName ? (
                          <Box>
                            <Typography variant="body2">{row.clientPackageName}</Typography>
                            {row.clientPackageDurationMonths && (
                              <Typography variant="caption" color="text.secondary">
                                {row.clientPackageDurationMonths} {row.clientPackageDurationMonths === 1 ? 'month' : 'months'}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {(isArabic ? (row as any).formTitleArabic : undefined) || row.formTitle}
                        {row.formType ? <Chip size="small" label={formatFormType(intl, row.formType)} sx={{ ml: 1 }} /> : null}
                      </TableCell>
                      <TableCell>
                        {row.assignedToName ? (
                          <Box>
                            <Typography variant="body2">{row.assignedToName}</Typography>
                            {row.assignedAt && (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(row.assignedAt).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : '-'}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.sentAt ? new Date(row.sentAt).toLocaleString() : '-'}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{row.completedAt ? new Date(row.completedAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color={statusColor(row.status) as any} label={statusLabelIntl(intl, row.status)} variant="outlined" />
                          {row.status === 'completed' && (
                            <Button size="small" variant="outlined" onClick={() => openView(row.id)}><FormattedMessage id="queue.view" defaultMessage="View" /></Button>
                          )}
                          
                          {/* Assignment Actions */}
                          {row.status === 'completed' && hasFormsRead && !row.assignedToId && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Assignment />}
                              onClick={() => openAssignDialog(row)}
                            >
                              <FormattedMessage id="queue.assign" defaultMessage="Assign" />
                            </Button>
                          )}
                          
                          {/* Create Plan Actions */}
                          {row.status === 'completed' && row.formType && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Assignment />}
                              onClick={() => {
                                if (row.formType === 'nutrition') {
                                  window.location.href = `/dashboard/clients/${row.clientId}/nutrition`;
                                } else if (row.formType === 'workout') {
                                  window.location.href = `/dashboard/clients/${row.clientId}/workout`;
                                } else {
                                  // For "other" type, just go to client page
                                  window.location.href = `/dashboard/clients/${row.clientId}`;
                                }
                              }}
                            >
                              <FormattedMessage id="queue.makePlan.short" defaultMessage="Make Plan" />
                            </Button>
                          )}
                          
                          {/* Menu for additional actions */}
                          {hasFormsRead && (
                            <IconButton
                              size="small"
                              onClick={(e) => openMenu(e, row)}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                          <FormattedMessage id="queue.empty" defaultMessage="No queue items match your filters" />
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size={isMobile ? 'small' : 'medium'}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters Dialog */}
      <Dialog 
        open={advancedFiltersOpen} 
        onClose={() => setAdvancedFiltersOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Advanced Filters
          <IconButton onClick={() => setAdvancedFiltersOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Filters Section Header */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ 
                fontSize: '1.3rem', 
                fontWeight: 700,
                color: 'text.primary',
                mb: 1,
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Filter Options
              </Typography>
            </Grid>

            {/* First Row - Primary Filters */}
            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
                display: 'block'
              }}>
                Client Names
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.clientNames}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    clientNames: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select clients...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.clientNames.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={advancedFilters.clientNames.includes(name)} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'secondary.main',
                mb: 1,
                display: 'block'
              }}>
                Client IDs
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.clientCodes}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    clientCodes: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(156, 39, 176, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select IDs...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.clientCodes.map((code) => (
                    <MenuItem key={code} value={String(code)}>
                      <Checkbox checked={advancedFilters.clientCodes.includes(String(code))} />
                      <ListItemText primary={code} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'success.main',
                mb: 1,
                display: 'block'
              }}>
                Packages
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.packages}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    packages: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select packages...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.packages.map((pkg) => (
                    <MenuItem key={pkg} value={pkg}>
                      <Checkbox checked={advancedFilters.packages.includes(pkg)} />
                      <ListItemText primary={pkg} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'warning.main',
                mb: 1,
                display: 'block'
              }}>
                Form Titles
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.formTitles}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    formTitles: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select forms...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.formTitles.map((title) => (
                    <MenuItem key={title} value={title}>
                      <Checkbox checked={advancedFilters.formTitles.includes(title)} />
                      <ListItemText primary={title} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Second Row - Additional Filters */}
            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'info.main',
                mb: 1,
                display: 'block'
              }}>
                Form Types
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.formTypes}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    formTypes: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select types...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={formatFormType(intl, value)} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.formTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      <Checkbox checked={advancedFilters.formTypes.includes(type)} />
                      <ListItemText primary={formatFormType(intl, type)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'error.main',
                mb: 1,
                display: 'block'
              }}>
                Assigned To
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.assignees}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    assignees: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select assignees...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.assignees.map((assignee) => (
                    <MenuItem key={assignee} value={assignee}>
                      <Checkbox checked={advancedFilters.assignees.includes(assignee)} />
                      <ListItemText primary={assignee} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={4} lg={3}>
              <Typography variant="subtitle1" sx={{ 
                fontSize: '1.1rem', 
                fontWeight: 600,
                color: 'primary.dark',
                mb: 1,
                display: 'block'
              }}>
                Status
              </Typography>
              <FormControl fullWidth sx={{ minHeight: 70 }}>
                <Select
                  multiple
                  value={advancedFilters.statuses}
                  onChange={(e) => setAdvancedFilters(prev => ({
                    ...prev,
                    statuses: typeof e.target.value === 'string' ? [e.target.value] : e.target.value
                  }))}
                  sx={{ 
                    minHeight: 60,
                    '& .MuiSelect-select': {
                      minHeight: 60,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.95rem'
                    },
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)',
                    borderRadius: 2
                  }}
                  displayEmpty
                  renderValue={(selected) => (
                    selected.length === 0 ? (
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
                        Select status...
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={statusLabelIntl(intl, value as QueueStatus)} size="small" sx={{ fontSize: '0.75rem' }} />
                        ))}
                      </Box>
                    )
                  )}
                >
                  {filterOptions.statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      <Checkbox checked={advancedFilters.statuses.includes(status)} />
                      <ListItemText primary={statusLabelIntl(intl, status as QueueStatus)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Spacer for better layout on large screens */}
            <Grid item xs={6} sm={4} lg={3} sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Box sx={{ minHeight: 85 }} />
            </Grid>

            {/* Date Range Filters */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontSize: '1.2rem', 
                fontWeight: 600,
                color: 'text.primary',
                mt: 2
              }}>
                Date Ranges
              </Typography>
            </Grid>

            {/* Created Date Range */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Created From"
                value={advancedFilters.dateRange.createdFrom}
                onChange={(e) => setAdvancedFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, createdFrom: e.target.value }
                }))}
                InputLabelProps={{ 
                  shrink: true,
                  sx: {
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: 'primary.main'
                  }
                }}
                sx={{
                  minHeight: 80,
                  '& .MuiInputBase-root': {
                    minHeight: 56,
                    fontSize: '1rem'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Created To"
                value={advancedFilters.dateRange.createdTo}
                onChange={(e) => setAdvancedFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, createdTo: e.target.value }
                }))}
                InputLabelProps={{ 
                  shrink: true,
                  sx: {
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: 'primary.main'
                  }
                }}
                sx={{
                  minHeight: 80,
                  '& .MuiInputBase-root': {
                    minHeight: 56,
                    fontSize: '1rem'
                  }
                }}
              />
            </Grid>

            {/* Completed Date Range */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Completed From"
                value={advancedFilters.dateRange.completedFrom}
                onChange={(e) => setAdvancedFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, completedFrom: e.target.value }
                }))}
                InputLabelProps={{ 
                  shrink: true,
                  sx: {
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: 'success.main'
                  }
                }}
                sx={{
                  minHeight: 80,
                  '& .MuiInputBase-root': {
                    minHeight: 56,
                    fontSize: '1rem'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Completed To"
                value={advancedFilters.dateRange.completedTo}
                onChange={(e) => setAdvancedFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, completedTo: e.target.value }
                }))}
                InputLabelProps={{ 
                  shrink: true,
                  sx: {
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: 'success.main'
                  }
                }}
                sx={{
                  minHeight: 80,
                  '& .MuiInputBase-root': {
                    minHeight: 56,
                    fontSize: '1rem'
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearAdvancedFilters} color="error">
            Clear All
          </Button>
          <Button onClick={() => setAdvancedFiltersOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setAdvancedFiltersOpen(false)} variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Submission Dialog */}
      <Dialog fullWidth maxWidth="md" open={viewOpen} onClose={() => setViewOpen(false)}>
        <DialogTitle>{(isArabic ? (viewSubmission as any)?.form?.titleArabic : undefined) || viewSubmission?.form?.title || 'Form Submission'}</DialogTitle>
        <DialogContent dividers>
          {viewLoading && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          )}
          {viewError && <Alert severity="error">{viewError}</Alert>}
          {!viewLoading && !viewError && viewSubmission && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">{viewSubmission.form?.title || 'Form'}</Typography>
                <Chip size="small" color="success" label="Submitted" />
              </Stack>
              <Typography variant="caption" color="text.secondary">{viewSubmission.updatedAt ? `Submitted ${new Date(viewSubmission.updatedAt).toLocaleString()}` : ''}</Typography>
              <Box sx={{ mt: 2 }}>
                {Array.isArray(viewSubmission.form?.questions) ? (
                  <Stack spacing={1.5}>
                    {viewSubmission.form.questions.map((q: any, idx: number) => {
                      const qid = q.id || `q_${idx}`;
                      const label = (isArabic ? q.questionArabic || q.labelArabic : undefined) || q.question || q.label || `Question ${idx + 1}`;
                      const val = viewSubmission.answers ? viewSubmission.answers[qid] : undefined;
                      let display: any = val;
                      
                      // Handle different value types
                      if (Array.isArray(val)) {
                        display = val.join(', ');
                      } else if (val === true) {
                        display = 'Yes';
                      } else if (val === false) {
                        display = 'No';
                      } else if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
                        display = '—';
                      } else if (typeof val === 'object' && val !== null) {
                        // Handle attachment objects
                        if (val.originalName && val.url) {
                          display = (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AttachFile fontSize="small" />
                              <Button
                                size="small"
                                variant="outlined"
                                href={val.url}
                                target="_blank"
                                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                              >
                                {val.originalName} ({(val.size / 1024).toFixed(1)} KB)
                              </Button>
                            </Box>
                          );
                        } else {
                          display = JSON.stringify(val, null, 2);
                        }
                      }
                      
                      return (
                        <Card key={qid} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
                            {typeof display === 'string' ? (
                              <Typography variant="body2" color="text.secondary">{display}</Typography>
                            ) : (
                              display
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  viewSubmission.answers && typeof viewSubmission.answers === 'object' ? (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
{JSON.stringify(viewSubmission.answers, null, 2)}
                    </pre>
                  ) : (
                    <Typography color="text.secondary">No answers data.</Typography>
                  )
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Form</DialogTitle>
        <DialogContent>
          {selectedSubmission && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Assign "{selectedSubmission.formTitle}" to a team member
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Team Member</InputLabel>
                <Select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  label="Team Member"
                >
                  {getFilteredTeamMembers(selectedSubmission.formType || '').map((member) => (
                    <MenuItem key={member.user.id} value={member.user.id}>
                      <Box>
                        <Typography variant="body2">{member.user.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.role.name}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAssign} 
            variant="contained" 
            disabled={!selectedAssignee || assigning}
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkAssignDialogOpen} onClose={() => setBulkAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign {selectedItems.size} Form{selectedItems.size > 1 ? 's' : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Assign {selectedItems.size} selected form{selectedItems.size > 1 ? 's' : ''} to a team member
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Team Member</InputLabel>
              <Select
                value={bulkSelectedAssignee}
                onChange={(e) => setBulkSelectedAssignee(e.target.value)}
                label="Team Member"
              >
                {teamMembers.map((member) => (
                  <MenuItem key={member.user.id} value={member.user.id}>
                    <Box>
                      <Typography variant="body2">{member.user.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.role.name}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAssignDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleBulkAssign} 
            variant="contained" 
            disabled={!bulkSelectedAssignee || bulkAssigning}
          >
            {bulkAssigning ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
      >
        {menuSubmission && (
          <>
            {menuSubmission.assignedToId && (
              <MenuItem onClick={() => {
                handleUnassign(menuSubmission);
                closeMenu();
              }}>
                <ListItemIcon>
                  <Assignment fontSize="small" />
                </ListItemIcon>
                <ListItemText>Unassign</ListItemText>
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </Box>
    </WorkspaceSubscriptionGuard>
  );
}





