'use client';

import { useTheme } from '@mui/material/styles';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Box from '@mui/material/Box';

// ==============================|| CHART - REPEAT CUSTOMER CHART ||============================== //

export default function RepeatCustomerChart() {
  const theme = useTheme();

  const data = [
    { name: 'Jan', value: 2.5 },
    { name: 'Feb', value: 3.2 },
    { name: 'Mar', value: 2.8 },
    { name: 'Apr', value: 4.1 },
    { name: 'May', value: 3.9 },
    { name: 'Jun', value: 5.4 }
  ];

  return (
    <Box sx={{ height: 200, width: '100%', mt: 2 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              boxShadow: theme.shadows[8]
            }}
            formatter={(value: number) => [`${value}%`, 'Rate']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={theme.palette.primary.main}
            fill={`${theme.palette.primary.main}20`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
