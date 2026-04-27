'use client';

import { useState, MouseEvent, ReactNode, SyntheticEvent } from 'react';

// material-ui
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';

// project-imports
import Avatar from 'components/@extended/Avatar';

// assets
import { ArrowDown, ArrowSwapHorizontal, ArrowUp, More } from '@wandersonalwes/iconsax-react';

// ==============================|| TAB PANEL ||============================== //

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} id={`simple-tabpanel-${index}`} aria-labelledby={`simple-tab-${index}`} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`
  };
}

// ==============================|| DATA WIDGET - TRANSACTIONS ||============================== //

export default function Transactions() {
  const [value, setValue] = useState(0);

  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const transactions = [
    {
      id: 1,
      name: 'Apple Inc.',
      code: '#ABLE-PRO-T00232',
      amount: '$210,000',
      change: '-10.6%',
      changeType: 'down',
      avatar: 'AI',
      time: '08:40 pm'
    },
    {
      id: 2,
      name: 'Spotify Music',
      code: '#ABLE-PRO-T00233',
      amount: '-10,000',
      change: '+30.6%',
      changeType: 'up',
      avatar: 'SM',
      time: '07:40 pm'
    },
    {
      id: 3,
      name: 'Medium',
      code: '#ABLE-PRO-T00234',
      amount: '-26',
      change: '5%',
      changeType: 'neutral',
      avatar: 'MD',
      time: '06:30 pm'
    },
    {
      id: 4,
      name: 'Uber',
      code: '#ABLE-PRO-T00235',
      amount: '+2,10,000',
      change: '+10.6%',
      changeType: 'up',
      avatar: 'U',
      time: '08:40 pm'
    },
    {
      id: 5,
      name: 'Ola Cabs',
      code: '#ABLE-PRO-T00236',
      amount: '+2,10,000',
      change: '+10.6%',
      changeType: 'up',
      avatar: 'OC',
      time: '07:40 pm'
    }
  ];

  const renderTransactionItem = (transaction: typeof transactions[0]) => {
    const getChangeColor = () => {
      switch (transaction.changeType) {
        case 'up':
          return 'success.main';
        case 'down':
          return 'error.main';
        case 'neutral':
          return 'warning.main';
        default:
          return 'text.secondary';
      }
    };

    const getChangeIcon = () => {
      switch (transaction.changeType) {
        case 'up':
          return <ArrowUp style={{ transform: 'rotate(45deg)' }} size={14} />;
        case 'down':
          return <ArrowDown style={{ transform: 'rotate(45deg)' }} size={14} />;
        case 'neutral':
          return <ArrowSwapHorizontal size={14} />;
        default:
          return null;
      }
    };

    return (
      <ListItem
        key={transaction.id}
        divider
        secondaryAction={
          <Stack sx={{ gap: 0.25, alignItems: 'flex-end' }}>
            <Typography variant="subtitle1">{transaction.amount}</Typography>
            <Typography sx={{ color: getChangeColor(), display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {getChangeIcon()} {transaction.change}
            </Typography>
          </Stack>
        }
      >
        <ListItemAvatar>
          <Avatar
            variant="rounded"
            type="outlined"
            color="secondary"
            sx={{ color: 'secondary.darker', borderColor: 'secondary.light', fontWeight: 600 }}
          >
            {transaction.avatar}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={<Typography variant="subtitle1">{transaction.name}</Typography>}
          secondary={
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {transaction.code}
            </Typography>
          }
        />
      </ListItem>
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5">Transactions</Typography>
            <IconButton
              color="secondary"
              id="wallet-button"
              aria-controls={open ? 'wallet-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClick}
            >
              <More size={18} />
            </IconButton>
            <Menu
              id="wallet-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              slotProps={{ list: { 'aria-labelledby': 'wallet-button', sx: { p: 1.25, minWidth: 150 } } }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <ListItemButton onClick={handleClose}>Today</ListItemButton>
              <ListItemButton onClick={handleClose}>Weekly</ListItemButton>
              <ListItemButton onClick={handleClose}>Monthly</ListItemButton>
            </Menu>
          </Stack>
        </Box>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={value} onChange={handleChange} aria-label="basic tabs example" sx={{ px: 3 }}>
              <Tab label="All Transaction" {...a11yProps(0)} />
              <Tab label="Success" {...a11yProps(1)} />
              <Tab label="Pending" {...a11yProps(2)} />
            </Tabs>
          </Box>
          <TabPanel value={value} index={0}>
            <List disablePadding sx={{ '& .MuiListItem-root': { px: 3, py: 1.5 } }}>
              {transactions.map(renderTransactionItem)}
            </List>
          </TabPanel>
          <TabPanel value={value} index={1}>
            <List disablePadding sx={{ '& .MuiListItem-root': { px: 3, py: 1.5 } }}>
              {transactions.filter(t => t.changeType === 'up').map(renderTransactionItem)}
            </List>
          </TabPanel>
          <TabPanel value={value} index={2}>
            <List disablePadding sx={{ '& .MuiListItem-root': { px: 3, py: 1.5 } }}>
              {transactions.filter(t => t.changeType === 'down' || t.changeType === 'neutral').map(renderTransactionItem)}
            </List>
          </TabPanel>

          <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', p: 3 }}>
            <Button variant="outlined" fullWidth color="secondary">
              Transaction History
            </Button>
            <Button variant="contained" fullWidth>
              Create new Transaction
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
