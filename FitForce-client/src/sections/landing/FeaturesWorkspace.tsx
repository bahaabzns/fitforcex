'use client';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

type Feature = { title: string; description: string; icon?: string };

export default function FeaturesWorkspace({ features, primaryColor = '#3b82f6' }: { features: Feature[]; primaryColor?: string }) {
  return (
    <Box sx={{ py: 8, bgcolor: 'background.paper' }}>
      <Grid container spacing={4}>
        {features.map((feature, index) => (
          <Grid size={{ xs: 12, md: 4 }} key={index}>
            <Card sx={{ height: '100%', '&:hover': { boxShadow: 6 } }}>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  {feature.icon ? (
                    <img src={feature.icon} alt={feature.title} style={{ width: 48, height: 48 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${primaryColor}10`
                      }}
                    >
                      <Typography sx={{ color: primaryColor, fontSize: 24 }}>🏋️</Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 'semibold', mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
