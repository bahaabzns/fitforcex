// material-ui
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';

// ==============================|| CUSTOMIZATION - MENU CAPTION ||============================== //

export default function MenuCaption() {
  const { menuCaption, onChangeMenuCaption } = useConfig();

  return (
    <RadioGroup
      row
      aria-label="menu-caption"
      name="menu-caption"
      value={menuCaption ? 'caption' : 'nocaption'}
      onChange={(e) => onChangeMenuCaption(e.target.value)}
    >
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%' }}>
        <FormControlLabel value="caption" control={<Radio />} label="Show Caption" sx={{ flex: 1 }} />
        <FormControlLabel value="nocaption" control={<Radio />} label="Hide Caption" sx={{ flex: 1 }} />
      </Stack>
    </RadioGroup>
  );
}

