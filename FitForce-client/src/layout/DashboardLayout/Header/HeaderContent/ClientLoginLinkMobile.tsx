'use client';

import { useState, useEffect } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Copy } from '@wandersonalwes/iconsax-react';
import { useAppSelector } from '@/store';
import { APP_CONFIG } from '@/lib/config';
import { openSnackbar } from '@/api/snackbar';

export default function ClientLoginLinkMobile() {
  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);
  const [clientLoginUrl, setClientLoginUrl] = useState<string>('');

  useEffect(() => {
    // Get subdomain from Redux or cookies as fallback
    let subdomain = workspaceSubdomain;
    
    if (!subdomain && typeof window !== 'undefined') {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      subdomain = getCookie('ff_workspace_subdomain') || '';
    }

    if (subdomain) {
      const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
      const domain = APP_CONFIG.frontendDomain;
      const url = `${protocol}//${subdomain}.${domain}/client-login`;
      setClientLoginUrl(url);
    }
  }, [workspaceSubdomain]);

  const handleCopy = async () => {
    if (!clientLoginUrl) return;
    
    try {
      await navigator.clipboard.writeText(clientLoginUrl);
      openSnackbar({
        open: true,
        message: 'Client login link copied to clipboard',
        variant: 'alert',
        alert: { color: 'success' }
      } as any);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = clientLoginUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        openSnackbar({
          open: true,
          message: 'Client login link copied to clipboard',
          variant: 'alert',
          alert: { color: 'success' }
        } as any);
      } catch (e) {
        openSnackbar({
          open: true,
          message: 'Failed to copy link',
          variant: 'alert',
          alert: { color: 'error' }
        } as any);
      }
      document.body.removeChild(textArea);
    }
  };

  if (!clientLoginUrl) return null;

  return (
    <Tooltip title="Copy client login link">
      <IconButton
        size="small"
        onClick={handleCopy}
        sx={{
          p: 0.75,
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        <Copy size={18} />
      </IconButton>
    </Tooltip>
  );
}

