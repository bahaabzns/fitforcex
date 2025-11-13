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
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Stack,
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

interface PromoPreviewResponse {
  currency: string;
  priceCents: number;
  discountCents: number;
  finalAmountCents: number;
  commissionCreditCents: number;
  availableCommissionCreditCents: number;
  amountDueCents: number;
  promoCode?: {
    id: string;
    code: string;
    discountPercentage: number;
    commissionPercentage: number;
    allowDiscount: boolean;
    allowCommission: boolean;
    expiresAt?: string | null;
  } | null;
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
  const [promoPreview, setPromoPreview] = useState<PromoPreviewResponse | null>(null);
  const [promoPreviewLoading, setPromoPreviewLoading] = useState(false);
  const [creditMode, setCreditMode] = useState<'none' | 'all' | 'custom'>('none');
  const [customCreditValue, setCustomCreditValue] = useState('');
  const [creditError, setCreditError] = useState<string | null>(null);

  const summaryCurrency = promoPreview?.currency || packageData?.currency || 'EGP';
  const originalPriceCents = packageData?.priceCents ?? 0;
  const discountCents = Math.max(promoPreview?.discountCents ?? 0, 0);
  const finalAmountAfterDiscountCents = promoPreview?.finalAmountCents ?? originalPriceCents;
  const availableCreditCents =
    type === 'workspace' ? Math.max(promoPreview?.availableCommissionCreditCents ?? 0, 0) : 0;
  const maxCreditApplicable =
    type === 'workspace' ? Math.min(availableCreditCents, finalAmountAfterDiscountCents) : 0;

  const sanitizeCustomCreditCents = (): number => {
    const sanitized = customCreditValue.replace(/,/g, '').trim();
    if (!sanitized) return 0;
    const parsed = Number(sanitized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NaN;
    }
    return Math.round(parsed * 100);
  };

  const rawCustomCreditCents = sanitizeCustomCreditCents();
  const selectedCreditCents =
    type === 'workspace'
      ? creditMode === 'all'
        ? maxCreditApplicable
        : creditMode === 'custom'
          ? (Number.isNaN(rawCustomCreditCents)
              ? 0
              : Math.min(rawCustomCreditCents, maxCreditApplicable))
          : 0
      : 0;
  const amountDueCents = Math.max(finalAmountAfterDiscountCents - selectedCreditCents, 0);

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
      setPromoPreview(null);
      setPromoPreviewLoading(false);
      setCreditMode('none');
      setCustomCreditValue('');
      setCreditError(null);
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

  useEffect(() => {
    if (!open || type !== 'workspace' || !packageData) {
      setPromoPreview(null);
      setPromoPreviewLoading(false);
      setCreditMode('none');
      setCustomCreditValue('');
      setCreditError(null);
      return;
    }

    setPromoPreviewLoading(true);
    const controller = new AbortController();

    api
      .get<PromoPreviewResponse>(`/api/workspaces/${workspaceId}/promo-preview`, {
        params: { packageId: packageData.id },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setPromoPreview(data);
        setCreditMode('none');
        setCustomCreditValue('');
        setCreditError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('Failed to fetch promo preview:', err);
        setPromoPreview(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPromoPreviewLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, type, workspaceId, packageData?.id]);

  useEffect(() => {
    if (type !== 'workspace') {
      setCreditError(null);
      return;
    }

    if (creditMode !== 'custom') {
      setCreditError(null);
      return;
    }

    const cents = sanitizeCustomCreditCents();
    if (Number.isNaN(cents)) {
      setCreditError('Enter a valid credit amount');
      return;
    }

    if (cents > maxCreditApplicable) {
      setCreditError(`Maximum credit you can use is ${(maxCreditApplicable / 100).toFixed(2)} ${summaryCurrency}`);
    } else {
      setCreditError(null);
    }
  }, [creditMode, customCreditValue, maxCreditApplicable, summaryCurrency, type]);

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

    if (type === 'workspace') {
      if (creditMode === 'custom') {
        const cents = sanitizeCustomCreditCents();
        if (Number.isNaN(cents)) {
          setError('Enter a valid credit amount');
          return;
        }
        if (cents > maxCreditApplicable) {
          setError(`Maximum credit you can use is ${(maxCreditApplicable / 100).toFixed(2)} ${summaryCurrency}`);
          return;
        }
      }
      if (creditError) {
        setError(creditError);
        return;
      }
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
            creditUsageCents: selectedCreditCents,
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

        {type === 'workspace' && packageData && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Promo & Commission Credit
            </Typography>
            {promoPreviewLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Calculating discounts and available credit…
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="body2" color="text.secondary">
                      Original Price: {formatPrice(originalPriceCents, summaryCurrency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Discount: -{formatPrice(discountCents, summaryCurrency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Credit to Apply: -{formatPrice(selectedCreditCents, summaryCurrency)}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body1" fontWeight={700}>
                      Amount Due: {formatPrice(amountDueCents, summaryCurrency)}
                    </Typography>
                  </Stack>
                </Box>

                {promoPreview && promoPreview.availableCommissionCreditCents > 0 ? (
                  <Stack spacing={1.5}>
                    <FormControl>
                      <RadioGroup
                        value={creditMode}
                        onChange={(event) => setCreditMode(event.target.value as 'none' | 'all' | 'custom')}
                      >
                        <FormControlLabel
                          value="none"
                          control={<Radio />}
                          label="Don't use credits (pay full remaining amount)"
                        />
                        <FormControlLabel
                          value="all"
                          control={<Radio />}
                          label={`Use full credit (${formatPrice(maxCreditApplicable, summaryCurrency)})`}
                          disabled={maxCreditApplicable <= 0}
                        />
                        <FormControlLabel
                          value="custom"
                          control={<Radio />}
                          label="Use a custom credit amount"
                          disabled={maxCreditApplicable <= 0}
                        />
                      </RadioGroup>
                      <FormHelperText>
                        Available credit: {formatPrice(promoPreview.availableCommissionCreditCents, summaryCurrency)}
                      </FormHelperText>
                    </FormControl>
                    {creditMode === 'custom' && (
                      <TextField
                        label={`Credit amount (${summaryCurrency})`}
                        value={customCreditValue}
                        onChange={(event) => setCustomCreditValue(event.target.value)}
                        inputProps={{ inputMode: 'decimal' }}
                        helperText={
                          creditError ??
                          `Maximum credit usable right now: ${(maxCreditApplicable / 100).toFixed(2)}`
                        }
                        error={Boolean(creditError)}
                      />
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No commission credit available. Any eligible discounts are already applied above.
                  </Typography>
                )}
              </>
            )}
          </Box>
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
          disabled={
            !packageData ||
            !billingData.first_name ||
            !billingData.email ||
            !billingData.phone_number ||
            loadingUserData ||
            (type === 'workspace' && promoPreviewLoading) ||
            (type === 'workspace' && creditMode === 'custom' && Boolean(creditError))
          }
        >
          Proceed to Payment
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
