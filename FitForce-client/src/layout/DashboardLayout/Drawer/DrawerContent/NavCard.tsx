// material-ui
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';
import MainCard from 'components/MainCard';

// assets
const avatar = '/assets/images/users/customer-support-1.png';

// ==============================|| DRAWER CONTENT - NAV CARD ||============================== //

export default function NavCard() {
  return (
    <MainCard sx={{ bgcolor: 'background.paper', m: 3 }}>
      <Stack sx={{ gap: 2.5, alignItems: 'center' }}>
        <CardMedia component="img" image={avatar} />
        <Stack sx={{ alignItems: 'center' }}>
          <Typography variant="h5">Need Support?</Typography>
          <Typography variant="h6" color="secondary">
            1 Day Response Time
          </Typography>
        </Stack>
        <AnimateButton>
          <Button variant="shadow" size="small" component={Link} href="https://wa.me/201006206308" target="_blank">
            Support
          </Button>
        </AnimateButton>
      </Stack>
    </MainCard>
  );
}
