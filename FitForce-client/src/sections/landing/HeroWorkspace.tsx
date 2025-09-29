'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type Props = {
  title: string;
  subtitle?: string;
  primaryColor?: string;
  ctaText?: string;
  ctaUrl?: string;
  roleButtons?: React.ReactNode;
  heroImage?: string | null;
};

export default function HeroWorkspace({ title, subtitle, primaryColor = '#3b82f6', ctaText, ctaUrl, roleButtons, heroImage }: Props) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(to bottom, background.default, background.paper)',
        py: 8
      }}
    >
      {heroImage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.08
          }}
        />
      )}
      <Container maxWidth="lg" sx={{ position: 'relative', textAlign: 'center' }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: '50px',
            border: 1,
            borderColor: `${primaryColor}20`,
            bgcolor: `${primaryColor}10`,
            color: primaryColor,
            fontSize: '0.875rem',
            fontWeight: 500,
            mb: 4
          }}
        >
          ⭐ Powered by FitForce
        </Box>
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 'bold',
            mb: 2,
            background: `linear-gradient(to right, hsl(var(--mui-palette-text-primary)), ${primaryColor}, hsl(var(--mui-palette-text-secondary)))`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: { xs: '2.5rem', sm: '3rem', lg: '4rem' }
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ maxWidth: 800, mx: 'auto', mb: 4, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
          >
            {subtitle}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            justifyContent: 'center',
            alignItems: 'center',
            mb: 6
          }}
        >
          {roleButtons}
          {ctaText && ctaUrl && (
            <Button variant="outlined" size="large" href={ctaUrl} target="_blank">
              {ctaText}
            </Button>
          )}
        </Box>
      </Container>
    </Box>
  );
}
