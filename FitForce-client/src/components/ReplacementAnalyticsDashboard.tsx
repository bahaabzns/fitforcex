'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
} from '@mui/material';
import {
  getReplacementAnalytics,
  type ReplacementAnalytics,
} from '@/api/food-replacements';
import { openSnackbar } from '@/api/snackbar';
import { ArrowUp2, ArrowDown2, Refresh } from '@wandersonalwes/iconsax-react';

export default function ReplacementAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<ReplacementAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadAnalytics();
  }, [startDate, endDate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await getReplacementAnalytics({
        startDate,
        endDate,
      });
      setAnalytics(data);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to load analytics',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      coach_defined: 'primary',
      smart_suggestion: 'success',
      client_request: 'warning',
      category_based: 'info',
      bulk_replacement: 'secondary',
      template: 'default',
    };
    return colors[type] || 'default';
  };

  const formatType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6">Replacement Analytics</Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : !analytics ? (
        <Alert severity="info">No analytics data available</Alert>
      ) : (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ color: 'white' }}>
                      <Refresh size={24} />
                    </Box>
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{analytics.summary.totalReplacements}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Replacements
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader title="Replacement Type Distribution" />
              <CardContent>
                <Stack spacing={2}>
                  {analytics.summary.typeDistribution.map((dist) => (
                    <Box key={dist.type}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{formatType(dist.type)}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {dist.count}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          bgcolor: 'background.default',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            width: `${(dist.count / analytics.summary.totalReplacements) * 100}%`,
                            bgcolor: `${getTypeColor(dist.type)}.main`,
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Most Replaced Foods */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Most Replaced Foods"
                subheader="Top foods that are frequently replaced"
              />
              <CardContent>
                {analytics.mostReplacedFoods.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data available
                  </Typography>
                ) : (
                  <List>
                    {analytics.mostReplacedFoods.map((item, index) => (
                      <ListItem key={item.food?.id || index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'error.main' }}>
                            <Typography variant="caption">{index + 1}</Typography>
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={item.food?.name || 'Unknown Food'}
                          secondary={`Replaced ${item.replacementCount} time${item.replacementCount !== 1 ? 's' : ''}`}
                        />
                        <Chip
                          label={item.replacementCount}
                          color="error"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Popular Replacements */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Popular Replacements"
                subheader="Most commonly used replacement foods"
              />
              <CardContent>
                {analytics.popularReplacements.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data available
                  </Typography>
                ) : (
                  <List>
                    {analytics.popularReplacements.map((item, index) => (
                      <ListItem key={item.food?.id || index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'success.main' }}>
                            <Typography variant="caption">{index + 1}</Typography>
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={item.food?.name || 'Unknown Food'}
                          secondary={`Used ${item.usageCount} time${item.usageCount !== 1 ? 's' : ''}`}
                        />
                        <Chip
                          label={item.usageCount}
                          color="success"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Replacement Patterns */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Replacement Patterns"
                subheader="Most common original → replacement pairs"
              />
              <CardContent>
                {analytics.replacementPatterns.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data available
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {analytics.replacementPatterns.map((pattern, index) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Stack spacing={1}>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Original
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {pattern.original?.name || 'Unknown'}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ color: 'error.main' }}>
                                <ArrowDown2 size={16} />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {pattern.frequency} time{pattern.frequency !== 1 ? 's' : ''}
                              </Typography>
                              <Box sx={{ color: 'success.main' }}>
                                <ArrowUp2 size={16} />
                              </Box>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Replacement
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {pattern.replacement?.name || 'Unknown'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

