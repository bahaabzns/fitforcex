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
} from "@mui/material";
import { useAppSelector } from "@/store";
import api from "@/utils/axios";
import { FormattedMessage, useIntl } from "react-intl";

interface Client {
  id: string;
  fullName: string;
  email?: string;
  workspaceEmail?: string;
  status: string;
  hasDeviceToken: boolean;
  lastUpdated: string;
}

export default function PushNotificationsPage() {
  const intl = useIntl();
  const workspaceId = useAppSelector((s) => s.workspace.id);
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
    loadClients();
  }, [workspaceId]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/push-notifications/clients");
      setClients(res.data.clients || []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
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

      const res = await api.post("/api/push-notifications/send", payload);
      
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
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        <FormattedMessage id="pushNotifications.title" defaultMessage="Push Notifications" />
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        <FormattedMessage id="pushNotifications.subtitle" defaultMessage="Send instant notifications to clients" />
      </Typography>

      {loading ? (
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
                <FormattedMessage id="send_push_notification" defaultMessage="Send Push Notification" />
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
                  label={<FormattedMessage id="title" defaultMessage="Title" />}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  required
                  placeholder="e.g., New Workout Plan Available"
                />

                <TextField
                  label={<FormattedMessage id="message" defaultMessage="Message" />}
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
                  label={
                    <FormattedMessage
                      id="send_to_all_clients"
                      defaultMessage="Send to all clients with device tokens"
                    />
                  }
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
                        label={<FormattedMessage id="select_clients" defaultMessage="Select Clients" />}
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
                      <FormattedMessage id="sending" defaultMessage="Sending..." />
                    </>
                  ) : (
                    <FormattedMessage id="send_notification" defaultMessage="Send Notification" />
                  )}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Clients List */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <FormattedMessage id="clients_with_device_tokens" defaultMessage="Clients with Device Tokens" />
              </Typography>

              {clientsWithTokens.length === 0 ? (
                <Alert severity="info">
                  <FormattedMessage
                    id="no_clients_with_tokens"
                    defaultMessage="No clients have registered device tokens yet. They will appear here once they install and open the mobile app."
                  />
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
                    <FormattedMessage id="clients_without_tokens" defaultMessage="Clients without Device Tokens" />
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

