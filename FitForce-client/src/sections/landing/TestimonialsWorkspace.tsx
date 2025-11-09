'use client';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

type Testimonial = { quote: string; author: string; role: string };

export default function TestimonialsWorkspace({
  testimonials,
  primaryColor = '#3b82f6'
}: {
  testimonials: Testimonial[];
  primaryColor?: string;
}) {
  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Grid container spacing={4}>
        {testimonials.map((testimonial, index) => (
          <Grid size={{ xs: 12, md: 6 }} key={index}>
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
                <Box sx={{ display: 'flex', mb: 3, gap: 0.5 }}>
                  {[...Array(5)].map((_, i) => (
                    <Typography key={i} sx={{ color: '#fbbf24', fontSize: '1.5rem' }}>
                      ⭐
                    </Typography>
                  ))}
                </Box>
                <Typography variant="h6" sx={{ fontStyle: 'italic', mb: 3, fontSize: '1.25rem', lineHeight: 1.7, color: 'text.primary' }}>
                  &ldquo;{testimonial.quote}&rdquo;
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: `${primaryColor}15`,
                      border: `2px solid ${primaryColor}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: primaryColor }}>
                      {testimonial.author.charAt(0)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {testimonial.author}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem' }}>
                      {testimonial.role}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
