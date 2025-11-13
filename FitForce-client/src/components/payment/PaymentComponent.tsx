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
  Stack,
} from '@mui/material';

interface PaymentComponentProps {
  paymentUrl: string;
  paymentType: 'iframe' | 'redirect';
  onSuccess: (paymentData: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  amount: number;
  currency: string;
  discountCents?: number;
  commissionCreditCents?: number;
  originalAmountCents?: number;
  promoCode?: {
    id: string;
    code: string;
    discountPercentage: number;
  } | null;
}

export const PaymentComponent: React.FC<PaymentComponentProps> = ({
  paymentUrl,
  paymentType,
  onSuccess,
  onError,
  onCancel,
  amount,
  currency,
  discountCents = 0,
  commissionCreditCents = 0,
  originalAmountCents,
  promoCode,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirectWindow, setRedirectWindow] = useState<Window | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security - allow both Paymob and our mock server
      const allowedOrigins = [
        'https://accept.paymob.com',
        'http://localhost:4000',
        'https://localhost:4000',
        'https://api.nano.com',
        'http://api.nano.com',
        'https://api.nano.com:4000',
        'http://api.nano.com:4000',
        'https://fitforce.io',
        'http://fitforce.io'
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
      } else if (data.type === 'payment_close') {
        setLoading(false);
        // Payment window was closed, check status
        console.log('Payment window closed');
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

  const handleRedirectPayment = () => {
    setLoading(true);
    
    // Open payment page in a new window
    const windowFeatures = 'width=800,height=600,scrollbars=yes,resizable=yes';
    const newWindow = window.open(paymentUrl, 'payment', windowFeatures);
    
    if (!newWindow) {
      setError('Failed to open payment window. Please check your popup blocker.');
      setLoading(false);
      return;
    }
    
    setRedirectWindow(newWindow);
    
    // Monitor the payment window
    const checkClosed = setInterval(() => {
      if (newWindow.closed) {
        clearInterval(checkClosed);
        setLoading(false);
        // Check payment status or show a message
        // In a real implementation, you'd poll the server for payment status
        console.log('Payment window closed');
      }
    }, 1000);
    
    // Clean up interval after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      if (!newWindow.closed) {
        newWindow.close();
      }
    }, 300000);
  };

  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  const paymentSummary = (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Payment Summary
      </Typography>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Original Amount: {formatPrice(originalAmountCents ?? amount, currency)}
        </Typography>
        {discountCents > 0 && (
          <Typography variant="body2" color="text.secondary">
            Promo Discount: −{formatPrice(discountCents, currency)}
          </Typography>
        )}
        {commissionCreditCents > 0 && (
          <Typography variant="body2" color="text.secondary">
            Commission Credit: −{formatPrice(commissionCreditCents, currency)}
          </Typography>
        )}
        <Typography variant="body1" fontWeight={700}>
          Amount Due: {formatPrice(amount, currency)}
        </Typography>
        {promoCode && (
          <Typography variant="caption" color="text.secondary">
            Promo `{promoCode.code}` ({promoCode.discountPercentage}%)
          </Typography>
        )}
      </Stack>
    </Box>
  );

  const renderPaymentContent = () => {
    if (paymentType === 'redirect') {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" gutterBottom>
            Ready to Complete Payment
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Click the button below to open the payment page in a new window.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleRedirectPayment}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            {loading ? 'Opening Payment Page...' : 'Open Payment Page'}
          </Button>
          {loading && (
            <Box sx={{ mt: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Please complete the payment in the new window
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    // Iframe payment (Paymob)
    return (
      <Box sx={{ position: 'relative', minHeight: 500 }}>
        <iframe
          ref={iframeRef}
          src={paymentUrl}
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
    );
  };

  return (
    <Dialog open={true} maxWidth="md" fullWidth>
      <DialogTitle>
        Complete Payment - {formatPrice(amount, currency)}
      </DialogTitle>
      <DialogContent>
        {paymentSummary}
        {loading && paymentType === 'iframe' && (
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

        {renderPaymentContent()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="secondary">
          Cancel Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
};
