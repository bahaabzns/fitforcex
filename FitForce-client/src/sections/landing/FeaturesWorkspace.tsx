'use client';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

type Feature = { title: string; description: string; icon?: string };

export default function FeaturesWorkspace({ features, primaryColor = '#3b82f6' }: { features: Feature[]; primaryColor?: string }) {
  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Grid container spacing={4}>
        {features.map((feature, index) => (
          <Grid size={{ xs: 12, md: 4 }} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                border: 1,
                borderColor: 'divider',
                transition: 'all 0.3s ease',
                '&:hover': { 
                  boxShadow: `0 12px 32px ${primaryColor}20`,
                  transform: 'translateY(-4px)',
                  borderColor: primaryColor
                } 
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ mb: 3 }}>
                  {feature.icon ? (
                    <img src={feature.icon} alt={feature.title} style={{ width: 64, height: 64 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: `${primaryColor}15`,
                        border: `2px solid ${primaryColor}30`
                      }}
                    >
                      <Typography sx={{ color: primaryColor, fontSize: 32 }}>🏋️</Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
                  {feature.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
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
