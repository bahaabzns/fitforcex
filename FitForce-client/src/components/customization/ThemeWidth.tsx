// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';

// ==============================|| CUSTOMIZATION - THEME WIDTH ||============================== //

export default function ThemeWidth() {
  const { container, onChangeContainer } = useConfig();

  return (
    <RadioGroup
      row
      aria-label="theme-width"
      name="theme-width"
      value={container ? 'container' : 'fluid'}
      onChange={(e) => onChangeContainer(e.target.value)}
    >
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%' }}>
        <FormControlLabel value="container" control={<Radio />} label="Container" sx={{ flex: 1 }} />
        <FormControlLabel value="fluid" control={<Radio />} label="Fluid" sx={{ flex: 1 }} />
      </Stack>
    </RadioGroup>
  );
}

