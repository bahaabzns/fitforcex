// next
import Link from 'next/link';

// material-ui
import ButtonBase from '@mui/material/ButtonBase';
import { SxProps } from '@mui/system';
import { Box } from '@mui/material';

// third-party
import { To } from 'history';

// project-imports
import Logo from './LogoMain';
import LogoIcon from './LogoIcon';
import { APP_DEFAULT_PATH } from 'config';

// ==============================|| WORKSPACE LOGO ||============================== //

interface Props {
  reverse?: boolean;
  isIcon?: boolean;
  sx?: SxProps;
  to?: To;
}

export default function WorkspaceLogo({ reverse, isIcon, sx, to }: Props) {
  const LogoContent = () => {
    // Always use the core FitForce branding in the trainer/admin dashboard.
    // Client portal pages use their own layouts and headers to show workspace logos.
    return isIcon ? <LogoIcon /> : <Logo reverse={reverse} />;
  };

  return (
    <ButtonBase disableRipple component={Link} href={!to ? APP_DEFAULT_PATH : to} sx={sx}>
      <LogoContent />
    </ButtonBase>
  );
}
