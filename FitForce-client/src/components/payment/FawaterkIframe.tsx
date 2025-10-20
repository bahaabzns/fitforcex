'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import api from '@/utils/axios';

interface FawaterkIframeProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  packageData: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  };
  billingData: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    city: string;
    country: string;
    address?: string;
  };
  workspaceId: string;
  clientId?: string;
}

declare global {
  interface Window {
    fawaterkCheckout: (config: any) => void;
  }
}

export const FawaterkIframe: React.FC<FawaterkIframeProps> = ({
  open,
  onClose,
  onSuccess,
  onError,
  onCancel,
  packageData,
  billingData,
  workspaceId,
  clientId,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashKey, setHashKey] = useState<string | null>(null);
  const fawaterkDivRef = useRef<HTMLDivElement>(null);

  // Load Fawaterk plugin script
  useEffect(() => {
    if (!open) return;

    const script = document.createElement('script');
    script.src = 'https://app.fawaterk.com/fawaterkPlugin/fawaterkPlugin.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Fawaterk plugin loaded');
      initializePayment();
    };
    script.onerror = () => {
      setError('Failed to load Fawaterk payment plugin');
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script
      const existingScript = document.querySelector('script[src*="fawaterkPlugin"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [open]);

  const generateHashKey = async () => {
    try {
      const domain = window.location.hostname;
      const requestData = {
        domain,
        cartTotal: (packageData.priceCents / 100).toString(),
        currency: packageData.currency,
        customer: {
          first_name: billingData.first_name,
          last_name: billingData.last_name,
          email: billingData.email,
          phone: billingData.phone_number,
          address: billingData.address || `${billingData.city}, ${billingData.country}`,
        },
        redirectionUrls: {
          successUrl: `${window.location.origin}/payments/success`,
          failUrl: `${window.location.origin}/payments/failed`,
          pendingUrl: `${window.location.origin}/payments/pending`,
        },
        cartItems: [{
          name: packageData.name,
          price: (packageData.priceCents / 100).toString(),
          quantity: '1',
        }],
        payLoad: {
          workspaceId,
          clientId,
          packageId: packageData.id,
          type: clientId ? 'client' : 'workspace',
        },
      };

      const { data } = await api.post('/api/fawaterk/iframe/hash', requestData);
      return data.hashKey;
    } catch (err) {
      throw new Error('Failed to generate payment hash');
    }
  };

  const initializePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const hash = await generateHashKey();
      setHashKey(hash);

      const pluginConfig = {
        envType: process.env.NODE_ENV === 'production' ? 'live' : 'test',
        hashKey: hash,
        style: {
          listing: 'horizontal',
        },
        version: '0',
        requestBody: {
          cartTotal: (packageData.priceCents / 100).toString(),
          currency: packageData.currency,
          customer: {
            first_name: billingData.first_name,
            last_name: billingData.last_name,
            email: billingData.email,
            phone: billingData.phone_number,
            address: billingData.address || `${billingData.city}, ${billingData.country}`,
          },
          redirectionUrls: {
            successUrl: `${window.location.origin}/payments/success`,
            failUrl: `${window.location.origin}/payments/failed`,
            pendingUrl: `${window.location.origin}/payments/pending`,
          },
          cartItems: [{
            name: packageData.name,
            price: (packageData.priceCents / 100).toString(),
            quantity: '1',
          }],
          payLoad: {
            workspaceId,
            clientId,
            packageId: packageData.id,
            type: clientId ? 'client' : 'workspace',
          },
        },
      };

      // Clear previous content
      if (fawaterkDivRef.current) {
        fawaterkDivRef.current.innerHTML = '';
      }

      // Initialize Fawaterk checkout
      if (window.fawaterkCheckout) {
        window.fawaterkCheckout(pluginConfig);
        setLoading(false);
      } else {
        throw new Error('Fawaterk plugin not loaded');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Complete Payment</Typography>
        <Typography variant="body2" color="text.secondary">
          {packageData.name} - {(packageData.priceCents / 100).toFixed(2)} {packageData.currency}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ minHeight: 400, position: 'relative' }}>
          {loading && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 400,
              gap: 2
            }}>
              <CircularProgress />
              <Typography>Loading payment form...</Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {hashKey && !loading && (
            <Box>
              <div id="fawaterkDivId" ref={fawaterkDivRef} />
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button variant="outlined" onClick={onCancel}>
                  Cancel Payment
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
