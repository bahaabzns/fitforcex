'use client';

import { useState, useEffect, ChangeEvent, MouseEvent, SyntheticEvent } from 'react';
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
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// project-imports
import MainCard from 'components/MainCard';
import WorkspaceSubscriptionGuard from '@/components/WorkspaceSubscriptionGuard';
import ResponsiveTable from '@/components/ResponsiveTable';
import { CSVExport, RowSelection } from 'components/third-party/react-table';

// Icons
import { Add, Edit, Trash, Shield, Crown, User, Menu as MenuIcon } from '@wandersonalwes/iconsax-react';

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

interface TeamMember {
  id: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    createdAt: string;
  };
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  _count: {
    members: number;
  };
  permissions: Array<{
    permission: {
      key: string;
      description: string;
    };
  }>;
}

interface Permission {
  id: string;
  key: string;
  description: string;
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

function stableSort(array: TeamMember[], comparator: (a: KeyedObject, b: KeyedObject) => number) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0] as TeamMember, b[0] as TeamMember);
    if (order !== 0) return order;
    return (a[1] as number) - (b[1] as number);
  });
  return stabilizedThis.map((el) => el[0]);
}

// table header
const headCells = [
  {
    id: 'user.fullName',
    numeric: false,
    disablePadding: true,
    label: 'Member'
  },
  {
    id: 'user.email',
    numeric: false,
    disablePadding: false,
    label: 'Email'
  },
  {
    id: 'role.name',
    numeric: false,
    disablePadding: false,
    label: 'Role'
  },
  {
    id: 'createdAt',
    numeric: false,
    disablePadding: false,
    label: 'Joined'
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
            slotProps={{ input: { 'aria-label': 'select all members' } }}
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

export default function TeamPage() {
  const intl = useIntl();
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table states
  const [order, setOrder] = useState<ArrangementOrder>('asc');
  const [orderBy, setOrderBy] = useState('user.fullName');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedValue, setSelectedValue] = useState<TeamMember[]>([]);

  // Dialog states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isRoleChangeDialogOpen, setIsRoleChangeDialogOpen] = useState(false);
  const [isAdminWarningDialogOpen, setIsAdminWarningDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pendingRoleId, setPendingRoleId] = useState<string>('');

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [newRoleId, setNewRoleId] = useState('');

  const [inviting, setInviting] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState(false);

  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuMember, setMenuMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [membersRes, rolesRes, permissionsRes] = await Promise.all([
          api.get('/api/team/members'),
          api.get('/api/team/roles'),
          api.get('/api/team/permissions')
        ]);
        setMembers(membersRes.data.members || []);
        setRoles(rolesRes.data.roles || []);
        setPermissions(permissionsRes.data.permissions || []);
      } catch {
        setError('Failed to load team data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedRoleId) {
      setError('Please provide email and select a role');
      return;
    }

    // Check if the selected role is admin
    const selectedRole = roles.find(role => role.id === selectedRoleId);
    if (selectedRole?.name.toLowerCase() === 'admin') {
      setPendingRoleId(selectedRoleId);
      setIsAdminWarningDialogOpen(true);
      return;
    }

    await processInvite();
  };

  const processInvite = async () => {
    setInviting(true);
    setError(null);
    try {
      await api.post('/api/team/invite', {
        email: inviteEmail,
        roleId: selectedRoleId
      });
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setSelectedRoleId('');
      // Refresh the list
      const response = await api.get('/api/team/members');
      setMembers(response.data.members || []);
    } catch {
      setError('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCreateRole = async () => {
    if (!roleName.trim() || selectedPermissions.length === 0) {
      setError('Please provide role name and select permissions');
      return;
    }

    setCreatingRole(true);
    setError(null);
    try {
      await api.post('/api/team/roles', {
        name: roleName,
        permissionIds: selectedPermissions
      });
      setIsRoleDialogOpen(false);
      setRoleName('');
      setSelectedPermissions([]);
      // Refresh the list
      const response = await api.get('/api/team/roles');
      setRoles(response.data.roles || []);
    } catch {
      setError('Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleUpdateMemberRole = async () => {
    if (!selectedMember || !newRoleId) {
      setError('Please select a new role');
      return;
    }

    setUpdatingRole(true);
    setError(null);
    try {
      await api.put(`/api/team/members/${selectedMember.id}/role`, { roleId: newRoleId });
      setIsRoleChangeDialogOpen(false);
      setSelectedMember(null);
      setNewRoleId('');
      // Refresh the list
      const response = await api.get('/api/team/members');
      setMembers(response.data.members || []);
    } catch {
      setError('Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    setError(null);
    try {
      await api.delete(`/api/team/members/${memberId}`);
      // Refresh the list
      const response = await api.get('/api/team/members');
      setMembers(response.data.members || []);
    } catch {
      setError('Failed to remove member');
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setRoleName(role.name);
    setSelectedPermissions(role.permissions.map(rp => rp.permission.key));
    setIsEditRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedRole || !roleName.trim() || selectedPermissions.length === 0) {
      setError('Please provide role name and select permissions');
      return;
    }

    setEditingRole(true);
    setError(null);
    try {
      // Get permission IDs from permission keys
      const permissionIds = permissions
        .filter(p => selectedPermissions.includes(p.key))
        .map(p => p.id);

      await api.put(`/api/team/roles/${selectedRole.id}`, {
        name: roleName,
        permissionIds
      });
      setIsEditRoleDialogOpen(false);
      setSelectedRole(null);
      setRoleName('');
      setSelectedPermissions([]);
      // Refresh the list
      const response = await api.get('/api/team/roles');
      setRoles(response.data.roles || []);
    } catch {
      setError('Failed to update role');
    } finally {
      setEditingRole(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete the "${role.name}" role? This action cannot be undone.`)) return;

    setDeletingRole(true);
    setError(null);
    try {
      await api.delete(`/api/team/roles/${role.id}`);
      // Refresh the list
      const response = await api.get('/api/team/roles');
      setRoles(response.data.roles || []);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to delete role');
      }
    } finally {
      setDeletingRole(false);
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
      const newSelectedId: string[] = members.map((n) => n.id);
      setSelected(newSelectedId);
      setSelectedValue(members);
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
    const selectedRowData: TeamMember[] = members.filter((row) => newSelected.includes(row.id));
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

  // Menu handlers
  const handleMenuOpen = (event: MouseEvent<HTMLElement>, member: TeamMember) => {
    setAnchorEl(event.currentTarget);
    setMenuMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuMember(null);
  };

  const handleRoleChange = (member: TeamMember) => {
    setSelectedMember(member);
    setIsRoleChangeDialogOpen(true);
    handleMenuClose();
  };

  const handleRoleSelection = (roleId: string) => {
    setNewRoleId(roleId);
    
    // Check if the selected role is admin
    const selectedRole = roles.find(role => role.id === roleId);
    if (selectedRole?.name.toLowerCase() === 'admin') {
      setPendingRoleId(roleId);
      setIsAdminWarningDialogOpen(true);
    }
  };

  const handleConfirmAdminRole = () => {
    setIsAdminWarningDialogOpen(false);
    // Process the pending action (either invite or role change)
    if (isInviteDialogOpen) {
      processInvite();
    }
    // For role changes, the role is already set in newRoleId, so we can proceed
  };

  const handleCancelAdminRole = () => {
    setIsAdminWarningDialogOpen(false);
    if (isInviteDialogOpen) {
      setSelectedRoleId('');
    } else {
      setNewRoleId('');
    }
    setPendingRoleId('');
  };

  const handleRemove = (member: TeamMember) => {
    handleRemoveMember(member.id);
    handleMenuClose();
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'owner':
        return <Crown size={16} style={{ color: '#f59e0b' }} />;
      case 'admin':
        return <Shield size={16} style={{ color: '#3b82f6' }} />;
      case 'trainer':
        return <User size={16} style={{ color: '#10b981' }} />;
      default:
        return <User size={16} style={{ color: '#6b7280' }} />;
    }
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'owner':
        return 'warning';
      case 'admin':
        return 'primary';
      case 'trainer':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!workspaceId) {
    return (
      <MainCard sx={{ borderStyle: 'dashed' }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6"><FormattedMessage id="team.selectWorkspace" defaultMessage="Select a workspace" /></Typography>
          <Typography color="text.secondary"><FormattedMessage id="team.selectWorkspace.help" defaultMessage="Open a workspace subdomain to manage team members." /></Typography>
        </Box>
      </MainCard>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary"><FormattedMessage id="team.loading" defaultMessage="Loading team..." /></Typography>
        </Stack>
      </Box>
    );
  }

  // Feature gate (hide UI if team members disabled)
  const [featuresError, setFeaturesError] = useState<string | null>(null);
  const [teamEnabled, setTeamEnabled] = useState<boolean>(true);
  useEffect(() => {
    const run = async () => {
      try {
        if (!workspaceId) return;
        const { data } = await api.get(`/api/workspaces/${workspaceId}/subscription`);
        const enabled = data?.subscription?.teamMembersEnabled ?? data?.subscription?.package?.teamMembersEnabled ?? true;
        setTeamEnabled(!!enabled);
      } catch (e: any) {
        setFeaturesError(e?.response?.data?.error || null);
        setTeamEnabled(true);
      }
    };
    run();
  }, [workspaceId]);

  if (!teamEnabled) {
    return (
      <MainCard sx={{ borderStyle: 'dashed' }}>
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6"><FormattedMessage id="team.disabled" defaultMessage="Team Members feature is not enabled for this workspace" /></Typography>
          <Typography color="text.secondary"><FormattedMessage id="team.disabled.help" defaultMessage="Upgrade or enable the feature in your subscription to manage team members." /></Typography>
        </Box>
      </MainCard>
    );
  }

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - members.length) : 0;

  return (
    <WorkspaceSubscriptionGuard description="Activate a plan to manage team members and roles.">
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
            <FormattedMessage id="team.title" defaultMessage="Team Management" />
          </Typography>
          <Typography color="text.secondary"><FormattedMessage id="team.subtitle" defaultMessage="Manage your workspace members, roles, and permissions" /></Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button variant="outlined" startIcon={<Shield />} onClick={() => setIsRoleDialogOpen(true)}>
            <FormattedMessage id="team.createRole" defaultMessage="Create Role" />
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setIsInviteDialogOpen(true)}>
            <FormattedMessage id="team.inviteMember" defaultMessage="Invite Member" />
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Team Members Table */}
      {members.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage id="team.empty.title" defaultMessage="No team members yet" />
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              <FormattedMessage id="team.empty.subtitle" defaultMessage="Invite your first team member to get started" />
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setIsInviteDialogOpen(true)}>
              <FormattedMessage id="team.inviteMember" defaultMessage="Invite Member" />
            </Button>
          </Box>
        </MainCard>
      ) : (
        <MainCard
          content={false}
          title={`${intl.formatMessage({ id: 'team.members', defaultMessage: 'Team Members' })} (${members.length})`}
          secondary={<CSVExport data={selectedValue.length > 0 ? selectedValue : members} filename={'team-members.csv'} />}
        >
          <RowSelection selected={selected.length} />

          {/* table */}
          {isMobile ? (
            // Mobile Cards View
            <Grid container spacing={2}>
              {stableSort(members, getComparator(order, orderBy))
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
                            {/* Header with Checkbox and Avatar */}
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Checkbox 
                                color="primary" 
                                checked={isItemSelected} 
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
                                {row.user.fullName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6">
                                  {row.user.fullName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {row.user.email}
                                </Typography>
                              </Box>
                            </Stack>

                            <Divider />

                            {/* Role Information */}
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Role
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                {getRoleIcon(row.role.name)}
                                <Chip 
                                  label={row.role.name} 
                                  variant="outlined" 
                                  size="small" 
                                  color={getRoleColor(row.role.name) as any}
                                />
                              </Stack>
                            </Box>

                            <Divider />

                            {/* Join Date */}
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Joined
                              </Typography>
                              <Typography variant="body2">
                                {formatDate(row.createdAt)}
                              </Typography>
                            </Box>

                            <Divider />

                            {/* Actions */}
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, row); }}
                              >
                                <MenuIcon size={16} />
                              </IconButton>
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
                  rowCount={members.length}
                />
                <TableBody>
                  {stableSort(members, getComparator(order, orderBy))
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
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                {row.user.fullName.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {row.user.fullName}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {row.user.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {getRoleIcon(row.role.name)}
                              <Chip 
                                label={row.role.name} 
                                variant="outlined" 
                                size="small" 
                                color={getRoleColor(row.role.name) as any}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(row.createdAt)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, row); }}
                            >
                              <MenuIcon size={16} />
                            </IconButton>
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
            count={members.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </MainCard>
      )}

      {/* Roles Section */}
      <MainCard title={`Roles & Permissions (${roles.length})`}>
        <Stack spacing={2}>
          {roles.map((role) => (
            <Box key={role.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {getRoleIcon(role.name)}
                  <Typography variant="subtitle1" fontWeight={600}>
                    {role.name}
                  </Typography>
                  <Chip 
                    label={`${role._count.members} member${role._count.members !== 1 ? 's' : ''}`} 
                    variant="outlined" 
                    size="small" 
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleEditRole(role)}
                    disabled={['owner', 'admin', 'member'].includes(role.name.toLowerCase())}
                    title={['owner', 'admin', 'member'].includes(role.name.toLowerCase()) ? 'Cannot edit system roles' : 'Edit role'}
                  >
                    <Edit size={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteRole(role)}
                    disabled={deletingRole || ['owner', 'admin', 'member'].includes(role.name.toLowerCase()) || role._count.members > 0}
                    title={
                      ['owner', 'admin', 'member'].includes(role.name.toLowerCase()) 
                        ? 'Cannot delete system roles'
                        : role._count.members > 0 
                        ? 'Cannot delete role with assigned members'
                        : 'Delete role'
                    }
                    sx={{ color: 'error.main' }}
                  >
                    {deletingRole ? <CircularProgress size={16} /> : <Trash size={16} />}
                  </IconButton>
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Permissions:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {role.permissions.map((rp) => (
                  <Chip
                    key={rp.permission.key}
                    label={rp.permission.key}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </MainCard>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onClose={() => setIsInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Send an invitation to join your workspace with a specific role
          </Typography>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRoleId}
                label="Role"
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                {roles
                  .filter((role) => role.name.toLowerCase() !== 'owner') // Prevent owner role assignment
                  .map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getRoleIcon(role.name)}
                        <Typography>{role.name}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleInvite}
            disabled={!inviteEmail || !selectedRoleId || inviting}
            startIcon={inviting ? <CircularProgress size={16} /> : <Add />}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={isRoleDialogOpen} onClose={() => setIsRoleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Role</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Create a new role with specific permissions for your workspace
          </Typography>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Role Name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g., Trainer, Admin, Manager"
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Permissions
              </Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Stack spacing={1}>
                  {permissions.map((permission) => (
                    <Box key={permission.id} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions([...selectedPermissions, permission.id]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(id => id !== permission.id));
                          }
                        }}
                      />
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {permission.key}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateRole}
            disabled={!roleName || selectedPermissions.length === 0 || creatingRole}
            startIcon={creatingRole ? <CircularProgress size={16} /> : <Shield />}
          >
            Create Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onClose={() => setIsEditRoleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Update the role "{selectedRole?.name}" and its permissions
          </Typography>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Role Name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g., Trainer, Admin, Manager"
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Permissions
              </Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Stack spacing={1}>
                  {permissions.map((permission) => (
                    <Box key={permission.id} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={selectedPermissions.includes(permission.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions([...selectedPermissions, permission.key]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(key => key !== permission.key));
                          }
                        }}
                      />
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {permission.key}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditRoleDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateRole}
            disabled={!roleName || selectedPermissions.length === 0 || editingRole}
            startIcon={editingRole ? <CircularProgress size={16} /> : <Edit />}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isRoleChangeDialogOpen} onClose={() => setIsRoleChangeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Update the role for {selectedMember?.user.fullName}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>New Role</InputLabel>
            <Select
              value={newRoleId}
              label="New Role"
              onChange={(e) => handleRoleSelection(e.target.value)}
            >
              {roles
                .filter((role) => role.name.toLowerCase() !== 'owner') // Prevent owner role assignment
                .map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getRoleIcon(role.name)}
                      <Typography>{role.name}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRoleChangeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateMemberRole}
            disabled={!newRoleId || updatingRole}
            startIcon={updatingRole ? <CircularProgress size={16} /> : <Edit />}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Warning Dialog */}
      <Dialog open={isAdminWarningDialogOpen} onClose={handleCancelAdminRole} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Shield size={24} style={{ color: '#f59e0b' }} />
            <Typography variant="h6">Admin Role Assignment Warning</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              ⚠️ Admin Access Warning
            </Typography>
            <Typography variant="body2">
              You are about to assign admin privileges to <strong>
                {isInviteDialogOpen ? inviteEmail : selectedMember?.user.fullName}
              </strong>. 
              This will give them extensive access to your workspace.
            </Typography>
          </Alert>
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Admin users will have access to:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Team Management:</strong> Invite, remove, and manage all team members
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Role Management:</strong> Create, edit, and delete roles and permissions
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Workspace Settings:</strong> Modify workspace configuration and settings
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Content Management:</strong> Create, edit, and delete all content
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Client Management:</strong> Manage all clients and their data
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Analytics & Reports:</strong> Access all workspace analytics and reports
            </Typography>
          </Box>

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Note:</strong> Only the workspace owner can remove admin privileges. 
              Make sure you trust this person with full access to your workspace.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAdminRole} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmAdminRole}
            color="warning"
            startIcon={<Shield />}
          >
            Confirm Admin Assignment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Member Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleRoleChange(menuMember!)}>
          <ListItemIcon>
            <Edit size={16} />
          </ListItemIcon>
          <ListItemText>Change Role</ListItemText>
        </MenuItem>
        {menuMember?.role.name !== 'owner' && (
          <MenuItem onClick={() => handleRemove(menuMember!)} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Trash size={16} />
            </ListItemIcon>
            <ListItemText>Remove Member</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
    </WorkspaceSubscriptionGuard>
  );
}
