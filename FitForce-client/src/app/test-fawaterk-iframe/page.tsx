'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  Stack,
  TextField,
  Typography,
  Button as MuiButton,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import { FawaterkIframe } from '@/components/payment/FawaterkIframe';

export default function FawaterkIframeTestPage() {
  const [billingData, setBillingData] = useState({
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '0123456789',
    city: 'Cairo',
    country: 'Egypt',
    address: 'Test Address',
  });
  const [paymentMethod, setPaymentMethod] = useState<'api' | 'iframe'>('iframe');
  const [showIframe, setShowIframe] = useState(false);
  const [result, setResult] = useState<any>(null);

  const packageData = {
    id: 'test-package-1',
    name: 'Test Package',
    priceCents: 5000, // 50 EGP
    currency: 'EGP',
  };

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setBillingData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = () => {
    if (paymentMethod === 'iframe') {
      setShowIframe(true);
    } else {
      // API method would go here
      setResult({ type: 'api', message: 'API method not implemented in this test' });
    }
  };

  const handleIframeSuccess = (data: any) => {
    setResult({ type: 'success', data });
    setShowIframe(false);
  };

  const handleIframeError = (error: string) => {
    setResult({ type: 'error', error });
    setShowIframe(false);
  };

  const handleIframeCancel = () => {
    setResult({ type: 'cancel', message: 'Payment cancelled by user' });
    setShowIframe(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ p: 4, width: '100%', maxWidth: 600 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight={700} textAlign="center">
            Fawaterk Iframe Integration Test
          </Typography>

          <FormControl component="fieldset">
            <FormLabel component="legend">Payment Method</FormLabel>
            <RadioGroup
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'api' | 'iframe')}
              row
            >
              <FormControlLabel 
                value="iframe" 
                control={<Radio />} 
                label="Iframe Method (Embedded)" 
              />
              <FormControlLabel 
                value="api" 
                control={<Radio />} 
                label="API Method (Redirect)" 
              />
            </RadioGroup>
          </FormControl>

          <Typography variant="h6">Package Details</Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography><strong>Name:</strong> {packageData.name}</Typography>
            <Typography><strong>Price:</strong> {(packageData.priceCents / 100).toFixed(2)} {packageData.currency}</Typography>
          </Box>

          <Typography variant="h6">Billing Information</Typography>
          <Stack spacing={2}>
            <TextField 
              label="Email" 
              value={billingData.email} 
              onChange={handleInputChange('email')} 
              required 
              fullWidth 
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField 
                label="First Name" 
                value={billingData.first_name} 
                onChange={handleInputChange('first_name')} 
                required 
                fullWidth 
              />
              <TextField 
                label="Last Name" 
                value={billingData.last_name} 
                onChange={handleInputChange('last_name')} 
                required 
                fullWidth 
              />
            </Stack>
            <TextField 
              label="Phone Number" 
              value={billingData.phone_number} 
              onChange={handleInputChange('phone_number')} 
              required 
              fullWidth 
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField 
                label="City" 
                value={billingData.city} 
                onChange={handleInputChange('city')} 
                required 
                fullWidth 
              />
              <TextField 
                label="Country" 
                value={billingData.country} 
                onChange={handleInputChange('country')} 
                required 
                fullWidth 
              />
            </Stack>
            <TextField 
              label="Address" 
              value={billingData.address} 
              onChange={handleInputChange('address')} 
              fullWidth 
            />
          </Stack>

          <MuiButton 
            variant="contained" 
            size="large" 
            onClick={handleSubmit}
            fullWidth
          >
            {paymentMethod === 'iframe' ? 'Open Payment Form' : 'Create Payment Session'}
          </MuiButton>

          {result && (
            <Alert severity={result.type === 'success' ? 'success' : result.type === 'error' ? 'error' : 'info'}>
              <Typography variant="h6">{result.type.toUpperCase()}</Typography>
              <pre style={{ fontSize: '12px', marginTop: '8px' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" textAlign="center">
            This is a test page for Fawaterk iframe integration. 
            {paymentMethod === 'iframe' && ' The iframe method will show payment options directly in the page.'}
            {paymentMethod === 'api' && ' The API method will redirect to Fawaterk payment page.'}
          </Typography>
        </Stack>
      </Card>

      {/* Fawaterk Iframe Component */}
      <FawaterkIframe
        open={showIframe}
        onClose={() => setShowIframe(false)}
        onSuccess={handleIframeSuccess}
        onError={handleIframeError}
        onCancel={handleIframeCancel}
        packageData={packageData}
        billingData={billingData}
        workspaceId="test-workspace"
        clientId="test-client"
      />
    </Box>
  );
}
