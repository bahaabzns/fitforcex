'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Grid, TextField, Button, Stack, Typography, Alert, Snackbar } from '@mui/material';
import api from '@/utils/axios';

type ConfigResponse = {
  config: {
    appId: string;
    appSecretMasked: string | null;
    verifyTokenMasked: string | null;
    businessId: string;
    pageId: string;
    pixelId: string;
    whatsappPhoneId: string;
    accessTokenMasked: string | null;
    webhookUrl: string;
  } | null;
};

export default function MetaIntegrationPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState({
    appId: '',
    appSecret: '',
    verifyToken: '',
    businessId: '',
    pageId: '',
    pixelId: '',
    whatsappPhoneId: '',
    accessToken: '',
    webhookUrl: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await api.get<ConfigResponse>('/api/admin/meta-integration');
        const cfg = data.config;
        if (cfg) {
          setForm((prev) => ({
            ...prev,
            appId: cfg.appId || '',
            businessId: cfg.businessId || '',
            pageId: cfg.pageId || '',
            pixelId: cfg.pixelId || '',
            whatsappPhoneId: cfg.whatsappPhoneId || '',
            webhookUrl: cfg.webhookUrl || ''
          }));
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put('/api/admin/meta-integration', form);
      setSnack('Saved');
      setForm((prev) => ({ ...prev, appSecret: '', verifyToken: '', accessToken: '' }));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    try {
      setTesting(true);
      setError(null);
      setTestResults(null);
      
      const response = await api.post('/api/admin/meta-integration/test', {});
      setTestResults(response.data);
      
      if (response.data.success) {
        setSnack('✅ Connection test successful!');
      } else {
        setSnack('⚠️ Connection test completed with issues');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Test failed');
      setTestResults(e?.response?.data || null);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 }, maxWidth: 1000, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800}>Meta Integration</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onTest} disabled={testing || saving}>
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>Save</Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {testResults && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Results
              {testResults.success ? (
                <Typography component="span" color="success.main" sx={{ ml: 1 }}>
                  ✅ Success
                </Typography>
              ) : (
                <Typography component="span" color="error.main" sx={{ ml: 1 }}>
                  ❌ Failed
                </Typography>
              )}
            </Typography>
            
            {testResults.summary && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Tests: {testResults.summary.passedTests}/{testResults.summary.totalTests} passed
                  {testResults.summary.criticalPassed ? ' (Critical tests passed)' : ' (Critical tests failed)'}
                </Typography>
              </Box>
            )}

            {testResults.testResults && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Test Details:</Typography>
                {Object.entries(testResults.testResults).map(([key, passed]) => (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    {passed ? (
                      <Typography color="success.main" sx={{ mr: 1 }}>✅</Typography>
                    ) : (
                      <Typography color="error.main" sx={{ mr: 1 }}>❌</Typography>
                    )}
                    <Typography variant="body2">
                      {key === 'pixelId' && 'Pixel ID'}
                      {key === 'appId' && 'App ID'}
                      {key === 'accessToken' && 'Access Token'}
                      {key === 'businessId' && 'Business ID'}
                      {key === 'pageId' && 'Page ID'}
                      {key === 'webhookUrl' && 'Webhook URL'}
                      {key === 'publicApi' && 'Public API'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {testResults.errors && testResults.errors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error.main" gutterBottom>Errors:</Typography>
                {testResults.errors.map((error: string, index: number) => (
                  <Typography key={index} variant="body2" color="error.main" sx={{ ml: 2 }}>
                    • {error}
                  </Typography>
                ))}
              </Box>
            )}

            {testResults.warnings && testResults.warnings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="warning.main" gutterBottom>Warnings:</Typography>
                {testResults.warnings.map((warning: string, index: number) => (
                  <Typography key={index} variant="body2" color="warning.main" sx={{ ml: 2 }}>
                    • {warning}
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="App ID" value={form.appId} onChange={onChange('appId')} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="App Secret" value={form.appSecret} onChange={onChange('appSecret')} fullWidth placeholder="Enter to update" type="password" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Verify Token" value={form.verifyToken} onChange={onChange('verifyToken')} fullWidth placeholder="Enter to update" type="password" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Business ID" value={form.businessId} onChange={onChange('businessId')} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Page ID" value={form.pageId} onChange={onChange('pageId')} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Pixel ID" value={form.pixelId} onChange={onChange('pixelId')} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="WhatsApp Phone ID" value={form.whatsappPhoneId} onChange={onChange('whatsappPhoneId')} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Access Token" value={form.accessToken} onChange={onChange('accessToken')} fullWidth placeholder="Enter to update" type="password" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Webhook URL" value={form.webhookUrl} onChange={onChange('webhookUrl')} fullWidth placeholder="https://..." />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={2000} onClose={() => setSnack(null)} message={snack || ''} />
    </Box>
  );
}


