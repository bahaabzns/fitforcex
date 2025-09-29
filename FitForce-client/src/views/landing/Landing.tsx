// simple public landing page
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Link from 'next/link';

export default function Landing() {
  return (
    <Container sx={{ py: 10 }}>
      <Stack sx={{ gap: 3, alignItems: 'center', textAlign: 'center' }}>
        <Typography variant="h2">Welcome to FitForce</Typography>
        <Typography variant="h5" color="text.secondary">
          Build your fitness business with client management, workouts, nutrition, and more.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button component={Link} href="/login" variant="contained">
            Login
          </Button>
          <Button component={Link} href="/register" variant="outlined">
            Get Started
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
