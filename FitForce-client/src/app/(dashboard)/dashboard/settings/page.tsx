import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import WorkspaceSubscriptionGuard from '@/components/WorkspaceSubscriptionGuard';

export default function SettingsPage() {
  return (
    <WorkspaceSubscriptionGuard description="Activate a plan to access workspace settings.">
      <Container sx={{ py: 4 }}>
        <Typography variant="h4">Settings</Typography>
      </Container>
    </WorkspaceSubscriptionGuard>
  );
}
