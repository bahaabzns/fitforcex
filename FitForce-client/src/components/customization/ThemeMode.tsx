// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';
import { ThemeMode } from 'config';

// ==============================|| CUSTOMIZATION - THEME MODE ||============================== //

export default function ThemeModeComponent() {
  const { mode, onChangeMode } = useConfig();

  return (
    <RadioGroup row aria-label="theme-mode" name="theme-mode" value={mode} onChange={(e) => onChangeMode(e.target.value as ThemeMode)}>
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%' }}>
        <FormControlLabel value={ThemeMode.LIGHT} control={<Radio />} label="Light" sx={{ flex: 1 }} />
        <FormControlLabel value={ThemeMode.DARK} control={<Radio />} label="Dark" sx={{ flex: 1 }} />
        <FormControlLabel value={ThemeMode.AUTO} control={<Radio />} label="Auto" sx={{ flex: 1 }} />
      </Stack>
    </RadioGroup>
  );
}

