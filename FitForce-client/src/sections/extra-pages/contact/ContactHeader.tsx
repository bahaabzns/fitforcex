// material-ui
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// assets
import AuthBackground from '../../../../public/assets/images/auth/AuthBackground';

// ==============================|| CONTACT US - HEADER ||============================== //

export default function ContactHeader() {
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', pt: 9, pb: 2 }}>
      <AuthBackground />
      <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
        <Box sx={{ width: { xs: '100%', sm: 360, lg: 436 }, px: 2, py: 6, mx: 'auto' }}>
          <Stack sx={{ gap: 1 }}>
            <Typography align="center" variant="h2">
              Contact Us
            </Typography>
            <Typography align="center" sx={{ color: 'text.secondary' }}>
              We’re here to help.
            </Typography>
            <Typography align="center" sx={{ color: 'text.secondary' }}>
              📞 Mobile (Egypt): +20 10 04914771
            </Typography>
            <Typography align="center" sx={{ color: 'text.secondary' }}>
              📧 Email: info@fitforce.io
            </Typography>
            <Typography align="center" sx={{ color: 'text.secondary' }}>
              📍 Address: Cairo, Egypt
            </Typography>
            <Typography align="center" sx={{ color: 'text.secondary' }}>
              For technical support, billing questions, or partnerships, reach out anytime — our team will get back to you as soon as
              possible.
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
