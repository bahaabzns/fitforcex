'use client';

import { useState, cloneElement, ReactElement, CSSProperties } from 'react';
// next
import Link from 'next/link';

// material-ui
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import Links from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project-imports
import AnimateButton from 'components/@extended/AnimateButton';
import IconButton from 'components/@extended/IconButton';
import LanguageSwitcher from 'components/customization/LanguageSwitcher';

// assets
import { HambergerMenu, Minus } from '@wandersonalwes/iconsax-react';

interface ElevationScrollProps {
  layout: string;
  children: ReactElement<{ style?: CSSProperties }>;
  window?: () => Window;
}

// elevation scroll
function ElevationScroll({ children, window }: ElevationScrollProps) {
  const theme = useTheme();
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 10,
    target: window ? window() : undefined
  });

  return cloneElement(children, {
    style: {
      boxShadow: trigger ? '0 8px 6px -10px rgba(0, 0, 0, 0.5)' : 'none',
      backgroundColor: trigger ? alpha(theme.palette.background.default, 0.8) : alpha(theme.palette.background.default, 0.1)
    }
  } as any);
}

interface Props {
  layout?: string;
}

// ==============================|| COMPONENTS - APP BAR ||============================== //

export default function Header({ layout = 'landing', ...others }: Props) {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [drawerToggle, setDrawerToggle] = useState<boolean>(false);
  
  // Get scroll state for logo switching
  const isScrolled = useScrollTrigger({
    disableHysteresis: true,
    threshold: 10
  });

  /** Method called on multiple components with different event types */
  const drawerToggler = (open: boolean) => (event: any) => {
    if (event.type! === 'keydown' && (event.key! === 'Tab' || event.key! === 'Shift')) {
      return;
    }
    setDrawerToggle(open);
  };

  /** Smooth scroll to section */
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setDrawerToggle(false); // Close mobile menu after clicking
  };

  return (
    <ElevationScroll layout={layout} {...others}>
      <AppBar
        sx={(theme) => ({
          bgcolor: alpha(theme.palette.background.default, 0.1),
          backdropFilter: 'blur(8px)',
          color: 'text.primary',
          boxShadow: 'none'
        })}
      >
        <Container maxWidth="xl" disableGutters={downMD}>
          <Toolbar sx={{ px: { xs: 1.5, sm: 4, md: 0, lg: 0 }, py: 0.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', flexGrow: 1, display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ display: 'inline-block' }}>
                <Link href="/">
                  <img 
                    src={isScrolled ? "/assets/header_logo/down.png" : "/assets/header_logo/hero.png"} 
                    alt="FitForce" 
                    style={{ height: 40, cursor: 'pointer' }}
                  />
                </Link>
              </Box>
            </Stack>
            <Stack
              direction="row"
              sx={{
                gap: 3,
                alignItems: 'center',
                display: { xs: 'none', md: 'flex' },
                '& .header-link': { fontWeight: 500, '&:hover': { color: 'primary.main' } }
              }}
            >
              {/* Navigation Links */}
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Links
                  component="button"
                  onClick={() => scrollToSection('problem-solution')}
                  sx={{ 
                    color: isScrolled ? 'text.primary' : 'white', 
                    textDecoration: 'none', 
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    '&:hover': { color: isScrolled ? 'primary.main' : 'rgba(255,255,255,0.8)' }
                  }}
                >
                  Problem & Solution
                </Links>
                <Links
                  component="button"
                  onClick={() => scrollToSection('why-fitforce')}
                  sx={{ 
                    color: isScrolled ? 'text.primary' : 'white', 
                    textDecoration: 'none', 
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    '&:hover': { color: isScrolled ? 'primary.main' : 'rgba(255,255,255,0.8)' }
                  }}
                >
                  Why FitForce
                </Links>
                <Links
                  component="button"
                  onClick={() => scrollToSection('pricing')}
                  sx={{ 
                    color: isScrolled ? 'text.primary' : 'white', 
                    textDecoration: 'none', 
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    '&:hover': { color: isScrolled ? 'primary.main' : 'rgba(255,255,255,0.8)' }
                  }}
                >
                  Pricing
                </Links>
                <Links
                  component="button"
                  onClick={() => scrollToSection('book-demo')}
                  sx={{ 
                    color: isScrolled ? 'text.primary' : 'white', 
                    textDecoration: 'none', 
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    '&:hover': { color: isScrolled ? 'primary.main' : 'rgba(255,255,255,0.8)' }
                  }}
                >
                  Book Demo
                </Links>
              </Box>
              <LanguageSwitcher />
              
              <Box sx={{ display: 'inline-block' }}>
                <AnimateButton>
                  <Button
                    component={Link}
                    href="/login"
                    disableElevation
                    size="large"
                    variant={isScrolled ? "contained" : "outlined"}
                    sx={{
                      color: isScrolled ? 'white' : 'white',
                      borderColor: isScrolled ? 'primary.main' : 'white',
                      bgcolor: isScrolled ? 'primary.main' : 'transparent',
                      '&:hover': {
                        bgcolor: isScrolled ? 'primary.dark' : 'rgba(255,255,255,0.1)',
                        borderColor: isScrolled ? 'primary.dark' : 'white'
                      }
                    }}
                  >
                    Login
                  </Button>
                </AnimateButton>
              </Box>
            </Stack>
            <Box
              sx={{
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                display: { xs: 'flex', md: 'none' }
              }}
            >
              <Box sx={{ display: 'inline-block' }}>
                <Link href="/">
                  <img 
                    src={isScrolled ? "/assets/header_logo/down.png" : "/assets/header_logo/hero.png"} 
                    alt="FitForce" 
                    style={{ height: 32, cursor: 'pointer' }}
                  />
                </Link>
              </Box>
              <Stack direction="row" sx={{ gap: 2 }}>
                <LanguageSwitcher />
                <Button
                  variant={isScrolled ? "contained" : "outlined"}
                  component={Link}
                  href="/login"
                  sx={{ 
                    mt: 0.25,
                    color: isScrolled ? 'white' : 'white',
                    borderColor: isScrolled ? 'primary.main' : 'white',
                    bgcolor: isScrolled ? 'primary.main' : 'transparent',
                    '&:hover': {
                      bgcolor: isScrolled ? 'primary.dark' : 'rgba(255,255,255,0.1)',
                      borderColor: isScrolled ? 'primary.dark' : 'white'
                    }
                  }}
                >
                  Login
                </Button>

                <IconButton
                  size="large"
                  color="secondary"
                  onClick={drawerToggler(true)}
                  sx={{ p: 1 }}
                >
                  <HambergerMenu />
                </IconButton>
              </Stack>
              <Drawer
                anchor="top"
                open={drawerToggle}
                onClose={drawerToggler(false)}
                slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
              >
                <Box
                  sx={{
                    width: 'auto',
                    '& .MuiListItemIcon-root': {
                      fontSize: '1rem',
                      minWidth: 32
                    }
                  }}
                  role="presentation"
                  onKeyDown={drawerToggler(false)}
                >
                  <List>
                    <ListItemButton onClick={() => scrollToSection('problem-solution')}>
                      <ListItemIcon>
                        <Minus />
                      </ListItemIcon>
                      <ListItemText primary="Problem & Solution" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                    </ListItemButton>
                    <ListItemButton onClick={() => scrollToSection('why-fitforce')}>
                      <ListItemIcon>
                        <Minus />
                      </ListItemIcon>
                      <ListItemText primary="Why FitForce" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                    </ListItemButton>
                    <ListItemButton onClick={() => scrollToSection('pricing')}>
                      <ListItemIcon>
                        <Minus />
                      </ListItemIcon>
                      <ListItemText primary="Pricing" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                    </ListItemButton>
                    <ListItemButton onClick={() => scrollToSection('book-demo')}>
                      <ListItemIcon>
                        <Minus />
                      </ListItemIcon>
                      <ListItemText primary="Book Demo" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                    </ListItemButton>
                    <Links style={{ textDecoration: 'none' }} component={Link} href="/login">
                      <ListItemButton>
                        <ListItemIcon>
                          <Minus />
                        </ListItemIcon>
                        <ListItemText primary="Login" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                      </ListItemButton>
                    </Links>
                    <Links style={{ textDecoration: 'none' }} component={Link} href="/dashboard">
                      <ListItemButton>
                        <ListItemIcon>
                          <Minus />
                        </ListItemIcon>
                        <ListItemText primary="Dashboard" slotProps={{ primary: { variant: 'h6', color: 'secondary.main' } }} />
                      </ListItemButton>
                    </Links>
                  </List>
                </Box>
              </Drawer>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
    </ElevationScroll>
  );
}
