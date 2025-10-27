'use client';

import { useEffect, useMemo, useState, Fragment, MouseEvent } from 'react';
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
  ColumnFiltersState
} from '@tanstack/react-table';

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

type Client = {
  id: string;
  fullName?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  packageId?: string | null;
  packageName?: string | null;
  packageDuration?: number | null;
  createdAt?: string;
};

type ViewMode = 'table' | 'cards';
type TableDensity = 'compact';

export default function ClientsPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [tableDensity, setTableDensity] = useState<TableDensity>('compact');

  // Auto-switch to cards view on mobile
  useEffect(() => {
    if (isMobile && viewMode === 'table') {
      setViewMode('cards');
    }
  }, [isMobile]);

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
  const [editPhone, setEditPhone] = useState('');
  
  // Validation states for edit form
  const [editEmailError, setEditEmailError] = useState<string | null>(null);
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

  // Packages for filtering and display
  const [packages, setPackages] = useState<any[]>([]);
  const [packageFilter, setPackageFilter] = useState<string>('all');

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    const fetchClients = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/clients');
        setClients(Array.isArray(res.data?.clients) ? res.data.clients : []);
      } catch {
        setError('Failed to load clients');
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [workspaceId]);

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


  const filtered = useMemo(() => {
    let result = clients;

    // Text search filter - focus on client name primarily
    const searchQuery = search.trim().toLowerCase();
    if (searchQuery) {
      result = result.filter(
        (c) => {
          const clientName = (c.fullName || c.name || '').toLowerCase();
          const email = (c.email || '').toLowerCase();
          const phone = (c.phone || '').toLowerCase();
          
          // Primary search: client name (most common use case)
          if (clientName.includes(searchQuery)) {
            return true;
          }
          // Secondary search: email (for cases where user searches by email)
          if (email.includes(searchQuery)) {
            return true;
          }
          // Tertiary search: phone (for cases where user searches by phone)
          if (phone.includes(searchQuery)) {
            return true;
          }
          return false;
        }
      );
    }

    // Package filter
    if (packageFilter && packageFilter !== 'all') {
      if (packageFilter === 'none') {
        result = result.filter((c: any) => !c.packageId);
      } else {
        result = result.filter((c: any) => c.packageId === packageFilter);
      }
    }

    return result;
  }, [clients, search, packageFilter]);

  const refreshClients = async () => {
    try {
      console.log('Refreshing clients...');
      const res = await api.get('/api/clients');
      const clients = Array.isArray(res.data?.clients) ? res.data.clients : [];
      console.log('Refreshed clients:', clients.length);
      setClients(clients);
    } catch (e) {
      console.error('Failed to refresh clients:', e);
      setError('Failed to load clients');
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
        header: '#',
        accessorKey: 'code',
        cell: ({ getValue }) => {
          const code = getValue() as number;
          return (
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              #{code}
            </Typography>
          );
        },
        meta: { align: 'center' }
      },
      {
        header: 'Client Name',
        accessorKey: 'name',
        cell: ({ row, getValue }) => {
          const name = (getValue() as string) || row.original.fullName || 'Unnamed';
          return (
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
              <Avatar alt="Avatar" size="sm" src={`/assets/images/users/avatar-1.png`} />
              <Stack>
                <Link href={`/dashboard/clients/${row.original.id}/overview`} style={{ textDecoration: 'none' }}>
                  <Typography variant="subtitle1" sx={{ cursor: 'pointer' }}>{name}</Typography>
                </Link>
                <Typography sx={{ color: 'text.secondary' }}>{row.original.email || 'No email'}</Typography>
              </Stack>
            </Stack>
          );
        }
      },
      {
        header: 'Contact',
        accessorKey: 'phone',
        cell: ({ getValue }) => <Typography>{(getValue() as string) || 'No phone'}</Typography>
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return <Chip color={getStatusColor(status) as any} label={getStatusLabel(status)} size="small" variant="light" />;
        }
      },
      {
        header: 'Package',
        accessorKey: 'packageName',
        cell: ({ row }) => {
          const packageName = row.original.packageName;
          const packageDuration = row.original.packageDuration;
          
          if (!packageName) {
            return <Typography color="text.secondary">No package</Typography>;
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
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => {
          const date = getValue() as string;
          return date ? new Date(date).toLocaleDateString() : 'Unknown';
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
              <Tooltip title="Edit">
                <IconButton
                  color="primary"
                  sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    setSelectedClient(row.original);
                    setEditFullName(row.original.fullName || row.original.name || '');
                    setEditEmail(row.original.email || '');
                    setEditPhone(row.original.phone || '');
                    setEditOpen(true);
                  }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
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
            </Stack>
          );
        }
      }
    ],
    []
  );

  // Table configuration
  const table = useReactTable({
    data: filtered,
    columns: columns,
    state: { columnFilters, sorting, rowSelection },
    enableRowSelection: true,
    getRowId: (row) => row.id, // Use client ID as row ID
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getRowCanExpand: () => true,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true
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

  const saveEdit = async () => {
    if (!selectedClient) return;
    
    // Check for validation errors
    if (editEmailError || editPhoneError) {
      setError('Please fix the validation errors before saving');
      return;
    }
    
    setEditSaving(true);
    try {
      await api.put(`/api/clients/${selectedClient.id}`, {
        fullName: editFullName.trim() || undefined,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      });
      setEditOpen(false);
      setEditEmailError(null);
      setEditPhoneError(null);
      await refreshClients();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update client');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
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
          <Typography color="text.secondary">Loading clients…</Typography>
        </Stack>
      </Box>
    );
  }

  const renderTableView = () => (
    <MainCard content={false}>
      <Stack>
        <RowSelection selected={Object.keys(rowSelection).length} />
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
                            View Details
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

  const renderCardsView = () => (
    <Grid container spacing={2}>
      {filtered.map((c) => (
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
                {c.status && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
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
                  </Box>
                )}
                {c.packageName && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Package
                    </Typography>
                    <Typography variant="body2">
                      {c.packageName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.packageDuration} month{c.packageDuration !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
                {c.createdAt && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Joined
                    </Typography>
                    <Typography variant="body2">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                <Divider />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    href={`/dashboard/clients/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth={isMobile}
                  >
                    <Eye style={{ marginRight: 4 }} />
                    Details
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="h4">Clients</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <ToggleButtonGroup value={viewMode} exclusive onChange={(_, newMode) => newMode && setViewMode(newMode)} size="small">
            <ToggleButton value="table">
              <Menu size={16} />
            </ToggleButton>
            <ToggleButton value="cards">
              <Grid3 size={16} />
            </ToggleButton>
          </ToggleButtonGroup>
          <Select
            value={packageFilter}
            onChange={(event) => setPackageFilter(event.target.value)}
            displayEmpty
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Packages</MenuItem>
            <MenuItem value="none">No Package</MenuItem>
            {packages.map((pkg) => (
              <MenuItem key={pkg.id} value={pkg.id}>
                {pkg.name}
              </MenuItem>
            ))}
          </Select>
          <TextField size="small" placeholder="Search by client name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {Object.keys(rowSelection).length > 0 && viewMode === 'table' && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setBulkFormDialogOpen(true)}
              size="small"
            >
              Assign Form ({Object.keys(rowSelection).length})
            </Button>
          )}
          <Button variant="contained" onClick={() => setCreateWizardOpen(true)}>
            Create Client
          </Button>
          <CSVExport
            {...{
              data: filtered,
              headers,
              filename: 'clients-list.csv'
            }}
          />
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

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

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6">No clients yet</Typography>
              <Typography color="text.secondary">Invite your first client to get started.</Typography>
            </Box>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        renderTableView()
      ) : (
        renderCardsView()
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
                    {selectedClient.code && (
                      <Chip 
                        label={`#${selectedClient.code}`} 
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
