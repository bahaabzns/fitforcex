// material-ui
import { styled } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// third-party
import { motion } from 'framer-motion';

// project-imports
import Logo from 'components/logo';

// assets
import { Dribbble, Youtube } from '@wandersonalwes/iconsax-react';
import GithubIcon from '../../../public/assets/third-party/github';

// link - custom style
const FooterLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.primary,
  '&:hover, &:active': {
    color: theme.palette.primary.main
  }
}));

type showProps = {
  isFull?: boolean;
};

// ==============================|| LANDING - FOOTER PAGE ||============================== //

export default function FooterBlock({ isFull }: showProps) {
  const linkSX = { color: 'text.secondary', fontWeight: 400, opacity: '0.6', cursor: 'pointer', '&:hover': { opacity: '1' } };

  return (
    <>
      <Box sx={{ pt: isFull ? 5 : 10, pb: 10, bgcolor: 'secondary.200', borderColor: 'divider' }}>
        <Container>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 550 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 150,
                  damping: 30
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <Logo to="/" />
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 400, maxWidth: 320 }}>
                      FitForce empowers fitness professionals worldwide with comprehensive tools for client management, 
                      nutrition planning, workout design, and business growth.
                    </Typography>
                  </Grid>
                </Grid>
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={{ xs: 5, md: 2 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Company</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="/about" underline="none">
                        About Us
                      </FooterLink>
                      <FooterLink href="/contact" underline="none">
                        Contact
                      </FooterLink>
                      <FooterLink href="/careers" underline="none">
                        Careers
                      </FooterLink>
                      <FooterLink href="/blog" underline="none">
                        Blog
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Help & Support</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="/help" underline="none">
                        Help Center
                      </FooterLink>
                      <FooterLink href="/contact" underline="none">
                        Contact Support
                      </FooterLink>
                      <FooterLink href="/features" underline="none">
                        Features
                      </FooterLink>
                      <FooterLink href="/pricing" underline="none">
                        Pricing
                      </FooterLink>
                      <FooterLink href="/demo" underline="none">
                        Book Demo
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Legal</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="/privacy" underline="none">
                        Privacy Policy
                      </FooterLink>
                      <FooterLink href="/terms" underline="none">
                        Terms of Service
                      </FooterLink>
                      <FooterLink href="/security" underline="none">
                        Security
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: 2.4, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'secondary.200' }}>
        <Container>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Typography>
                © {new Date().getFullYear()} FitForce. All rights reserved.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                {/* Social media links can be added here when FitForce accounts are available */}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
