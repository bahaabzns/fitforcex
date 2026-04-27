// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';

// ==============================|| CUSTOMIZATION - THEME CONTRAST ||============================== //

export default function ThemeContrast() {
  const { themeContrast, onChangeContrast } = useConfig();

  return (
    <RadioGroup
      row
      aria-label="theme-contrast"
      name="theme-contrast"
      value={themeContrast ? 'contrast' : 'default'}
      onChange={(e) => onChangeContrast(e.target.value)}
    >
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%' }}>
        <FormControlLabel value="default" control={<Radio />} label="Default" sx={{ flex: 1 }} />
        <FormControlLabel value="contrast" control={<Radio />} label="High Contrast" sx={{ flex: 1 }} />
      </Stack>
    </RadioGroup>
  );
}

