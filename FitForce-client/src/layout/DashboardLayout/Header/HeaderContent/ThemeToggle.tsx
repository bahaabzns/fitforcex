"use client";
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from 'components/@extended/IconButton';
import useConfig from 'hooks/useConfig';
import { ThemeMode } from 'config';
import { Sun1, Moon } from '@wandersonalwes/iconsax-react';

export default function ThemeToggle() {
  const { mode, onChangeMode } = useConfig();
  const isDark = mode === ThemeMode.DARK;

  const handleToggle = () => {
    onChangeMode(isDark ? ThemeMode.LIGHT : ThemeMode.DARK);
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 0.5 }}>
      <Tooltip title={isDark ? 'Switch to Light' : 'Switch to Dark'}>
        <IconButton
          color="secondary"
          variant="light"
          aria-label="toggle theme"
          onClick={handleToggle}
          size="large"
          sx={(theme) => ({
            p: 1,
            color: 'secondary.main',
            bgcolor: 'secondary.100',
            ...theme.applyStyles('dark', { bgcolor: 'background.default' })
          })}
        >
          {isDark ? <Sun1 size={24} /> : <Moon size={24} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}


