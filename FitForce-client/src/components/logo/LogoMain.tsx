// material-ui
import { useTheme } from '@mui/material/styles';

/**
 * if you want to use image instead of <svg> uncomment following.
 *
 * import logoDark from 'assets/images/logo-dark.svg';
 * import logo from 'assets/images/logo.svg';
 *
 */

// ==============================|| LOGO SVG ||============================== //

export default function LogoMain({ reverse }: { reverse?: boolean }) {
  const theme = useTheme();
  
  // Use hero.png in dark mode, down.png in light mode
  const logoSrc = theme.palette.mode === 'dark' 
    ? '/assets/header_logo/hero.png' 
    : '/assets/header_logo/down.png';
  
  return (
    <img src={logoSrc} alt="FitForce" style={{ display: 'block', width: '100%', height: 'auto' }} />
  );
}
