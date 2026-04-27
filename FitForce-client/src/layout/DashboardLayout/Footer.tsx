// next
import Link from 'next/link';

// material-ui
import Links from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ==============================|| MAIN LAYOUT - FOOTER ||============================== //

export default function Footer() {
  return (
    <Stack direction={{ sm: 'row' }} sx={{ gap: 1, justifyContent: 'space-between', alignItems: 'center', pt: 0, mt: 'auto' }}>
      <Typography variant="caption">
        &copy; {new Date().getFullYear()} FitForce. All rights reserved.
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
        <Links component={Link} href="/" variant="caption" color="text.primary">
          Home
        </Links>
        <Links component={Link} href="/pricing" variant="caption" color="text.primary">
          Pricing
        </Links>
        <Links component={Link} href="/contact" variant="caption" color="text.primary">
          Support
        </Links>
      </Stack>
    </Stack>
  );
}
