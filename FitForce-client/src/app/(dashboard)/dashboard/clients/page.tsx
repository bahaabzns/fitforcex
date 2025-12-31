'use client';

import { useEffect, useMemo, useState, Fragment, MouseEvent, useCallback } from 'react';
import Link from 'next/link';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';

// MUI
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

// Third-party
import { LabelKeyObject } from 'react-csv/lib/core';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  FilterFn
} from '@tanstack/react-table';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Project imports
import Avatar from 'components/@extended/Avatar';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import ResponsiveTable from 'components/ResponsiveTable';
import CreateClientWizard from 'components/CreateClientWizard';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  CSVExport,
  DebouncedInput,
  HeaderSort,
  IndeterminateCheckbox,
  RowSelection,
  SelectColumnSorting,
  TablePagination
} from 'components/third-party/react-table';

// Assets
import { Add, Edit, Eye, Trash, Grid3, Menu } from '@wandersonalwes/iconsax-react';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import useConfig from '@/hooks/useConfig';

// Import translations
import ar from '@/utils/locales/ar.json';
import en from '@/utils/locales/en.json';

const translations: Record<string, Record<string, string>> = {
  ar,
  en,
};

type Client = {
  id: string;
  fullName?: string;
  name?: string;
  email?: string | null;
  workspaceEmail?: string | null;
  phone?: string | null;
  status?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  packageDuration?: number | null;
  createdAt?: string;
  // Plaintext password visible to coaches
  password?: string | null;
};

type TableDensity = 'compact';

export default function ClientsPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { i18n } = useConfig();
  const currentLang = i18n || 'en';
  
  const t = (key: string): string => {
    return translations[currentLang]?.[key] || translations['en'][key] || key;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState<boolean>(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [tableDensity, setTableDensity] = useState<TableDensity>('compact');
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Active, 1 = Archived

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active', color: 'success' },
    { value: 'pre_start', label: 'Pre-Start', color: 'info' },
    { value: 'frozen', label: 'Frozen', color: 'warning' },
    { value: 'expired', label: 'Expired', color: 'error' },
    { value: 'pending', label: 'Pending', color: 'warning' },
    { value: 'no_subscription', label: 'No-Sub', color: 'default' },
    { value: 'refunded', label: 'Refunded', color: 'default' },
    { value: 'inactive', label: 'Inactive', color: 'error' },
  ];

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviting, setInviting] = useState(false);
  
  // Validation states for invite form
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [invitePhoneError, setInvitePhoneError] = useState<string | null>(null);

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWorkspaceEmail, setEditWorkspaceEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  // Validation states for edit form
  const [editEmailError, setEditEmailError] = useState<string | null>(null);
  const [editWorkspaceEmailError, setEditWorkspaceEmailError] = useState<string | null>(null);
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);

  // Create client wizard
  const [createWizardOpen, setCreateWizardOpen] = useState(false);

  // Delete client
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk form assignment
  const [bulkFormDialogOpen, setBulkFormDialogOpen] = useState(false);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [assigningForm, setAssigningForm] = useState(false);
  
  // Form scheduling options
  const [formAssignmentType, setFormAssignmentType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);

  // Password management
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Packages for filtering and display
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    const fetchClients = async () => {
      setLoading(true);
      setError(null);
      try {
        const isArchived = activeTab === 1;
        const res = await api.get('/api/clients', {
          params: isArchived ? { archived: 'true' } : {}
        });
        setClients(Array.isArray(res.data?.clients) ? res.data.clients : []);
      } catch (e: any) {
        const status = e?.response?.status;
        const message: string = e?.response?.data?.error || e?.response?.data?.message || '';
        const isSubscriptionError = status === 402 || status === 404 || (typeof message === 'string' && message.toLowerCase().includes('subscription')) || (typeof message === 'string' && message.toLowerCase().includes('workspace_subscription_required'));
        if (isSubscriptionError) {
          setSubscriptionRequired(true);
          setError('Workspace subscription required');
        } else {
          setError('Failed to load clients');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [workspaceId, activeTab]);

  // Load packages and forms
  useEffect(() => {
    if (!workspaceId) return;
    
    const loadData = async () => {
      try {
        // Load packages
        const packagesRes = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
        setPackages(packagesRes.data.packages || []);

        // Load form templates
        const formsRes = await api.get('/api/forms/templates');
        setFormTemplates(formsRes.data.templates || []);
      } catch (err) {
        console.error('Error loading packages and forms:', err);
      }
    };

    loadData();
  }, [workspaceId]);




  const refreshClients = async () => {
    try {
      console.log('Refreshing clients...');
      const isArchived = activeTab === 1;
      const res = await api.get('/api/clients', {
        params: isArchived ? { archived: 'true' } : {}
      });
      const clients = Array.isArray(res.data?.clients) ? res.data.clients : [];
      console.log('Refreshed clients:', clients.length);
      setClients(clients);
      setSubscriptionRequired(false);
      setError(null);
    } catch (e) {
      console.error('Failed to refresh clients:', e);
      const status = (e as any)?.response?.status;
      const message: string = (e as any)?.response?.data?.error || (e as any)?.response?.data?.message || '';
      const isSubscriptionError = status === 402 || status === 404 || (typeof message === 'string' && message.toLowerCase().includes('subscription')) || (typeof message === 'string' && message.toLowerCase().includes('workspace_subscription_required'));
      if (isSubscriptionError) {
        setSubscriptionRequired(true);
        setError('Workspace subscription required');
      } else {
        setError('Failed to load clients');
      }
    }
  };

  // Validation functions for invite form
  const validateInviteEmail = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setInviteEmailError(null);
      return;
    }

    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.email && client.email.toLowerCase() === emailValue.toLowerCase()
      );
      
      if (existingClient) {
        setInviteEmailError('A client with this email already exists in this workspace');
      } else {
        setInviteEmailError(null);
      }
    } catch (err) {
      console.error('Error validating email:', err);
      setInviteEmailError(null);
    }
  };

  const validateInvitePhone = async (phoneValue: string) => {
    if (!phoneValue || phoneValue.trim().length < 5) {
      setInvitePhoneError(null);
      return;
    }

    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.phone && client.phone === phoneValue
      );
      
      if (existingClient) {
        setInvitePhoneError('A client with this phone number already exists in this workspace');
      } else {
        setInvitePhoneError(null);
      }
    } catch (err) {
      console.error('Error validating phone:', err);
      setInvitePhoneError(null);
    }
  };

  const inviteClient = async () => {
    if (!fullName.trim()) return;
    
    // Check for validation errors
    if (inviteEmailError || invitePhoneError) {
      setError('Please fix the validation errors before inviting');
      return;
    }
    
    setInviting(true);
    setError(null);
    try {
      await api.post('/api/clients/invite', {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined
      });
      setShowForm(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setInviteEmailError(null);
      setInvitePhoneError(null);
      // refresh list
      const res = await api.get('/api/clients');
      setClients(Array.isArray(res.data?.clients) ? res.data.clients : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to invite client');
    } finally {
      setInviting(false);
    }
  };

  const handleBulkFormAssignment = async () => {
    if (!selectedFormId) {
      setError('Please select a form');
      return;
    }

    // Validate duration if scheduling is selected
    if (formAssignmentType === 'scheduled' && (!durationDays || durationDays <= 0)) {
      setError('Please enter a valid duration in days');
      return;
    }

    // Get actual client IDs from selected rows
    const selectedRows = table.getSelectedRowModel().flatRows;
    const selectedClientIds = selectedRows.map(row => row.original.id);
    
    if (selectedClientIds.length === 0) {
      setError('No clients selected');
      return;
    }

    setAssigningForm(true);
    setError(null);

    try {
      // Send form to each selected client
      for (const clientId of selectedClientIds) {
        const requestData: any = {
          formId: selectedFormId,
          clientId,
        };

        // Add scheduleAt if scheduling is selected
        if (formAssignmentType === 'scheduled') {
          const now = new Date();
          const scheduledDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
          requestData.scheduleAt = scheduledDate.toISOString();
        }

        await api.post('/api/forms/send', requestData);
      }

      setBulkFormDialogOpen(false);
      setSelectedFormId('');
      setFormAssignmentType('immediate');
      setScheduledDate('');
      setDurationDays(7);
      setRowSelection({});
      setError(null);
      
      const message = formAssignmentType === 'scheduled' 
        ? `Form scheduled in ${durationDays} day${durationDays !== 1 ? 's' : ''} and assigned to ${selectedClientIds.length} client(s) successfully!`
        : `Form assigned to ${selectedClientIds.length} client(s) successfully!`;
      
      alert(message);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to assign forms');
    } finally {
      setAssigningForm(false);
    }
  };

  const handleFreezeClient = useCallback(async (client: Client) => {
    if (!client.id) return;
    
    if (!confirm(`Are you sure you want to freeze ${client.fullName || client.name || 'this client'}?`)) {
      return;
    }

    try {
      await api.post(`/api/clients/${client.id}/freeze`);
      // Update client status locally
      setClients(prev => prev.map(c => 
        c.id === client.id ? { ...c, status: 'frozen' } : c
      ));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to freeze client');
    }
  }, []);

  const handleUnfreezeClient = useCallback(async (client: Client) => {
    if (!client.id) return;
    
    if (!confirm(`Are you sure you want to unfreeze ${client.fullName || client.name || 'this client'}?`)) {
      return;
    }

    try {
      await api.post(`/api/clients/${client.id}/unfreeze`);
      // Update client status locally
      setClients(prev => prev.map(c => 
        c.id === client.id ? { ...c, status: 'active' } : c
      ));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to unfreeze client');
    }
  }, []);

  const handleDeleteClient = useCallback((client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  }, []);

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'pre_start':
        return 'warning';
      case 'pending':
        return 'warning';
      case 'no_subscription':
        return 'default';
      case 'frozen':
        return 'warning';
      case 'expired':
        return 'error';
      case 'refunded':
        return 'error';
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Active';
      case 'pre_start':
        return 'Pre-Start';
      case 'pending':
        return 'Pending';
      case 'no_subscription':
        return 'No Subscription';
      case 'frozen':
        return 'Frozen';
      case 'expired':
        return 'Expired';
      case 'refunded':
        return 'Refunded';
      case 'inactive':
        return 'Inactive';
      default:
        return status || 'Unknown';
    }
  };

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: 'Row Selection',
        header: ({ table }) => (
          <IndeterminateCheckbox
            {...{
              checked: table.getIsAllRowsSelected(),
              indeterminate: table.getIsSomeRowsSelected(),
              onChange: table.getToggleAllRowsSelectedHandler()
            }}
          />
        ),
        cell: ({ row }) => (
          <IndeterminateCheckbox
            {...{
              checked: row.getIsSelected(),
              disabled: !row.getCanSelect(),
              indeterminate: row.getIsSomeSelected(),
              onChange: row.getToggleSelectedHandler()
            }}
          />
        )
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string;
          const hasFilter = filterValue && String(filterValue).trim().length > 0;
          if (openFilter === 'code') {
            return <DebouncedInput
              value={filterValue || ''}
              onFilterChange={(value) => column.setFilterValue(value)}
              onBlur={() => setOpenFilter(null)}
              placeholder="Search by ID..."
              autoFocus
            />
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('code')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              #
            </Button>
          );
        },
        accessorFn: (row) => row.id || '',
        id: 'code',
        cell: ({ row }) => {
          const id = row.original.id || '';
          const code = id.substring(0, 8);
          return (
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              #{code}
            </Typography>
          );
        },
        filterFn: (row, id, filterValue) => {
          const rowValue = row.original.id || '';
          const searchValue = String(filterValue || '').toLowerCase().trim();
          if (!searchValue) return true;
          return rowValue.toLowerCase().includes(searchValue);
        },
        meta: { align: 'center' }
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string;
          const hasFilter = filterValue && String(filterValue).trim().length > 0;
          if (openFilter === 'name') {
            return <DebouncedInput
              value={filterValue || ''}
              onFilterChange={(value) => column.setFilterValue(value)}
              onBlur={() => setOpenFilter(null)}
              placeholder="Search by name..."
              autoFocus
            />
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('name')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              {t('client-name')}
            </Button>
          );
        },
        accessorFn: (row) => row.fullName || row.name || '',
        id: 'name',
        cell: ({ row }) => {
          const name = row.original.fullName || row.original.name || 'Unnamed';
          return (
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
              <Avatar alt="Avatar" size="sm" src={`/assets/images/users/avatar-1.png`} />
              <Stack>
                <Link href={`/dashboard/clients/${row.original.id}/overview`} style={{ textDecoration: 'none' }}>
                  <Typography variant="subtitle1" sx={{ cursor: 'pointer' }}>{name}</Typography>
                </Link>
                <Typography sx={{ color: 'text.secondary' }}>{row.original.email || t('no-email')}</Typography>
              </Stack>
            </Stack>
          );
        },
        filterFn: (row, id, filterValue) => {
          const name = (row.original.fullName || row.original.name || '').toLowerCase();
          const searchValue = String(filterValue || '').toLowerCase().trim();
          if (!searchValue) return true;
          return name.includes(searchValue);
        },
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string;
          const hasFilter = filterValue && String(filterValue).trim().length > 0;
          if (openFilter === 'phone') {
            return <DebouncedInput
              value={filterValue || ''}
              onFilterChange={(value) => column.setFilterValue(value)}
              onBlur={() => setOpenFilter(null)}
              placeholder="Search by contact..."
              autoFocus
            />
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('phone')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              {t('contact')}
            </Button>
          );
        },
        accessorKey: 'phone',
        cell: ({ getValue }) => <Typography>{(getValue() as string) || t('no-phone')}</Typography>,
        filterFn: (row, id, filterValue) => {
          const rowValue = String(row.original.phone || '').toLowerCase();
          const searchValue = String(filterValue || '').toLowerCase().trim();
          if (!searchValue) return true;
          return rowValue.includes(searchValue);
        }
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string;
          const hasFilter = filterValue && String(filterValue).trim().length > 0;
          if (openFilter === 'password') {
            return <DebouncedInput
              value={filterValue || ''}
              onFilterChange={(value) => column.setFilterValue(value)}
              onBlur={() => setOpenFilter(null)}
              placeholder="Search by password..."
              autoFocus
            />
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('password')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              Password
            </Button>
          );
        },
        accessorKey: 'password',
        cell: ({ getValue }) => (
          <Typography sx={{ fontFamily: 'monospace' }}>{(getValue() as string) || '—'}</Typography>
        ),
        filterFn: (row, id, filterValue) => {
          const rowValue = String(row.original.password || '').toLowerCase();
          const searchValue = String(filterValue || '').toLowerCase().trim();
          if (!searchValue) return true;
          return rowValue.includes(searchValue);
        }
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string[];
          const hasFilter = filterValue && Array.isArray(filterValue) && filterValue.length > 0;
          if (openFilter === 'status') {
            return <FormControl size="small" sx={{minWidth: 120}}>
              <Select
                multiple
                value={filterValue || []}
                onChange={(e) => column.setFilterValue(e.target.value)}
                onClose={() => setOpenFilter(null)}
                open={true}
                renderValue={(selected) => (selected as string[]).join(', ')}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox checked={(filterValue || []).includes(option.value)} />
                    <ListItemText primary={option.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('status')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              {t('status')} {hasFilter && `(${filterValue.length})`}
            </Button>
          );
        },
        accessorKey: 'status',
        filterFn: 'arrIncludes',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return <Chip color={getStatusColor(status) as any} label={getStatusLabel(status)} size="small" variant="light" />;
        }
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as string[];
          const hasFilter = filterValue && Array.isArray(filterValue) && filterValue.length > 0;
          if (openFilter === 'packageName') {
            return <FormControl size="small" sx={{minWidth: 150}}>
              <Select
                multiple
                value={filterValue || []}
                onChange={(e) => column.setFilterValue(e.target.value)}
                onClose={() => setOpenFilter(null)}
                open={true}
                renderValue={(selected) => selected.join(', ')}
              >
                {packages.map((pkg) => (
                  <MenuItem key={pkg.id} value={pkg.name}>
                    <Checkbox checked={(filterValue || []).includes(pkg.name)} />
                    <ListItemText primary={pkg.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
          return (
            <Button 
              size="small" 
              onClick={() => setOpenFilter('packageName')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              {t('package')} {hasFilter && `(${filterValue.length})`}
            </Button>
          );
        },
        accessorKey: 'packageName',
        filterFn: 'arrIncludes',
        cell: ({ row }) => {
          const packageName = row.original.packageName;
          const packageDuration = row.original.packageDuration;
          
          if (!packageName) {
            return <Typography color="text.secondary">{t('no-package')}</Typography>;
          }
          
          return (
            <Stack>
              <Typography variant="body2">{packageName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {packageDuration} month{packageDuration !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          );
        }
      },
      {
        header: ({ column }) => {
          const filterValue = column.getFilterValue() as Date | null;
          const hasFilter = filterValue !== null && filterValue !== undefined;
          if (openFilter === 'createdAt') {
            return (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  value={filterValue}
                  onChange={(newValue) => {
                    column.setFilterValue(newValue);
                    setOpenFilter(null);
                  }}
                  slotProps={{
                    textField: {
                      size: 'small',
                      autoFocus: true,
                      placeholder: 'Select date',
                      sx: { minWidth: 150 }
                    },
                    actionBar: {
                      actions: ['clear', 'today']
                    }
                  }}
                  open
                  onClose={() => setOpenFilter(null)}
                />
              </LocalizationProvider>
            );
          }
          return (
            <Button 
              size="small"
              onClick={() => setOpenFilter('createdAt')}
              variant={hasFilter ? 'contained' : 'text'}
              color={hasFilter ? 'primary' : 'inherit'}
            >
              Created
            </Button>
          );
        },
        accessorKey: 'createdAt',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? new Date(date).toLocaleDateString() : 'Unknown';
        },
        filterFn: (row, id, filterValue) => {
          if (!filterValue) return true;
          const rowDate = row.original.createdAt ? new Date(row.original.createdAt) : null;
          if (!rowDate) return false;
          const filterDate = filterValue instanceof Date ? filterValue : new Date(filterValue);
          // Compare dates (ignore time)
          return rowDate.toDateString() === filterDate.toDateString();
        }
      },
      {
        header: 'Actions',
        meta: { align: 'center' },
        disableSortBy: true,
        cell: ({ row }) => {
          return (
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <Tooltip title="View">
                <IconButton
                  color="secondary"
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    setSelectedClient(row.original);
                    setViewOpen(true);
                  }}
                >
                  <Eye />
                </IconButton>
              </Tooltip>
              {activeTab === 0 && (
                <Tooltip title="Edit">
                  <IconButton
                    color="primary"
                    sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      setSelectedClient(row.original);
                      setEditFullName(row.original.fullName || row.original.name || '');
                      setEditEmail(row.original.email || '');
                      setEditWorkspaceEmail(row.original.workspaceEmail || '');
                      setEditPhone(row.original.phone || '');
                      setEditOpen(true);
                    }}
                  >
                    <Edit />
                  </IconButton>
                </Tooltip>
              )}
              {activeTab === 0 && row.original.status?.toLowerCase() === 'active' && (
                <Tooltip title="Freeze">
                  <IconButton
                    color="warning"
                    sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleFreezeClient(row.original);
                    }}
                  >
                    <PauseCircleIcon />
                  </IconButton>
                </Tooltip>
              )}
              {activeTab === 0 && row.original.status?.toLowerCase() === 'frozen' && (
                <Tooltip title="Unfreeze">
                  <IconButton
                    color="success"
                    sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleUnfreezeClient(row.original);
                    }}
                  >
                    <PlayCircleIcon />
                  </IconButton>
                </Tooltip>
              )}
              {activeTab === 0 && (
                <Tooltip title="Archive">
                  <IconButton
                    color="error"
                    sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleDeleteClient(row.original);
                    }}
                  >
                    <Trash />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        }
      }
    ],
    [activeTab, handleFreezeClient, handleUnfreezeClient, setSelectedClient, setViewOpen, setEditOpen, setEditFullName, setEditEmail, setEditWorkspaceEmail, setEditPhone, handleDeleteClient, t, openFilter, setOpenFilter, statusOptions, packages]
  );

  // Table configuration
  const table = useReactTable({
    data: clients,
    columns: columns,
    state: { columnFilters, sorting, rowSelection },
    enableRowSelection: true,
    getRowId: (row) => row.id, // Use client ID as row ID
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: {
      arrIncludes: (row, columnId, filterValue) => {
        const rowValue = row.getValue(columnId) as string;
        if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) return true;
        return filterValue.includes(rowValue);
      },
    },
    globalFilterFn: 'includesString',
  });

  // Validation functions for edit form
  const validateEditEmail = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setEditEmailError(null);
      return;
    }

    // Don't validate if it's the same as the current client's email
    if (selectedClient && emailValue === selectedClient.email) {
      setEditEmailError(null);
      return;
    }

    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.email && client.email.toLowerCase() === emailValue.toLowerCase() && client.id !== selectedClient?.id
      );
      
      if (existingClient) {
        setEditEmailError('A client with this email already exists in this workspace');
      } else {
        setEditEmailError(null);
      }
    } catch (err) {
      console.error('Error validating email:', err);
      setEditEmailError(null);
    }
  };

  const validateEditPhone = async (phoneValue: string) => {
    if (!phoneValue || phoneValue.trim().length < 5) {
      setEditPhoneError(null);
      return;
    }

    // Don't validate if it's the same as the current client's phone
    if (selectedClient && phoneValue === selectedClient.phone) {
      setEditPhoneError(null);
      return;
    }

    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.phone && client.phone === phoneValue && client.id !== selectedClient?.id
      );
      
      if (existingClient) {
        setEditPhoneError('A client with this phone number already exists in this workspace');
      } else {
        setEditPhoneError(null);
      }
    } catch (err) {
      console.error('Error validating phone:', err);
      setEditPhoneError(null);
    }
  };

  const validateEditWorkspaceEmail = async (workspaceEmailValue: string) => {
    if (!workspaceEmailValue || !workspaceEmailValue.includes('@')) {
      setEditWorkspaceEmailError(null);
      return;
    }

    // Don't validate if it's the same as the current client's workspaceEmail
    if (selectedClient && workspaceEmailValue === selectedClient.workspaceEmail) {
      setEditWorkspaceEmailError(null);
      return;
    }

    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.workspaceEmail && client.workspaceEmail.toLowerCase() === workspaceEmailValue.toLowerCase() && client.id !== selectedClient?.id
      );
      
      if (existingClient) {
        setEditWorkspaceEmailError('A client with this workspace email already exists in this workspace');
      } else {
        setEditWorkspaceEmailError(null);
      }
    } catch (err) {
      console.error('Error validating workspace email:', err);
      setEditWorkspaceEmailError(null);
    }
  };

  const saveEdit = async () => {
    if (!selectedClient) return;
    
    // Check for validation errors
    if (editEmailError || editWorkspaceEmailError || editPhoneError) {
      setError('Please fix the validation errors before saving');
      return;
    }
    
    setEditSaving(true);
    try {
      await api.put(`/api/clients/${selectedClient.id}`, {
        fullName: editFullName.trim() || undefined,
        email: editEmail.trim() || null,
        workspaceEmail: editWorkspaceEmail.trim() || null,
        phone: editPhone.trim() || null,
      });
      setEditOpen(false);
      setEditEmailError(null);
      setEditWorkspaceEmailError(null);
      setEditPhoneError(null);
      await refreshClients();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update client');
    } finally {
      setEditSaving(false);
    }
  };


  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    
    setDeleting(true);
    try {
      console.log('Archiving client:', clientToDelete.id, clientToDelete.fullName);
      const response = await api.delete(`/api/clients/${clientToDelete.id}`);
      console.log('Archive response:', response.data);
      
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      await refreshClients();
      setError(null);
    } catch (e: any) {
      console.error('Archive client error:', e);
      console.error('Error response:', e.response?.data);
      console.error('Error status:', e.response?.status);
      setError(e?.response?.data?.error || 'Failed to archive client');
    } finally {
      setDeleting(false);
    }
  };

  const openPasswordDialog = () => {
    setPasswordDialogOpen(true);
    setGeneratedPassword(null);
    setCustomPassword('');
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSetPassword = async () => {
    if (!selectedClient || !selectedClient.email) {
      setError('Client must have an email to set password');
      return;
    }

    setSettingPassword(true);
    try {
      let password;
      
      // If user entered a custom password and it's valid, use it
      if (customPassword.trim().length >= 6) {
        password = customPassword.trim();
        await api.post('/api/clients/set-password', {
          clientId: selectedClient.id,
          password: password
        });
        await refreshClients();
        setPasswordDialogOpen(false);
        setError(null);
      } else {
        // Generate random password
        password = generateRandomPassword();
        setGeneratedPassword(password);
        
        await api.post('/api/clients/set-password', {
          clientId: selectedClient.id,
          password: password
        });
        await refreshClients();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };


  const headers: LabelKeyObject[] = [];
  table.getAllColumns().map((column) => {
    const accessorKey = (column.columnDef as { accessorKey?: string }).accessorKey;
    headers.push({
      label: typeof column.columnDef.header === 'string' ? column.columnDef.header : '#',
      key: accessorKey ?? ''
    });
  });

  if (!workspaceId) {
    return (
      <Card sx={{ borderStyle: 'dashed' }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6">Select a workspace</Typography>
            <Typography color="text.secondary">Choose a workspace to view and manage clients.</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
            <Typography color="text.secondary">{t('loading-clients')}</Typography>
        </Stack>
      </Box>
    );
  }

  const renderTableView = () => {
    const activeFiltersCount = columnFilters.filter(f => {
      const value = f.value;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return value != null && value !== '';
    }).length;
    
    const hasActiveFilters = activeFiltersCount > 0;
    
    return (
    <MainCard content={false}>
      <Stack>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1 }}>
          <RowSelection selected={Object.keys(rowSelection).length} />
          {hasActiveFilters && (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => {
                setColumnFilters([]);
                setOpenFilter(null);
              }}
              sx={{ ml: 'auto' }}
            >
              Clear Filters ({activeFiltersCount})
            </Button>
          )}
        </Box>
        <ResponsiveTable>
          <Table size={tableDensity === 'compact' ? 'small' : 'small'}>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableCell key={header.id} {...header.column.columnDef.meta}>
                        {header.isPlaceholder ? null : (
                          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                            <Box>{flexRender(header.column.columnDef.header, header.getContext())}</Box>
                            {header.column.getCanSort() && <HeaderSort column={header.column} />}
                          </Stack>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} {...cell.column.columnDef.meta}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow
                      sx={(theme) => ({
                        bgcolor: alpha(theme.palette.primary.lighter, 0.1),
                        ...theme.applyStyles('dark', { bgcolor: alpha(theme.palette.secondary.light, 0.25) }),
                        '&:hover': {
                          bgcolor: `${alpha(theme.palette.primary.lighter, 0.1)} !important`,
                          ...theme.applyStyles('dark', { bgcolor: `${alpha(theme.palette.secondary.light, 0.25)} !important` })
                        }
                      })}
                    >
                      <TableCell colSpan={row.getVisibleCells().length} sx={{ p: 2.5, overflow: 'hidden' }}>
                        <Stack direction="row" spacing={2}>
                          <Button size="small" variant="outlined" href={`/dashboard/clients/${row.original.id}`}>
                            {t('view-details')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTable>
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <TablePagination
              {...{
                setPageSize: table.setPageSize,
                setPageIndex: table.setPageIndex,
                getState: table.getState,
                getPageCount: table.getPageCount,
                initialPageSize: 10
              }}
            />
          </Box>
        </>
      </Stack>
    </MainCard>
    );
  };

  const renderCardsView = () => {
    const filteredClients = table.getRowModel().rows.map(row => row.original);
    return (
    <Grid container spacing={2}>
      {filteredClients.map((c) => (
        <Grid key={c.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-4px)'
              }
            }}
            onClick={() => {
              setSelectedClient(c);
              setViewOpen(true);
            }}
          >
            <CardHeader 
              avatar={
                <Avatar alt={c.fullName || c.name} size="md">
                  {(c.fullName || c.name || 'U')[0].toUpperCase()}
                </Avatar>
              }
              title={
                <Typography variant="h6">
                  {c.fullName || c.name || 'Unnamed'}
                </Typography>
              }
              subheader={
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {c.email && (
                    <Typography variant="body2" color="text.secondary">
                      📧 {c.email}
                    </Typography>
                  )}
                  {c.phone && (
                    <Typography variant="body2" color="text.secondary">
                      📱 {c.phone}
                    </Typography>
                  )}
                </Stack>
              }
            />
            <CardContent>
              <Stack spacing={2}>
                {/* Status, Package, and Joined in one row */}
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
                {c.status && (
                    <Box sx={{ flex: '0 0 auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {t('status')}
                    </Typography>
                      <Chip 
                        label={c.status} 
                        size="small"
                        color={
                          c.status === 'active' ? 'success' :
                          c.status === 'pending' ? 'warning' :
                          'default'
                        }
                      />
                  </Box>
                )}
                {c.packageName && (
                    <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {t('package')}
                    </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                      {c.packageName}
                    </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {c.packageDuration} month{c.packageDuration !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
                {c.createdAt && (
                    <Box sx={{ flex: '0 0 auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {t('joined')}
                    </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                </Stack>
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {c.status?.toLowerCase() === 'active' && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="warning"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFreezeClient(c);
                      }}
                      sx={{ flex: isMobile ? '1 1 auto' : '0 0 auto' }}
                      startIcon={<PauseCircleIcon sx={{ fontSize: 16 }} />}
                    >
                      {t('freeze') || 'Freeze'}
                    </Button>
                  )}
                  {c.status?.toLowerCase() === 'frozen' && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="success"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnfreezeClient(c);
                      }}
                      sx={{ flex: isMobile ? '1 1 auto' : '0 0 auto' }}
                      startIcon={<PlayCircleIcon sx={{ fontSize: 16 }} />}
                    >
                      {t('unfreeze') || 'Unfreeze'}
                    </Button>
                  )}
                  <Button 
                    size="small" 
                    variant="outlined" 
                    href={`/dashboard/clients/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth={isMobile && c.status?.toLowerCase() !== 'active' && c.status?.toLowerCase() !== 'frozen'}
                    sx={{ flex: isMobile && (c.status?.toLowerCase() === 'active' || c.status?.toLowerCase() === 'frozen') ? '1 1 auto' : '0 0 auto' }}
                  >
                    <Eye style={{ marginRight: 4 }} />
                    {t('details')}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header row */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="h4">{t('clients')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>

          {activeTab === 0 && Object.keys(rowSelection).length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setBulkFormDialogOpen(true)}
              size="small"
            >
              Assign Form ({Object.keys(rowSelection).length})
            </Button>
          )}
          {activeTab === 0 && (
            <Button variant="contained" onClick={() => setCreateWizardOpen(true)}>
              Create Client
            </Button>
          )}
          <CSVExport
            {...{
              data: clients,
              headers,
              filename: 'clients-list.csv'
            }}
          />
        </Stack>
      </Stack>

      {/* Status filters row + Archive toggle */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ alignSelf: { xs: 'stretch', md: 'flex-end' } }}>
          <Tooltip title={activeTab === 1 ? 'Show Active Clients' : 'View Archived Clients'}>
            <Button
              variant={activeTab === 1 ? 'contained' : 'outlined'}
              color="secondary"
              startIcon={<ArchiveOutlinedIcon />}
              onClick={() => {
                setActiveTab((prev) => {
                  const next = prev === 1 ? 0 : 1;
                  setRowSelection({});
                  return next;
                });
              }}
              sx={{
                width: { xs: '100%', md: 'auto' },
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: activeTab === 1 ? '0 10px 25px rgba(88, 86, 214, 0.3)' : 'none'
              }}
            >
              {activeTab === 1 ? 'Viewing Archived' : 'Archived Clients'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {subscriptionRequired ? (
        <Alert severity="warning" action={<Button color="warning" variant="contained" size="small" href="/dashboard/workspaces/subscription">Manage Subscription</Button>}>
          <Box>
            <Box sx={{ fontWeight: 600, mb: 0.5 }}>Workspace subscription required</Box>
            <Box sx={{ color: 'text.secondary' }}>Your workspace has no active subscription. Activate a plan to view and manage clients.</Box>
            <Box sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: 'warning.dark' }}>workspace_subscription_required</Box>
          </Box>
        </Alert>
      ) : (
        error && <Alert severity="error">{error}</Alert>
      )}

      {showForm && (
        <Card>
          <CardHeader title="Invite Client" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField 
                  fullWidth 
                  label="Email (optional)" 
                  type="email"
                  value={email} 
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Debounce validation
                    setTimeout(() => validateInviteEmail(e.target.value), 500);
                  }}
                  error={!!inviteEmailError}
                  helperText={inviteEmailError || ''}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField 
                  fullWidth 
                  label="Phone (optional)" 
                  value={phone} 
                  onChange={(e) => {
                    setPhone(e.target.value);
                    // Debounce validation
                    setTimeout(() => validateInvitePhone(e.target.value), 500);
                  }}
                  error={!!invitePhoneError}
                  helperText={invitePhoneError || ''}
                />
              </Grid>
              <Grid size={12}>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" disabled={inviting} onClick={inviteClient}>
                    {inviting ? 'Inviting…' : 'Send Invite'}
                  </Button>
                  <Button variant="text" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6">No clients yet</Typography>
              <Typography color="text.secondary">Invite your first client to get started.</Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        renderTableView()
      )}

      {/* Edit Client Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full Name" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} fullWidth />
            <TextField 
              label="Email" 
              type="email" 
              value={editEmail} 
              onChange={(e) => {
                setEditEmail(e.target.value);
                // Debounce validation
                setTimeout(() => validateEditEmail(e.target.value), 500);
              }}
              error={!!editEmailError}
              helperText={editEmailError || ''}
              fullWidth 
            />
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField 
                label="Workspace Email (Optional)" 
                type="email" 
                value={editWorkspaceEmail} 
                onChange={(e) => {
                  setEditWorkspaceEmail(e.target.value);
                  // Debounce validation
                  setTimeout(() => validateEditWorkspaceEmail(e.target.value), 500);
                }}
                error={!!editWorkspaceEmailError}
                helperText={editWorkspaceEmailError || 'Unique email for this workspace (e.g., firstname@subdomain.ff)'}
                fullWidth 
              />
              <Tooltip title="Generate workspace email">
                <IconButton
                  onClick={async () => {
                    if (!selectedClient) return;
                    try {
                      const res = await api.post(`/api/clients/${selectedClient.id}/generate-workspace-email`);
                      setEditWorkspaceEmail(res.data.workspaceEmail || '');
                      setEditWorkspaceEmailError(null);
                    } catch (e: any) {
                      setError(e?.response?.data?.error || 'Failed to generate workspace email');
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  <AutoAwesomeIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <TextField 
              label="Phone" 
              value={editPhone} 
              onChange={(e) => {
                setEditPhone(e.target.value);
                // Debounce validation
                setTimeout(() => validateEditPhone(e.target.value), 500);
              }}
              error={!!editPhoneError}
              helperText={editPhoneError || ''}
              fullWidth 
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Client Details</DialogTitle>
        <DialogContent dividers>
          {selectedClient ? (
            <Stack spacing={2}>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Avatar alt="Avatar" size="sm" src={`/assets/images/users/avatar-1.png`} />
                <Stack>
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                    <Typography variant="h6">{selectedClient.fullName || selectedClient.name || 'Unnamed'}</Typography>
                    {selectedClient.id && (
                      <Chip 
                        label={`#${selectedClient.id.substring(0, 8)}`} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  {selectedClient.email && (
                    <Typography sx={{ color: 'text.secondary' }}>{selectedClient.email}</Typography>
                  )}
                  {selectedClient.phone && (
                    <Typography sx={{ color: 'text.secondary' }}>{selectedClient.phone}</Typography>
                  )}
                </Stack>
              </Stack>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Status:</Typography>
                <Chip size="small" color={getStatusColor(selectedClient.status || null) as any} label={getStatusLabel(selectedClient.status || null)} variant="light" />
              </Stack>
              <Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Created</Typography>
                <Typography>{selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleString() : 'Unknown'}</Typography>
              </Stack>
            </Stack>
          ) : (
            <Typography color="text.secondary">No client selected</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selectedClient && (
            <>
              <Button variant="contained" component={Link} href={`/dashboard/clients/${selectedClient.id}/overview`} onClick={() => setViewOpen(false)}>
                Go to Overview
              </Button>
              {selectedClient.email && (
                <Button variant="outlined" color="secondary" onClick={openPasswordDialog}>
                  Set/Reset Password
                </Button>
              )}
            </>
          )}
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Password Management Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set/Reset Password</DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              {!generatedPassword ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Set or reset the password for {selectedClient.fullName || selectedClient.name || 'this client'}
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Custom Password (optional)"
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    helperText={customPassword.length > 0 && customPassword.length < 6 ? "Password must be at least 6 characters" : "Leave empty to generate a random password"}
                  />

                  {customPassword.length === 0 && (
                    <Alert severity="info">
                      A random 12-character password will be generated and displayed for you to share with the client.
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  <Alert severity="success">
                    Password has been set successfully!
                  </Alert>
                  <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Generated Password (save this - it won't be shown again):
                    </Typography>
                    <Typography variant="h6" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {generatedPassword}
                    </Typography>
                  </Box>
                  <Alert severity="warning">
                    Please share this password with the client securely. They should change it after logging in.
                  </Alert>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!generatedPassword ? (
            <>
              <Button onClick={() => setPasswordDialogOpen(false)} disabled={settingPassword}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleSetPassword} 
                disabled={settingPassword || (customPassword.length > 0 && customPassword.length < 6)}
              >
                {settingPassword ? 'Setting...' : 'Set Password'}
              </Button>
            </>
          ) : (
            <Button variant="contained" onClick={() => {
              setPasswordDialogOpen(false);
              setGeneratedPassword(null);
            }}>
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Create Client Wizard */}
      <CreateClientWizard
        open={createWizardOpen}
        onClose={() => setCreateWizardOpen(false)}
        onSuccess={refreshClients}
      />

      {/* Bulk Form Assignment Dialog */}
      <Dialog open={bulkFormDialogOpen} onClose={() => setBulkFormDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Form to Selected Clients</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Assign a form template to {Object.keys(rowSelection).length} selected client(s)
            </Typography>
            
            {formTemplates.length === 0 ? (
              <Alert severity="warning">
                No form templates available. Create form templates first from the Forms page.
              </Alert>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel>Select Form Template</InputLabel>
                  <Select
                    value={selectedFormId}
                    label="Select Form Template"
                    onChange={(e) => setSelectedFormId(e.target.value)}
                  >
                    {formTemplates.map((form: any) => (
                      <MenuItem key={form.id} value={form.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography>{form.title}</Typography>
                          <Chip 
                            label={form.type} 
                            size="small" 
                            color={form.type === 'nutrition' ? 'success' : 'primary'} 
                          />
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Assignment Type Selection */}
                <FormControl fullWidth>
                  <InputLabel>Assignment Type</InputLabel>
                  <Select
                    value={formAssignmentType}
                    label="Assignment Type"
                    onChange={(e) => setFormAssignmentType(e.target.value as 'immediate' | 'scheduled')}
                  >
                    <MenuItem value="immediate">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>Immediate (Pending)</Typography>
                        <Chip label="Available now" size="small" color="success" />
                      </Stack>
                    </MenuItem>
                    <MenuItem value="scheduled">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>Scheduled</Typography>
                        <Chip label="Send later" size="small" color="warning" />
                      </Stack>
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Duration Input */}
                {formAssignmentType === 'scheduled' && (
                  <TextField
                    fullWidth
                    label="Duration (Days)"
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value) || 0)}
                    InputLabelProps={{ shrink: true }}
                    helperText={`Form will be sent to clients in ${durationDays} day${durationDays !== 1 ? 's' : ''} (${new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()})`}
                    inputProps={{
                      min: 1,
                      max: 365
                    }}
                  />
                )}
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkFormDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBulkFormAssignment}
            disabled={!selectedFormId || assigningForm || formTemplates.length === 0 || (formAssignmentType === 'scheduled' && (!durationDays || durationDays <= 0))}
          >
            {assigningForm ? <CircularProgress size={20} /> : formAssignmentType === 'scheduled' ? `Schedule in ${durationDays} Day${durationDays !== 1 ? 's' : ''}` : 'Assign Form'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive Client Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Archive Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body1">
              Are you sure you want to archive <strong>{clientToDelete?.fullName || clientToDelete?.name || 'this client'}</strong>?
            </Typography>
            <Alert severity="warning">
              This will archive the client and prevent them from signing in. The client data will be preserved but hidden from the active clients list.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDeleteClient} 
            disabled={deleting}
          >
            {deleting ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Archiving...
              </>
            ) : (
              'Archive Client'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
