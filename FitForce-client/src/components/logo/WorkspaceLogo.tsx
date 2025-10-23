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
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';

// ==============================|| WORKSPACE LOGO ||============================== //

interface Props {
  reverse?: boolean;
  isIcon?: boolean;
  sx?: SxProps;
  to?: To;
}

export default function WorkspaceLogo({ reverse, isIcon, sx, to }: Props) {
  const { logoUrl, workspaceName } = useWorkspaceBranding();

  const LogoContent = () => {
    if (logoUrl) {
      // Use workspace logo
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={logoUrl} 
            alt={`${workspaceName} logo`} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              maxWidth: isIcon ? 32 : 120,
              maxHeight: isIcon ? 32 : 40
            }} 
          />
        </Box>
      );
    } else {
      // Fallback to FitForce logo
      return isIcon ? <LogoIcon /> : <Logo reverse={reverse} />;
    }
  };

  return (
    <ButtonBase disableRipple component={Link} href={!to ? APP_DEFAULT_PATH : to} sx={sx}>
      <LogoContent />
    </ButtonBase>
  );
}
