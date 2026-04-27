// material-ui
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import useConfig from 'hooks/useConfig';
import { PresetColor } from 'types/config';

const colors = [
  { value: 'default', label: 'Default', color: '#4680FF' },
  { value: 'theme1', label: 'Theme 1', color: '#3366FF' },
  { value: 'theme2', label: 'Theme 2', color: '#7265E6' },
  { value: 'theme3', label: 'Theme 3', color: '#068e44' },
  { value: 'theme4', label: 'Theme 4', color: '#3c64d0' },
  { value: 'theme5', label: 'Theme 5', color: '#f27013' },
  { value: 'theme6', label: 'Theme 6', color: '#2aa1af' },
  { value: 'theme7', label: 'Theme 7', color: '#00a854' },
  { value: 'theme8', label: 'Theme 8', color: '#009688' }
];

// ==============================|| CUSTOMIZATION - COLOR SCHEME ||============================== //

export default function ColorScheme() {
  const { presetColor, onChangePresetColor } = useConfig();

  const activeCardStyle = {
    borderColor: 'primary.main',
    '&:hover': { borderColor: 'primary.darker' }
  };

  const renderColorCard = ({ value: colorValue, label, color }: any) => (
    <FormControlLabel
      key={colorValue}
      value={colorValue}
      sx={{ width: 1, m: 0, display: 'flex' }}
      control={<Radio sx={{ display: 'none' }} />}
      label={
        <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
          <MainCard content={false} sx={{ borderWidth: 2, p: 1, ...(presetColor === colorValue && { ...activeCardStyle }) }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                backgroundColor: color,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </MainCard>
          <Typography variant="caption">{label}</Typography>
        </Stack>
      }
    />
  );

  return (
    <RadioGroup
      row
      aria-label="theme-color"
      name="theme-color"
      value={presetColor}
      onChange={(e) => onChangePresetColor(e.target.value as PresetColor)}
    >
      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
        {colors.map((color) => renderColorCard(color))}
      </Stack>
    </RadioGroup>
  );
}
