// material-ui
import CardMedia from '@mui/material/CardMedia';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import MainCard from 'components/MainCard';
import useConfig from 'hooks/useConfig';
import { MenuOrientation } from 'config';

const verticalLayout = '/assets/images/customization/vertical.svg';
const horizontalLayout = '/assets/images/customization/horizontal.svg';

const layouts = [
  { value: MenuOrientation.VERTICAL, label: 'Vertical', img: verticalLayout },
  { value: MenuOrientation.HORIZONTAL, label: 'Horizontal', img: horizontalLayout }
];

// ==============================|| CUSTOMIZATION - THEME LAYOUT ||============================== //

export default function ThemeLayout() {
  const { menuOrientation, onChangeMenuOrientation } = useConfig();

  const activeCardStyle = {
    borderColor: 'primary.main',
    '&:hover': { borderColor: 'primary.darker' }
  };

  const renderLayoutCard = ({ value: layoutValue, label, img }: any) => (
    <FormControlLabel
      key={layoutValue}
      value={layoutValue}
      sx={{ width: 1, m: 0, display: 'flex' }}
      control={<Radio sx={{ display: 'none' }} />}
      label={
        <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
          <MainCard content={false} sx={{ borderWidth: 2, p: 1, ...(menuOrientation === layoutValue && { ...activeCardStyle }) }}>
            <CardMedia component="img" src={img} alt={label} />
          </MainCard>
          <Typography variant="caption">{label}</Typography>
        </Stack>
      }
    />
  );

  return (
    <RadioGroup
      row
      aria-label="theme-layout"
      name="theme-layout"
      value={menuOrientation}
      onChange={(e) => onChangeMenuOrientation(e.target.value as MenuOrientation)}
    >
      <Stack direction="row" sx={{ gap: 2.5, alignItems: 'center', width: '100%' }}>
        {layouts.map((layout) => renderLayoutCard(layout))}
      </Stack>
    </RadioGroup>
  );
}

