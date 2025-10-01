'use client';

import { useState } from 'react';
import api from '@/utils/axios';
import { Box, Typography, Card, CardContent, TextField, Button, Alert, Stack } from '@mui/material';

export default function FreeTrialPage() {
  const [subdomain, setSubdomain] = useState('');
  const [days, setDays] = useState(14);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleIssueTrial = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      // Placeholder: depends on backend admin endpoint to issue trial
      // POST /api/admin/workspaces/free-trial { email, subdomain, days }
      const { data } = await api.post('/api/admin/workspaces/free-trial', { subdomain, days }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setMessage('Free trial issued successfully.');
    } catch (e: any) {
      setError(e.message || 'Failed to issue trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>Free Trial</Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField label="Workspace Subdomain" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} fullWidth />
            <TextField label="Trial Days" type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} fullWidth />
            <Button variant="contained" onClick={handleIssueTrial} disabled={loading}>
              {loading ? 'Issuing…' : 'Issue Trial'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}


