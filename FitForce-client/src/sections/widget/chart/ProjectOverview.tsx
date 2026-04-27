'use client';

import { useTheme } from '@mui/material/styles';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// ==============================|| CHART - PROJECT OVERVIEW ||============================== //

export default function ProjectOverview() {
  const theme = useTheme();

  const data = [
    { name: 'Completed', value: 35, color: theme.palette.success.main },
    { name: 'In Progress', value: 25, color: theme.palette.warning.main },
    { name: 'Pending', value: 20, color: theme.palette.info.main },
    { name: 'Cancelled', value: 20, color: theme.palette.error.main }
  ];

  const COLORS = data.map(item => item.color);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Project Overview
        </Typography>
        <Box sx={{ height: 300, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'center' }}>
          {data.map((item, index) => (
            <Stack key={item.name} direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: item.color,
                  borderRadius: '50%'
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {item.name}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
