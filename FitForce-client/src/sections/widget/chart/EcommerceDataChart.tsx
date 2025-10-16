'use client';

import { useTheme } from '@mui/material/styles';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ==============================|| CHART - ECOMMERCE DATA CHART ||============================== //

interface EcommerceDataChartProps {
  color?: string;
  data?: Array<{ name: string; value: number }>;
}

export default function EcommerceDataChart({ color = '#1976d2', data }: EcommerceDataChartProps) {
  const theme = useTheme();

  // Default data if none provided
  const defaultData = [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 120 },
    { name: 'Mar', value: 90 },
    { name: 'Apr', value: 150 },
    { name: 'May', value: 180 },
    { name: 'Jun', value: 200 }
  ];

  const chartData = data || defaultData;

  return (
    <Box sx={{ height: 60, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          />
          <YAxis hide />
          <Tooltip 
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              boxShadow: theme.shadows[8]
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: color, strokeWidth: 2, fill: theme.palette.background.paper }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
