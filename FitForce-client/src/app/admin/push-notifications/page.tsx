"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Autocomplete,
  Chip,
  Stack,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Notifications } from "@mui/icons-material";
import api from "@/utils/axios";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
}

interface Client {
  id: string;
  fullName: string;
  email?: string;
  workspaceEmail?: string;
  status: string;
  hasDeviceToken: boolean;
  lastUpdated: string;
  workspaceId: string;
  workspaceName?: string;
}

export default function AdminPushNotificationsPage() {
  const { adminUser } = useAdminAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [sendToAll, setSendToAll] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadClients();
    } else {
      setClients([]);
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const res = await api.get("/api/admin/workspaces");
      setWorkspaces(res.data.workspaces || []);
      if (res.data.workspaces?.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(res.data.workspaces[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load workspaces");
    }
  };

  const loadClients = async () => {
    if (!selectedWorkspaceId) return;
    
    try {
      setLoading(true);
      setError(null);
      // Use workspace-scoped endpoint with workspace ID header
      const res = await api.get("/api/push-notifications/clients", {
        headers: {
          "x-workspace-id": selectedWorkspaceId,
        },
      });
      const clientsWithWorkspace = (res.data.clients || []).map((client: any) => ({
        ...client,
        workspaceId: selectedWorkspaceId,
        workspaceName: workspaces.find((w) => w.id === selectedWorkspaceId)?.name,
      }));
      setClients(clientsWithWorkspace);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedWorkspaceId) {
      setError("Please select a workspace");
      return;
    }

    if (!title.trim() || !body.trim()) {
      setError("Title and body are required");
      return;
    }

    if (!sendToAll && selectedClients.length === 0) {
      setError("Please select at least one client or enable 'Send to All'");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        title: title.trim(),
        body: body.trim(),
        sendToAll,
      };

      if (!sendToAll) {
        payload.clientIds = selectedClients.map((c) => c.id);
      }

      const res = await api.post("/api/push-notifications/send", payload, {
        headers: {
          "x-workspace-id": selectedWorkspaceId,
        },
      });
      
      setSuccess(
        `Push notification sent successfully! ${res.data.sent} client(s) received, ${res.data.failed} failed.`
      );
      
      // Reset form
      setTitle("");
      setBody("");
      setSelectedClients([]);
      setSendToAll(false);
      
      // Reload clients to update device token status
      await loadClients();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to send push notification");
    } finally {
      setSending(false);
    }
  };

  const clientsWithTokens = clients.filter((c) => c.hasDeviceToken);
  const clientsWithoutTokens = clients.filter((c) => !c.hasDeviceToken);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 }, maxWidth: 1280, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Notifications color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Push Notifications
            </Typography>
            <Typography color="text.secondary">
              Send push notifications to clients across workspaces
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Workspace Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel>Select Workspace</InputLabel>
            <Select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              label="Select Workspace"
            >
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.subdomain})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {!selectedWorkspaceId ? (
        <Alert severity="info">Please select a workspace to view clients and send notifications.</Alert>
      ) : loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Statistics */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {clientsWithTokens.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clients with Device Tokens
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {clientsWithoutTokens.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Clients without Tokens
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          {/* Send Notification Form */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Send Push Notification
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                  {success}
                </Alert>
              )}

              <Stack spacing={3}>
                <TextField
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  required
                  placeholder="e.g., New Workout Plan Available"
                />

                <TextField
                  label="Message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  fullWidth
                  required
                  multiline
                  rows={4}
                  placeholder="Enter notification message..."
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={sendToAll}
                      onChange={(e) => {
                        setSendToAll(e.target.checked);
                        if (e.target.checked) {
                          setSelectedClients([]);
                        }
                      }}
                    />
                  }
                  label="Send to all clients with device tokens"
                />

                {!sendToAll && (
                  <Autocomplete
                    multiple
                    options={clientsWithTokens}
                    getOptionLabel={(option) => option.fullName}
                    value={selectedClients}
                    onChange={(_, newValue) => setSelectedClients(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Clients"
                        placeholder="Choose clients to notify"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option.fullName}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                  />
                )}

                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={sending || !title.trim() || !body.trim() || (!sendToAll && selectedClients.length === 0)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {sending ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Sending...
                    </>
                  ) : (
                    "Send Notification"
                  )}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Clients List */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Clients with Device Tokens
              </Typography>

              {clientsWithTokens.length === 0 ? (
                <Alert severity="info">
                  No clients have registered device tokens yet. They will appear here once they install and open the mobile app.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {clientsWithTokens.map((client) => (
                    <Box
                      key={client.id}
                      sx={{
                        p: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {client.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {client.workspaceEmail || client.email || "No email"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Status: {client.status} • Last updated:{" "}
                          {new Date(client.lastUpdated).toLocaleString()}
                        </Typography>
                      </Box>
                      <Chip label="Token Registered" color="success" size="small" />
                    </Box>
                  ))}
                </Stack>
              )}

              {clientsWithoutTokens.length > 0 && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
                    Clients without Device Tokens
                  </Typography>
                  <Stack spacing={1}>
                    {clientsWithoutTokens.slice(0, 10).map((client) => (
                      <Box
                        key={client.id}
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          opacity: 0.6,
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle1">{client.fullName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {client.workspaceEmail || client.email || "No email"}
                          </Typography>
                        </Box>
                        <Chip label="No Token" color="default" size="small" />
                      </Box>
                    ))}
                    {clientsWithoutTokens.length > 10 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>
                        + {clientsWithoutTokens.length - 10} more clients without tokens
                      </Typography>
                    )}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

