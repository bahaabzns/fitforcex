import { useState, useEffect, useRef } from 'react';

// material-ui
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';

// project-imports
import Transitions from 'components/@extended/Transitions';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';
import { APP_CONFIG } from '@/lib/config';

// assets
import { ArrowDown2, Building3 } from '@wandersonalwes/iconsax-react';

// ==============================|| WORKSPACE NAVIGATOR ||============================== //

interface Workspace {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  brandingLogoUrl?: string | null;
  brandingPrimaryHex?: string | null;
  ownerId?: string;
}

export default function WorkspaceNavigator() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  const workspaceSubdomain = useAppSelector((s) => s.workspace.subdomain);
  const workspaceId = useAppSelector((s) => s.workspace.id);

  // Fetch workspaces when dropdown opens
  useEffect(() => {
    if (open && workspaces.length === 0) {
      fetchWorkspaces();
    }
  }, [open]);

  // Fetch current workspace details
  useEffect(() => {
    if (workspaceSubdomain && workspaceId) {
      fetchCurrentWorkspace();
    }
  }, [workspaceSubdomain, workspaceId]);

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/workspaces');
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentWorkspace = async () => {
    try {
      const response = await api.get(`/api/workspaces/by-subdomain/${workspaceSubdomain}`);
      if (response.data?.workspace) {
        setCurrentWorkspace(response.data.workspace);
      }
    } catch (error) {
      console.error('Failed to fetch current workspace:', error);
      // Fallback to basic data from Redux
      setCurrentWorkspace({
        id: workspaceId || '',
        name: workspaceSubdomain || 'Workspace',
        subdomain: workspaceSubdomain || ''
      });
    }
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: MouseEvent | TouchEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as Node)) {
      return;
    }
    setOpen(false);
  };

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    // Don't switch if it's already the current workspace
    if (workspace.id === workspaceId) {
      setOpen(false);
      return;
    }

    // Clear old workspace cookies before switching
    const isLocalhost = window.location.hostname.includes('localhost');
    const cookieDomain = isLocalhost ? '' : `domain=.${APP_CONFIG.frontendDomain};`;
    
    // Clear workspace cookies
    document.cookie = `ff_workspace_id=; path=/; ${cookieDomain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `ff_workspace_subdomain=; path=/; ${cookieDomain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    
    console.log('🧹 Cleared old workspace cookies before switching');

    // Build the target URL
    const targetSubdomain = workspace.customDomain || workspace.subdomain;
    let targetUrl: string;

    if (workspace.customDomain) {
      // If custom domain exists, use it
      targetUrl = `${window.location.protocol}//${workspace.customDomain}`;
    } else {
      // Use subdomain
      if (isLocalhost) {
        targetUrl = `${window.location.protocol}//${workspace.subdomain}.localhost:3000`;
      } else {
        const baseDomain = APP_CONFIG.frontendDomain;
        targetUrl = `${window.location.protocol}//${workspace.subdomain}.${baseDomain}`;
      }
    }

    // Navigate to the workspace with a full page reload
    console.log(`🔄 Switching to workspace: ${workspace.name} (${workspace.subdomain})`);
    window.location.href = `${targetUrl}/dashboard`;
  };

  // Don't show if no workspace context
  if (!workspaceSubdomain || !currentWorkspace) {
    return null;
  }

  const iconBackColorOpen = 'grey.100';

  return (
    <Box sx={{ flexShrink: 0, ml: 0.5, mr: 2 }}>
      <ButtonBase
        sx={{
          p: 0.5,
          bgcolor: open ? iconBackColorOpen : 'transparent',
          borderRadius: 2,
          transition: 'all 0.2s ease-in-out',
          '&:hover': { bgcolor: 'secondary.lighter' },
          border: '1px solid',
          borderColor: open ? 'divider' : 'transparent'
        }}
        aria-label="open workspace navigator"
        ref={anchorRef}
        aria-controls={open ? 'workspace-navigator' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, py: 0.5 }}>
          <Avatar
            alt={currentWorkspace.name}
            src={currentWorkspace.brandingLogoUrl || undefined}
            sx={{
              width: 32,
              height: 32,
              bgcolor: currentWorkspace.brandingPrimaryHex || 'primary.main',
              color: 'white'
            }}
          >
            {currentWorkspace.brandingLogoUrl ? null : <Building3 size={20} />}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {currentWorkspace.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1,
                display: 'block'
              }}
            >
              @{currentWorkspace.subdomain}
            </Typography>
          </Box>
          <ArrowDown2
            size={16}
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out'
            }}
          />
        </Stack>
      </ButtonBase>
      <Popper
        placement="bottom-start"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 9]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position="top-left" in={open} {...TransitionProps}>
            <Paper
              sx={{
                boxShadow: (theme) => theme.customShadows.z1,
                width: 320,
                minWidth: 280,
                maxWidth: { xs: 280, md: 320 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box>
                  {/* Header */}
                  <Box sx={{ p: 2, pb: 1.5 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Switch Workspace
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Select a workspace to switch to
                    </Typography>
                  </Box>
                  <Divider />

                  {/* Workspace List */}
                  <Box
                    sx={{
                      maxHeight: 400,
                      overflowY: 'auto',
                      '&::-webkit-scrollbar': {
                        width: 6
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'divider',
                        borderRadius: 3
                      }
                    }}
                  >
                    {loading ? (
                      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : workspaces.length === 0 ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          No workspaces found
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={0}>
                        {workspaces.map((workspace) => {
                          const isCurrentWorkspace = workspace.id === workspaceId;
                          return (
                            <ButtonBase
                              key={workspace.id}
                              onClick={() => handleWorkspaceSwitch(workspace)}
                              disabled={isCurrentWorkspace}
                              sx={{
                                width: '100%',
                                p: 2,
                                justifyContent: 'flex-start',
                                bgcolor: isCurrentWorkspace ? 'action.selected' : 'transparent',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  bgcolor: isCurrentWorkspace ? 'action.selected' : 'action.hover'
                                },
                                '&:last-child': {
                                  borderBottom: 'none'
                                }
                              }}
                            >
                              <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                                <Avatar
                                  alt={workspace.name}
                                  src={workspace.brandingLogoUrl || undefined}
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    bgcolor: workspace.brandingPrimaryHex || 'primary.main',
                                    color: 'white'
                                  }}
                                >
                                  {workspace.brandingLogoUrl ? null : <Building3 size={24} />}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography
                                      variant="subtitle2"
                                      sx={{
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {workspace.name}
                                    </Typography>
                                    {isCurrentWorkspace && (
                                      <Chip
                                        label="Current"
                                        size="small"
                                        color="primary"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.625rem'
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    @{workspace.subdomain}
                                  </Typography>
                                </Box>
                              </Stack>
                            </ButtonBase>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                </Box>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}

