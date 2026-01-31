import { useRef, useState } from 'react';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';
import MainCard from 'components/MainCard';

import useConfig from 'hooks/useConfig';

// types
import { I18n } from 'types/config';

// ==============================|| HEADER CONTENT - LOCALIZATION ||============================== //

export default function Localization() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const { i18n, onChangeLocalization } = useConfig();

  const anchorRef = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: MouseEvent | TouchEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleListItemClick = (lang: I18n) => {
    onChangeLocalization(lang);
    setOpen(false);
  };

  const currentLang = (i18n || 'en').toUpperCase();

  return (
    <Box sx={{ flexShrink: 0, ml: 0.5 }}>
      <IconButton
        color="secondary"
        variant="light"
        aria-label={`open localization (${currentLang})`}
        ref={anchorRef}
        aria-controls={open ? 'localization-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
        size="large"
        sx={(theme) => ({
          px: 1.5,
          py: 0.75,
          color: 'secondary.main',
          bgcolor: open ? 'secondary.200' : 'secondary.100',
          fontWeight: 700,
          fontSize: '0.875rem',
          minWidth: 48,
          ...theme.applyStyles('dark', { bgcolor: open ? 'background.paper' : 'background.default' })
        })}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: 0.5 }}>
          {currentLang}
        </Typography>
      </IconButton>
      <Popper
        placement={downMD ? 'bottom-start' : 'bottom'}
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
                offset: [downMD ? 0 : 0, 9]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position={downMD ? 'top-right' : 'top'} in={open} {...TransitionProps}>
            <Paper sx={(theme) => ({ boxShadow: theme.customShadows.z1, borderRadius: 1.5 })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard border={false} content={false}>
                  <List
                    component="nav"
                    sx={(theme) => ({
                      p: 1,
                      width: '100%',
                      minWidth: 200,
                      maxWidth: 290,
                      bgcolor: theme.palette.background.paper,
                      [theme.breakpoints.down('md')]: { maxWidth: 250 }
                    })}
                  >
                    <ListItemButton selected={i18n === 'en'} onClick={() => handleListItemClick('en')}>
                      <ListItemText
                        primary={
                          <Grid container>
                            <Typography sx={{ color: 'text.primary' }}>English</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: '8px' }}>
                              (UK)
                            </Typography>
                          </Grid>
                        }
                      />
                    </ListItemButton>
                    
                    <ListItemButton selected={i18n === 'ar'} onClick={() => handleListItemClick('ar')}>
                      <ListItemText
                        primary={
                          <Grid container>
                            <Typography sx={{ color: 'text.primary' }}>العربية</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: '8px' }}>
                              (Arabic)
                            </Typography>
                          </Grid>
                        }
                      />
                    </ListItemButton>
                  </List>
                </MainCard>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}
