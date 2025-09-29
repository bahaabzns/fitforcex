// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';

const fonts = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Open Sans', label: 'Open Sans' }
];

// ==============================|| CUSTOMIZATION - THEME FONT ||============================== //

export default function ThemeFont() {
  const { fontFamily, onChangeFontFamily } = useConfig();

  return (
    <RadioGroup row aria-label="theme-font" name="theme-font" value={fontFamily} onChange={(e) => onChangeFontFamily(e.target.value)}>
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
        {fonts.map((font) => (
          <FormControlLabel
            key={font.value}
            value={font.value}
            control={<Radio />}
            label={font.label}
            sx={{ flex: 1, minWidth: 'fit-content' }}
          />
        ))}
      </Stack>
    </RadioGroup>
  );
}




