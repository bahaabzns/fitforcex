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
    <Box sx={{ py: 8 }}>
      <Grid container spacing={4}>
        {testimonials.map((testimonial, index) => (
          <Grid size={{ xs: 12, md: 6 }} key={index}>
            <Card sx={{ height: '100%', '&:hover': { boxShadow: 6 } }}>
              <CardContent>
                <Box sx={{ display: 'flex', mb: 2 }}>
                  {[...Array(5)].map((_, i) => (
                    <Typography key={i} sx={{ color: '#fbbf24' }}>
                      ⭐
                    </Typography>
                  ))}
                </Box>
                <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2 }}>
                  &ldquo;{testimonial.quote}&rdquo;
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: `${primaryColor}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 'semibold', color: primaryColor }}>
                      {testimonial.author.charAt(0)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'semibold' }}>
                      {testimonial.author}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
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
