'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { Add, PersonAdd, SwapHoriz } from '@mui/icons-material';
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

interface OwnersTabProps {
  workspace: Workspace;
  onRefresh: () => void;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

export default function OwnersTab({ workspace, onRefresh }: OwnersTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [ownerAction, setOwnerAction] = useState<'add' | 'replace'>('add');
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

  const handleAddOwner = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.post(`/api/admin/workspaces/${workspace.id}/owners`, {
        userId: selectedUser.id,
        action: ownerAction,
      });
      
      setIsAddDialogOpen(false);
      setIsReplaceDialogOpen(false);
      setSearchEmail('');
      setSearchResults([]);
      setSelectedUser(null);
      setOwnerAction('add');
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update owner');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setOwnerAction('add');
    setIsAddDialogOpen(true);
  };

  const openReplaceDialog = () => {
    setOwnerAction('replace');
    setIsReplaceDialogOpen(true);
  };

  const resetForm = () => {
    setSearchEmail('');
    setSearchResults([]);
    setSelectedUser(null);
    setOwnerAction('add');
  };

  // Get all owners (users with owner role)
  const owners = workspace.members.filter(member => member.role.name === 'owner');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Owner Management ({owners.length} owner{owners.length !== 1 ? 's' : ''})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={openAddDialog}
          >
            Add Co-Owner
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<SwapHoriz />}
            onClick={openReplaceDialog}
          >
            Replace Owner
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Current Owners */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Owners
          </Typography>
          <Grid container spacing={2}>
            {owners.map((owner) => (
              <Grid item xs={12} md={6} key={owner.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PersonAdd fontSize="small" color="primary" />
                      <Typography variant="subtitle1" fontWeight={500}>
                        {owner.user.fullName}
                      </Typography>
                      {owner.user.id === workspace.owner.id && (
                        <Chip label="Primary Owner" color="primary" size="small" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {owner.user.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Joined: {new Date(owner.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Primary Owner Info */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Primary Owner Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Name:
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {workspace.owner.fullName}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Email:
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {workspace.owner.email}
              </Typography>
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              The primary owner is the user set in the workspace.ownerId field. 
              You can have multiple co-owners with owner role, but only one primary owner.
            </Alert>
          </Box>
        </CardContent>
      </Card>

      {/* Add Co-Owner Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Co-Owner</DialogTitle>
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

            <Alert severity="info">
              Adding a co-owner will give this user full owner privileges in the workspace.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddOwner}
            variant="contained"
            disabled={!selectedUser || loading}
          >
            Add Co-Owner
          </Button>
        </DialogActions>
      </Dialog>

      {/* Replace Owner Dialog */}
      <Dialog open={isReplaceDialogOpen} onClose={() => setIsReplaceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Replace Primary Owner</DialogTitle>
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
                  Select New Owner:
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

            <Alert severity="warning">
              <Typography variant="subtitle2" gutterBottom>
                Warning: Replacing the primary owner will:
              </Typography>
              <ul>
                <li>Change the workspace.ownerId field to the new user</li>
                <li>Remove the current primary owner from workspace members</li>
                <li>Add the new user as a member with owner role</li>
                <li>This action cannot be undone easily</li>
              </ul>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsReplaceDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddOwner}
            variant="contained"
            color="warning"
            disabled={!selectedUser || loading}
          >
            Replace Owner
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
