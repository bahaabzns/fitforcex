import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export default function LandingNotFound() {
  return (
    <Container sx={{ py: 6 }}>
      <Typography variant="h4">Workspace not found</Typography>
      <Typography variant="body1" color="text.secondary">
        We could not resolve the requested workspace.
      </Typography>
    </Container>
  );
}
