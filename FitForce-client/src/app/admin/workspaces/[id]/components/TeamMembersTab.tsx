'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, Search } from '@mui/icons-material';
import api from '@/utils/axios';

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  members: Array<{
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
    createdAt: string;
  }>;
  subscription?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    package: {
      id: string;
      name: string;
      durationMonths: number;
      priceCents: number;
    };
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
}

interface TeamMembersTabProps {
  workspace: Workspace;
  onRefresh: () => void;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

export default function TeamMembersTab({ workspace, onRefresh }: TeamMembersTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearchUsers = async () => {
    if (!searchEmail.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get(`/api/admin/users/search?email=${encodeURIComponent(searchEmail)}`);
      setSearchResults(data.users || []);
    } catch (e) {
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser || !selectedRoleId) {
      setError('Please select a user and role');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.post(`/api/admin/workspaces/${workspace.id}/members`, {
        userId: selectedUser.id,
        roleId: selectedRoleId,
      });
      setIsAddDialogOpen(false);
      setSearchEmail('');
      setSearchResults([]);
      setSelectedUser(null);
      setSelectedRoleId('');
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = async () => {
    if (!selectedMember || !selectedRoleId) {
      setError('Please select a role');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.put(`/api/admin/workspaces/${workspace.id}/members/${selectedMember.id}`, {
        roleId: selectedRoleId,
      });
      setIsEditDialogOpen(false);
      setSelectedMember(null);
      setSelectedRoleId('');
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/api/admin/workspaces/${workspace.id}/members/${selectedMember.id}`);
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (member: any) => {
    setSelectedMember(member);
    setSelectedRoleId(member.role.id);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (member: any) => {
    setSelectedMember(member);
    setIsDeleteDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Team Members ({workspace.members.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setIsAddDialogOpen(true)}
        >
          Add Member
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workspace.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.user.fullName}</TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={member.role.name}
                      color={member.role.name === 'owner' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(member)}
                      title="Edit Role"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openDeleteDialog(member)}
                      title="Remove Member"
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="Search by email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
              />
              <Button
                variant="outlined"
                startIcon={<Search />}
                onClick={handleSearchUsers}
                disabled={loading}
              >
                Search
              </Button>
            </Box>

            {loading && <CircularProgress size={24} />}

            {searchResults.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Select User:
                </Typography>
                {searchResults.map((user) => (
                  <Box
                    key={user.id}
                    sx={{
                      p: 1,
                      border: selectedUser?.id === user.id ? '2px solid' : '1px solid',
                      borderColor: selectedUser?.id === user.id ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      mb: 1,
                    }}
                    onClick={() => setSelectedUser(user)}
                  >
                    <Typography variant="body1" fontWeight={500}>
                      {user.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                label="Role"
              >
                {workspace.roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddMember}
            variant="contained"
            disabled={!selectedUser || !selectedRoleId || loading}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Member Role</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {selectedMember && (
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {selectedMember.user.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedMember.user.email}
                </Typography>
              </Box>
            )}
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                label="Role"
              >
                {workspace.roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditMember}
            variant="contained"
            disabled={!selectedRoleId || loading}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Member Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Remove Team Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{' '}
            <strong>{selectedMember?.user.fullName}</strong> from this workspace?
          </Typography>
          {selectedMember?.role.name === 'owner' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This user has owner privileges. Make sure there are other owners in the workspace.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteMember}
            variant="contained"
            color="error"
            disabled={loading}
          >
            Remove Member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
