// material-ui
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';

// project-imports
import ContactHeader from 'sections/extra-pages/contact/ContactHeader';

// ==============================|| CONTACT US - MAIN ||============================== //

export default function ContactUSPage() {
  return (
    <Grid container spacing={12} sx={{ justifyContent: 'center', alignItems: 'center', mb: 12 }}>
      <Grid size={{ xs: 12, md: 12 }}>
        <ContactHeader />
      </Grid>
    </Grid>
  );
}
