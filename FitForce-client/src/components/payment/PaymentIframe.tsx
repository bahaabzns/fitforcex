import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

interface PaymentIframeProps {
  iframeUrl: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  amount: number;
  currency: string;
}

export const PaymentIframe: React.FC<PaymentIframeProps> = ({
  iframeUrl,
  onSuccess,
  onError,
  onCancel,
  amount,
  currency,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security - allow both Paymob and our mock server
      const allowedOrigins = [
        'https://accept.paymob.com',
        'http://localhost:4000',
        'https://localhost:4000',
        'https://api.nano.com'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      const data = event.data;
      
      if (data.type === 'payment_success') {
        setLoading(false);
        onSuccess(data);
      } else if (data.type === 'payment_error') {
        setLoading(false);
        setError(data.message || 'Payment failed');
        onError(data.message || 'Payment failed');
      } else if (data.type === 'payment_cancel') {
        setLoading(false);
        onCancel();
      }
    };

    window.addEventListener('message', handleMessage);

    // Set up timeout for loading
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 30000); // 30 seconds timeout

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [loading, onSuccess, onError, onCancel]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load payment page');
  };

  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  return (
    <Dialog open={true} maxWidth="md" fullWidth>
      <DialogTitle>
        Complete Payment - {formatPrice(amount, currency)}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading payment page...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ position: 'relative', minHeight: 500 }}>
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            width="100%"
            height="500"
            frameBorder="0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{
              border: 'none',
              borderRadius: '8px',
              display: loading ? 'none' : 'block',
            }}
            title="Payment Gateway"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="secondary">
          Cancel Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
};
