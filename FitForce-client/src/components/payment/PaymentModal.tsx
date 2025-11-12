import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import api from '@/utils/axios';

interface BillingData {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  shipping_method?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  state?: string;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (paymentData: any) => void;
  packageData?: {
    id: string;
    name: string;
    description?: string;
    durationMonths: number;
    priceCents: number;
    currency: string;
    features?: any;
  };
  type: 'workspace' | 'client';
  workspaceId: string;
  clientId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  onSuccess,
  packageData,
  type,
  workspaceId,
  clientId,
}) => {
  const [billingData, setBillingData] = useState<BillingData>({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    apartment: '',
    floor: '',
    street: '',
    building: '',
    shipping_method: 'PKG',
    postal_code: '',
    city: '',
    country: 'EG',
    state: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch and pre-fill user data when modal opens
  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setBillingData({
        email: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        apartment: '',
        floor: '',
        street: '',
        building: '',
        shipping_method: 'PKG',
        postal_code: '',
        city: '',
        country: 'EG',
        state: '',
      });
      return;
    }

    setLoadingUserData(true);
    const fetchUserData = async () => {
      try {
        if (type === 'workspace') {
          // For workspace subscriptions, get the workspace owner's data
          const { data: workspaceData } = await api.get(`/api/workspaces/${workspaceId}`);
          const owner = workspaceData.workspace?.owner;
          if (owner) {
            const nameParts = (owner.fullName || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            setBillingData(prev => ({
              ...prev,
              email: owner.email || '',
              first_name: firstName,
              last_name: lastName,
              phone_number: owner.phoneNumber || '',
            }));
          }
        } else if (type === 'client' && clientId) {
          // For client subscriptions, get the client's data
          const { data: clientData } = await api.get(`/api/clients/${workspaceId}/${clientId}`);
          const client = clientData.client;
          if (client) {
            const nameParts = (client.fullName || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            setBillingData(prev => ({
              ...prev,
              email: client.email || '',
              first_name: firstName,
              last_name: lastName,
              phone_number: client.phone || '',
            }));
          }
        } else {
          // Fallback: get current logged-in user data
          const { data: userData } = await api.get('/api/auth/me');
          const user = userData.user;
          if (user) {
            const nameParts = (user.fullName || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            setBillingData(prev => ({
              ...prev,
              email: user.email || '',
              first_name: firstName,
              last_name: lastName,
              phone_number: user.phoneNumber || '',
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        // Silently fail - user can still fill manually
      } finally {
        setLoadingUserData(false);
      }
    };
    fetchUserData();
  }, [open, type, workspaceId, clientId]);

  const handleInputChange = (field: keyof BillingData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setBillingData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async () => {
    if (!packageData) {
      setError('Please select a package first.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const endpoint = type === 'workspace' 
        ? `/api/workspaces/${workspaceId}/subscribe`
        : `/api/clients/${workspaceId}/subscribe`;

      const requestBody = type === 'workspace'
        ? {
            packageId: packageData.id,
            billingData,
          }
        : {
            clientId,
            packageId: packageData.id,
            billingData,
          };

      const { data } = await api.post(endpoint, requestBody);
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {packageData ? `Subscribe to ${packageData.name}` : 'Select a Package'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {packageData ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Package Details
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h5" color="primary" gutterBottom>
                {formatPrice(packageData.priceCents, packageData.currency)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                Duration: {packageData.durationMonths} month{packageData.durationMonths > 1 ? 's' : ''}
              </Typography>
              {packageData.description && (
                <Typography variant="body2" color="text.secondary">
                  {packageData.description}
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 3 }}>
            No package selected. Please close this dialog and choose a package.
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Billing Information
        </Typography>

        {loadingUserData ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading your information...
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={billingData.first_name}
                onChange={handleInputChange('first_name')}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={billingData.last_name}
                onChange={handleInputChange('last_name')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={billingData.email}
                onChange={handleInputChange('email')}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={billingData.phone_number}
                onChange={handleInputChange('phone_number')}
                required
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <LoadingButton
          onClick={handleSubmit}
          loading={loading}
          variant="contained"
          disabled={!packageData || !billingData.first_name || !billingData.email || !billingData.phone_number || loadingUserData}
        >
          Proceed to Payment
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
