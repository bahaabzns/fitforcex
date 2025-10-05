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
  createdAt?: string;
};

type ViewMode = 'table' | 'cards';
type TableDensity = 'comfortable' | 'standard' | 'compact';

export default function ClientsPage() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [tableDensity, setTableDensity] = useState<TableDensity>('comfortable');

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
  const [globalFilter, setGlobalFilter] = useState('');

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviting, setInviting] = useState(false);

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.fullName || c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const inviteClient = async () => {
    if (!fullName.trim()) return;
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
      // refresh list
      const res = await api.get('/api/clients');
      setClients(Array.isArray(res.data?.clients) ? res.data.clients : []);
    } catch {
      setError('Failed to invite client');
    } finally {
      setInviting(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
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
      case 'pending':
        return 'Pending';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
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
      { header: '#', accessorKey: 'id', meta: { align: 'center' } },
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
                    // Handle edit
                  }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  color="error"
                  sx={(theme) => ({ ':hover': { ...theme.applyStyles('dark', { color: 'text.primary' }) } })}
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    // Handle delete
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
    state: { columnFilters, sorting, rowSelection, globalFilter },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getRowCanExpand: () => true,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: true
  });

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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={(theme) => ({
          gap: 2,
          justifyContent: 'space-between',
          p: 3,
          [theme.breakpoints.down('sm')]: { '& .MuiOutlinedInput-root, & .MuiFormControl-root': { width: '100%' } }
        })}
      >
        <DebouncedInput
          value={globalFilter ?? ''}
          onFilterChange={(value) => setGlobalFilter(String(value))}
          placeholder={`Search ${filtered.length} records...`}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: 'center' }}>
          <Select
            value={tableDensity}
            onChange={(event) => setTableDensity(event.target.value as TableDensity)}
            displayEmpty
            slotProps={{ input: { 'aria-label': 'Table Density' } }}
            size="small"
          >
            <MenuItem value="comfortable">Comfortable</MenuItem>
            <MenuItem value="standard">Standard</MenuItem>
            <MenuItem value="compact">Compact</MenuItem>
          </Select>
          <SelectColumnSorting {...{ getState: table.getState, getAllColumns: table.getAllColumns, setSorting }} />
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setShowForm(true)} size="large">
              Invite Client
            </Button>
            <CSVExport
              {...{
                data:
                  table.getSelectedRowModel().flatRows.map((row) => row.original).length === 0
                    ? filtered
                    : table.getSelectedRowModel().flatRows.map((row) => row.original),
                headers,
                filename: 'clients-list.csv'
              }}
            />
          </Stack>
        </Stack>
      </Stack>
      <Stack>
        <RowSelection selected={Object.keys(rowSelection).length} />
        <ResponsiveTable>
          <Table size={tableDensity === 'compact' ? 'small' : tableDensity === 'comfortable' ? 'medium' : 'small'}>
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
                          <Button size="small" variant="outlined" href={`/dashboard/clients/${row.original.id}?tab=workout`}>
                            Workouts
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
                  <Button 
                    size="small" 
                    variant="outlined" 
                    href={`/dashboard/clients/${c.id}?tab=workout`}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth={isMobile}
                  >
                    Workouts
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
          <TextField size="small" placeholder="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="contained" onClick={() => setShowForm((s) => !s)}>
            Invite Client
          </Button>
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
                <TextField fullWidth label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Client Details</DialogTitle>
        <DialogContent dividers>
          {selectedClient ? (
            <Stack spacing={2}>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                <Avatar alt="Avatar" size="sm" src={`/assets/images/users/avatar-1.png`} />
                <Stack>
                  <Typography variant="h6">{selectedClient.fullName || selectedClient.name || 'Unnamed'}</Typography>
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
            <Button variant="contained" component={Link} href={`/dashboard/clients/${selectedClient.id}/overview`} onClick={() => setViewOpen(false)}>
              Go to Overview
            </Button>
          )}
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
