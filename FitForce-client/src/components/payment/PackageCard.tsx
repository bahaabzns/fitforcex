import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

interface PackageCardProps {
  packageData: {
    id: string;
    name: string;
    description?: string;
    durationMonths: number;
    priceCents: number;
    currency: string;
    features?: any;
    isActive?: boolean;
  };
  onSubscribe: (packageData: any) => void;
  type: 'workspace' | 'client';
  currentSubscription?: {
    id: string;
    status: string;
    endDate: string;
  };
}

export const PackageCard: React.FC<PackageCardProps> = ({
  packageData,
  onSubscribe,
  type,
  currentSubscription,
}) => {
  const formatPrice = (cents: number, currency: string) => {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  };

  const getDurationText = (months: number) => {
    if (months === 1) return '1 Month';
    if (months === 3) return '3 Months';
    if (months === 6) return '6 Months';
    if (months === 12) return '1 Year';
    return `${months} Months`;
  };

  const isCurrentPackage = currentSubscription && 
    new Date(currentSubscription.endDate) > new Date() &&
    (currentSubscription.status === 'active' || currentSubscription.status === 'pre_start');

  const getFeatures = () => {
    if (!packageData.features) return [];
    
    if (typeof packageData.features === 'object') {
      return Object.entries(packageData.features).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    }
    
    return [];
  };

  const features = getFeatures();

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        ...(isCurrentPackage && {
          border: '2px solid',
          borderColor: 'primary.main',
        }),
      }}
    >
      {isCurrentPackage && (
        <Chip
          label={intl.formatMessage({ id: 'current-plan' })}
          color="primary"
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1,
          }}
        />
      )}
      
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          {packageData.name}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="h3" color="primary" component="span">
            {formatPrice(packageData.priceCents, packageData.currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
            / {getDurationText(packageData.durationMonths)}
          </Typography>
        </Box>

        {packageData.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {packageData.description}
          </Typography>
        )}

        {features.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Features
            </Typography>
            <List dense>
              {features.map((feature, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircle color="primary" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={feature.value}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          variant={isCurrentPackage ? "outlined" : "contained"}
          onClick={() => onSubscribe(packageData)}
          disabled={!packageData.isActive}
          size="large"
        >
          {isCurrentPackage ? 'Current Plan' : 'Subscribe'}
        </Button>
      </CardActions>
    </Card>
  );
};
