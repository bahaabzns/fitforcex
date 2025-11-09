'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';

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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}15 50%, background.paper 100%)`,
        py: { xs: 10, sm: 12, md: 16 }
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
            px: 3,
            py: 1.5,
            borderRadius: '50px',
            border: 2,
            borderColor: `${primaryColor}30`,
            bgcolor: `${primaryColor}15`,
            color: primaryColor,
            fontSize: '1rem',
            fontWeight: 600,
            mb: 5,
            boxShadow: `0 4px 12px ${primaryColor}20`
          }}
        >
          ⭐ Powered by FitForce
        </Box>
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 900,
            mb: 3,
            // Fix transparency issue: use solid color in light mode, gradient in dark mode
            ...(isDark ? {
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd, ${primaryColor}aa)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            } : {
              color: 'text.primary',
              textShadow: `0 2px 8px ${primaryColor}30`
            }),
            fontSize: { xs: '3rem', sm: '4rem', md: '5rem', lg: '6rem' },
            lineHeight: 1.1,
            letterSpacing: '-0.02em'
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="h5"
            sx={{ 
              maxWidth: 900, 
              mx: 'auto', 
              mb: 6, 
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
              fontWeight: 400,
              color: 'text.secondary',
              lineHeight: 1.6
            }}
          >
            {subtitle}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 3,
            justifyContent: 'center',
            alignItems: 'center',
            mb: 6
          }}
        >
          {roleButtons}
          {ctaText && ctaUrl && (
            <Button 
              variant="contained" 
              size="large" 
              href={ctaUrl} 
              target="_blank"
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                bgcolor: primaryColor,
                '&:hover': {
                  bgcolor: primaryColor,
                  opacity: 0.9,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 24px ${primaryColor}40`
                },
                transition: 'all 0.3s ease'
              }}
            >
              {ctaText}
            </Button>
          )}
        </Box>
      </Container>
    </Box>
  );
}
