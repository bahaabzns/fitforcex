'use client';

import { useEffect, useMemo, useState } from 'react';
import { Container, Box, CircularProgress, Stack, Typography, Tabs, Tab, Card, CardContent, FormControl, InputLabel, Select, MenuItem, Tooltip, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Avatar } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import RequestPageIcon from '@mui/icons-material/RequestPage';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAppSelector } from '@/store';
import OnboardingWizard from '@/components/OnboardingWizard';
import api from '@/utils/axios';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, Brush, BarChart, Bar } from 'recharts';

export default function DashboardOverviewBlank() {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean>(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [payments, setPayments] = useState<Array<{ amountCents: number; currency: string; createdAt: string; subscriptionId?: string; subscription?: any; packageId?: string | null; packageName?: string | null }>>([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'EGP' | 'USD' | 'EUR'>('ALL');
  const [duration, setDuration] = useState<'30d' | '90d' | '12m' | 'all'>('all');
  const [packagesList, setPackagesList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<'all' | string>('all');
  const [egpRevenueAll, setEgpRevenueAll] = useState<number>(0);
  const [avgRevenuePerSub, setAvgRevenuePerSub] = useState<number>(0);
  const [totalSubscriptions, setTotalSubscriptions] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [clientStatusCounts, setClientStatusCounts] = useState<Record<string, number> | null>(null);
  const [subscriptionKinds, setSubscriptionKinds] = useState<{ firstPlan: number; renewal: number; total: number } | null>(null);
  const [growthData, setGrowthData] = useState<{ newClients: number; returningClients: number; expiredClients: number; total: number } | null>(null);
  const [retentionSeries, setRetentionSeries] = useState<Array<{ date: string; retentionPct: number; cancellationPct: number }>>([]);
  const [formsData, setFormsData] = useState<any>(null);
  const [loadingForms, setLoadingForms] = useState(false);
  const [teamCapacity, setTeamCapacity] = useState<any>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [capacityData, setCapacityData] = useState<any>(null);
  const workflowTotals = useMemo(() => {
    const get = (k: string) => Number(formsData?.[k]?.total || 0);
    const scheduled = get('scheduled');
    const requested = get('requested');
    const submitted = get('submitted');
    const completed = get('completed');
    const total = scheduled + requested + submitted + completed;
    const pct = (v: number) => (total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0);
    return {
      scheduled, requested, submitted, completed, total,
      pctScheduled: pct(scheduled), pctRequested: pct(requested), pctSubmitted: pct(submitted), pctCompleted: pct(completed)
    };
  }, [formsData]);
  const demandSeries = useMemo(() => {
    if (!formsData) return [] as Array<{ date: string; requested: number; submitted: number; convPct: number; total: number }>;
    const req = Array.isArray(formsData?.requested?.overTime) ? formsData.requested.overTime : [];
    const sub = Array.isArray(formsData?.submitted?.overTime) ? formsData.submitted.overTime : [];
    const map: Record<string, { requested: number; submitted: number }> = {};
    const sumRow = (row: any, key: 'requested' | 'submitted') => {
      const { date, ...rest } = row || {};
      if (!date) return;
      const total = Object.entries(rest).reduce((acc, [k, v]) => k === 'date' ? acc : acc + (Number(v) || 0), 0);
      if (!map[date]) map[date] = { requested: 0, submitted: 0 };
      map[date][key] += total;
    };
    req.forEach((r: any) => sumRow(r, 'requested'));
    sub.forEach((r: any) => sumRow(r, 'submitted'));
    return Object.keys(map).sort().map((d) => {
      const requested = map[d].requested;
      const submitted = map[d].submitted;
      const denom = requested + submitted;
      const convPct = denom > 0 ? (submitted / denom) * 100 : 0;
      return { date: d, requested, submitted, convPct: Number(convPct.toFixed(1)), total: requested + submitted };
    });
  }, [formsData]);

  const DemandTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const find = (k: string) => payload.find((p: any) => p.dataKey === k)?.value ?? 0;
      const requested = Number(find('requested') || 0);
      const submitted = Number(find('submitted') || 0);
      const conv = Number(find('convPct') || 0);
      return (
        <Card variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1976d2' }} />
                <Typography variant="body2">Requested</Typography>
              </Stack>
              <Typography variant="body2">{requested.toLocaleString()}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#7b1fa2' }} />
                <Typography variant="body2">In Progress</Typography>
              </Stack>
              <Typography variant="body2">{submitted.toLocaleString()}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Conversion</Typography>
              <Typography variant="body2">{conv}%</Typography>
            </Stack>
          </Stack>
        </Card>
      );
    }
    return null;
  };

  const demandByType = useMemo(() => {
    if (!formsData || !Array.isArray(formsData?.templatePerformance)) {
      return { workout: 0, nutrition: 0, total: 0, workoutPct: 0, nutritionPct: 0 };
    }
    const acc = { workout: 0, nutrition: 0 } as Record<'workout' | 'nutrition', number>;
    for (const t of formsData.templatePerformance) {
      const type = String(t?.type || '').toLowerCase();
      if (type === 'workout' || type === 'nutrition') {
        const demand = Number(t?.requested || 0) + Number(t?.submitted || 0);
        acc[type] += demand;
      }
    }
    const total = acc.workout + acc.nutrition;
    const workoutPct = total > 0 ? Number(((acc.workout / total) * 100).toFixed(1)) : 0;
    const nutritionPct = total > 0 ? Number(((acc.nutrition / total) * 100).toFixed(1)) : 0;
    return { workout: acc.workout, nutrition: acc.nutrition, total, workoutPct, nutritionPct };
  }, [formsData]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        setOnboardingLoading(true);
        const response = await api.get('/api/workspaces/onboarding/status');
        setOnboarded(!!response.data?.isOnboarded);
      } catch {
        setOnboarded(true);
      } finally {
        setOnboardingLoading(false);
      }
    };
    if (workspaceId) checkOnboarding();
  }, [workspaceId]);

  useEffect(() => {
    const loadPayments = async () => {
      if (!workspaceId) return;
      try {
        setLoadingFinance(true);
        const res = await api.get('/api/finance/payments', { headers: { 'x-workspace-id': workspaceId } });
        const list = Array.isArray(res.data?.payments) ? res.data.payments : [];
        setPayments(list.map((p: any) => ({
          amountCents: Number(p?.amountCents || 0),
          currency: String(p?.currency || 'USD').toUpperCase(),
          createdAt: String(p?.createdAt || new Date().toISOString()),
          subscriptionId: p?.subscriptionId || p?.subscription?.id,
          subscription: p?.subscription || null,
          packageId: p?.packageId ?? p?.subscription?.packageId ?? null,
          packageName: p?.packageName ?? p?.subscription?.package?.name ?? null,
        })));
      } catch {
        setPayments([]);
      } finally {
        setLoadingFinance(false);
      }
    };
    if (tabIndex === 0) loadPayments();
  }, [workspaceId, tabIndex]);

  // Load Client Insights data (status counts + subscription kinds)
  useEffect(() => {
    const loadInsights = async () => {
      if (!workspaceId) return;
      try {
        setLoadingInsights(true);
        const res = await api.get('/api/workspaces/dashboard', { headers: { 'x-workspace-id': workspaceId } });
        const counts = res.data?.clientsOverview || null;
        const subsKinds = res.data?.financeData?.subscriptions || null;
        const growth = res.data?.growthData || null;
        const overTime = Array.isArray(res.data?.retentionCancellationOverTime) ? res.data.retentionCancellationOverTime : [];
        setClientStatusCounts(counts);
        setSubscriptionKinds(subsKinds);
        setGrowthData(growth);
        setRetentionSeries(overTime);
      } catch {
        setClientStatusCounts(null);
        setSubscriptionKinds(null);
        setGrowthData(null);
        setRetentionSeries([]);
      } finally {
        setLoadingInsights(false);
      }
    };
    if (tabIndex === 1) loadInsights();
  }, [workspaceId, tabIndex]);

  // Load Forms submissions analytics for "Form submissions" tab
  useEffect(() => {
    const loadForms = async () => {
      if (!workspaceId) return;
      try {
        setLoadingForms(true);
        const res = await api.get('/api/workspaces/dashboard', { headers: { 'x-workspace-id': workspaceId } });
        setFormsData(res.data?.formsData || null);
      } catch {
        setFormsData(null);
      } finally {
        setLoadingForms(false);
      }
    };
    if (tabIndex === 2) loadForms();
  }, [workspaceId, tabIndex]);

  // Load Team productivity analytics (previously under capacity)
  useEffect(() => {
    const loadTeam = async () => {
      if (!workspaceId) return;
      try {
        setLoadingTeam(true);
        const res = await api.get('/api/workspaces/dashboard', { headers: { 'x-workspace-id': workspaceId } });
        setTeamCapacity(res.data?.teamCapacity || null);
        setCapacityData(res.data?.capacityData || null);
      } catch {
        setTeamCapacity(null);
        setCapacityData(null);
      } finally {
        setLoadingTeam(false);
      }
    };
    if (tabIndex === 4) loadTeam();
  }, [workspaceId, tabIndex]);

  useEffect(() => {
    const loadPackages = async () => {
      if (!workspaceId) return;
      try {
        const p = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
        const list = (p.data?.packages || []).map((x: any) => ({ id: x.id, name: x.name }));
        setPackagesList(list);
      } catch {
        setPackagesList([]);
      }
    };
    if (tabIndex === 0) loadPackages();
  }, [workspaceId, tabIndex]);

  const { series, totals, currencyKeys } = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (duration === '30d') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (duration === '90d') cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (duration === '12m') cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const filtered = payments.filter((p) => {
      const d = new Date(p.createdAt);
      if (isNaN(d.getTime())) return false;
      if (cutoff && d < cutoff) return false;
      return true;
    });

    // Group by date (YYYY-MM-DD)
    const byDate: Record<string, Record<string, number>> = {};
    const totalsAcc = { EGP: 0, USD: 0, EUR: 0 } as Record<'EGP' | 'USD' | 'EUR', number>;
    const keysSet = new Set<string>();
    for (const p of filtered) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const curr = (p.currency || 'USD').toUpperCase();
      const amount = (p.amountCents || 0) / 100;
      if (!byDate[key]) byDate[key] = {};
      byDate[key][curr] = (byDate[key][curr] || 0) + amount;
      if ((['EGP','USD','EUR'] as string[]).includes(curr)) {
        totalsAcc[curr as 'EGP' | 'USD' | 'EUR'] += amount;
      }
      keysSet.add(curr);
    }

    // Build series sorted by date
    const dates = Object.keys(byDate).sort();
    const rows = dates.map((date) => ({ date, ...byDate[date] }));
    return { series: rows, totals: totalsAcc, currencyKeys: Array.from(keysSet).sort() };
  }, [payments, duration]);

  // Helpers for Subscription & Revenue Analysis
  const filteredByDuration = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (duration === '30d') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (duration === '90d') cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (duration === '12m') cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return payments.filter((p) => {
      const d = new Date(p.createdAt);
      if (isNaN(d.getTime())) return false;
      if (cutoff && d < cutoff) return false;
      return true;
    });
  }, [payments, duration]);

  const packageIdToName = (pkgId: string | undefined | null) => {
    if (!pkgId) return 'Other';
    const f = packagesList.find((p) => p.id === pkgId);
    return f?.name || pkgId;
  };

  const packageSeriesData = useMemo(() => {
    const items = filteredByDuration.filter((p) => {
      const pkgId = p.subscription?.packageId || p.subscription?.package?.id;
      return selectedPackageId === 'all' ? true : pkgId === selectedPackageId;
    });

    const totalsByPackage: Record<string, number> = {};
    const byDate: Record<string, Record<string, number>> = {};
    for (const p of items) {
      const d = new Date(p.createdAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const pkgId = (p.packageId as string) || p.subscription?.packageId || p.subscription?.package?.id || 'other';
      const pkgName = (p.packageName as string) || (p.subscription?.package?.name as string) || packageIdToName(pkgId);
      const amount = (p.amountCents || 0) / 100;
      if (!byDate[dateKey]) byDate[dateKey] = {};
      if (!byDate[dateKey][pkgName]) byDate[dateKey][pkgName] = 0;
      byDate[dateKey][pkgName] += amount;
      totalsByPackage[pkgName] = (totalsByPackage[pkgName] || 0) + amount;
    }
    let sortedPackages = Object.keys(totalsByPackage).sort((a, b) => totalsByPackage[b] - totalsByPackage[a]);
    if (sortedPackages.length === 0) {
      // derive from any keys present in byDate rows
      const keysSet = new Set<string>();
      Object.values(byDate).forEach((row) => Object.keys(row).forEach((k) => keysSet.add(k)));
      sortedPackages = Array.from(keysSet);
    }
    const topKeys = selectedPackageId === 'all' ? sortedPackages.slice(0, 3) : sortedPackages.slice(0, 1);
    const dates = Object.keys(byDate).sort();
    const rows = dates.map((date) => ({ date, ...byDate[date] }));
    const topTotals = topKeys.map((k) => ({ key: k, total: totalsByPackage[k] || 0 }));
    return { rows, topKeys, topTotals };
  }, [filteredByDuration, selectedPackageId, packagesList]);

  useEffect(() => {
    const computeKpis = async () => {
      try {
        // Sum converted to EGP
        const sumByCurrency: Record<string, number> = {};
        const subs = new Set<string>();
        for (const p of filteredByDuration) {
          const curr = (p.currency || 'USD').toUpperCase();
          sumByCurrency[curr] = (sumByCurrency[curr] || 0) + (p.amountCents || 0) / 100;
          if (p.subscriptionId) subs.add(String(p.subscriptionId));
        }
        const uniqueSubs = subs.size;

        const getRate = async (from: string): Promise<number> => {
          if (from === 'EGP') return 1;
          try {
            const r = await api.get(`/api/finance/convert`, { params: { from, to: 'EGP', amount: 1 } });
            const converted = Number(r.data?.amount || r.data?.converted || 0);
            return converted > 0 ? converted : 1;
          } catch {
            return 1; // graceful fallback if no API available
          }
        };

        const currencies = Object.keys(sumByCurrency);
        let totalEgp = 0;
        for (const c of currencies) {
          const rate = await getRate(c);
          totalEgp += sumByCurrency[c] * rate;
        }

        setEgpRevenueAll(totalEgp);
        setTotalSubscriptions(uniqueSubs);
        setAvgRevenuePerSub(uniqueSubs > 0 ? totalEgp / uniqueSubs : 0);
      } finally {
      }
    };
    if (tabIndex === 0) computeKpis();
  }, [filteredByDuration, tabIndex]);

  if (onboardingLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Checking onboarding status...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!onboarded) {
    return <OnboardingWizard workspaceId={workspaceId || ''} />;
  }

  const tabs = [
    'Finance',
    'Client Insights',
    'Form submissions',
    'Team Capacity',
    'Team Productivity',
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Box>

        {tabIndex === 0 ? (
          <Stack spacing={3}>
            {/* Section 1: Finance */}
            <Card>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'stretch' }}>
                  <Box sx={{ flex: 3 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography variant="h6">Finance</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="currency-filter-label">Currency</InputLabel>
                          <Select labelId="currency-filter-label" label="Currency" value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value as any)}>
                            <MenuItem value="ALL">All</MenuItem>
                            <MenuItem value="EGP">EGP</MenuItem>
                            <MenuItem value="USD">USD</MenuItem>
                            <MenuItem value="EUR">EUR</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="duration-filter-label">Duration</InputLabel>
                          <Select labelId="duration-filter-label" label="Duration" value={duration} onChange={(e) => setDuration(e.target.value as any)}>
                            <MenuItem value="30d">Last 30 days</MenuItem>
                            <MenuItem value="90d">Last 90 days</MenuItem>
                            <MenuItem value="12m">Last 12 months</MenuItem>
                            <MenuItem value="all">All time</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </Stack>

                    <Box sx={{ height: { xs: 300, md: 340 } }}>
                      {loadingFinance ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <CircularProgress />
                        </Box>
                      ) : series.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Typography color="text.secondary">No revenue data in selected range</Typography>
                        </Box>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {((currencyFilter === 'ALL') ? currencyKeys : [currencyFilter]).map((key, idx) => (
                              <Line key={key} type="monotone" dataKey={key} stroke={["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#0088FE", "#00C49F"][idx % 6]} strokeWidth={2} dot={false} name={key} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, height: { xs: 'auto', md: 340 }, display: 'flex' }}>
                    <Stack spacing={2} sx={{ flex: 1, height: '100%' }}>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Total Revenue (EGP)</Typography>
                          <Typography variant="h5">{totals.EGP.toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Total Revenue (USD)</Typography>
                          <Typography variant="h5">{totals.USD.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Total Revenue (EUR)</Typography>
                          <Typography variant="h5">{totals.EUR.toLocaleString(undefined, { maximumFractionDigits: 2 })} EUR</Typography>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Section 2: Subscription & Revenue Analysis */}
            <Card>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'stretch' }}>
                  {/* Left: 3/4 width chart and top 3 packages */}
                  <Box sx={{ flex: 3 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
                      <Typography variant="h6">Subscription & Revenue Analysis</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                          <InputLabel id="package-filter-label">Package</InputLabel>
                          <Select labelId="package-filter-label" label="Package" value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value as any)}>
                            <MenuItem value="all">All Packages</MenuItem>
                            {packagesList.map((p) => (
                              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel id="duration-2-label">Duration</InputLabel>
                          <Select labelId="duration-2-label" label="Duration" value={duration} onChange={(e) => setDuration(e.target.value as any)}>
                            <MenuItem value="30d">Last 30 days</MenuItem>
                            <MenuItem value="90d">Last 90 days</MenuItem>
                            <MenuItem value="12m">Last 12 months</MenuItem>
                            <MenuItem value="all">All time</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </Stack>

                    {/* Top 3 package totals */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                      {packageSeriesData.topTotals.map((t) => (
                        <Card key={t.key} variant="outlined" sx={{ flex: 1 }}>
                          <CardContent>
                            <Typography variant="subtitle2" color="text.secondary">{t.key}</Typography>
                            <Typography variant="h6">{t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Typography>
                          </CardContent>
                        </Card>
                      ))}
                      {packageSeriesData.topTotals.length === 0 && (
                        <Typography color="text.secondary">No package revenue data</Typography>
                      )}
                    </Stack>

                    <Box sx={{ height: { xs: 300, md: 340 } }}>
                      {loadingFinance ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <CircularProgress />
                        </Box>
                      ) : packageSeriesData.rows.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Typography color="text.secondary">No package revenue data in selected range</Typography>
                        </Box>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={packageSeriesData.rows}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            {packageSeriesData.topKeys.map((key, idx) => (
                              <Line key={key} type="monotone" dataKey={key} stroke={["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0"][idx % 4]} strokeWidth={2} dot={false} name={key} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </Box>
                  </Box>

                  {/* Right: 1/4 KPI column */}
                  <Box sx={{ flex: 1, height: { xs: 'auto', md: 340 }, display: 'flex' }}>
                    <Stack spacing={2} sx={{ flex: 1, height: '100%' }}>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Avg. Revenue per Subscription (EGP)</Typography>
                          <Typography variant="h5">{(avgRevenuePerSub || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Total Subscriptions</Typography>
                          <Typography variant="h5">{totalSubscriptions}</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography variant="subtitle2" color="text.secondary">Revenue by All Packages (EGP)</Typography>
                          <Typography variant="h5">{(egpRevenueAll || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Typography>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : tabIndex === 1 ? (
          // Client Insights
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Client insights</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'stretch' }} sx={{ minHeight: { md: 620 } }}>
                  {/* Left column 1/3 */}
                  <Box sx={{ flex: 1, display: 'flex' }}>
                    <Stack spacing={2} sx={{ flex: 1 }}>
                      {/* Top: 3/5 height - Clients by status with donut */}
                      <Card variant="outlined" sx={{ flex: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>Number of clients by status</Typography>
                          {/* Pizza (full pie) chart with extra height */}
                          <Box sx={{ width: '100%', height: { xs: 380, md: 520 }, mb: 2 }}>
                            {loadingInsights ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <CircularProgress />
                              </Box>
                            ) : !clientStatusCounts ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Typography color="text.secondary">No client status data</Typography>
                              </Box>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={Object.entries(clientStatusCounts).filter(([k]) => k !== 'all').map(([key, value]) => ({ key, name: key.replace(/_/g, ' '), value }))}
                                    outerRadius={140}
                                    paddingAngle={1}
                                    dataKey="value"
                                  >
                                    {Object.entries(clientStatusCounts).filter(([k]) => k !== 'all').map(([key], index) => {
                                      const COLORS: Record<string, string> = {
                                        active: '#2e7d32',
                                        expired: '#e53935',
                                        cancelled: '#ef6c00',
                                        frozen: '#546e7a',
                                        pre_start: '#7b1fa2',
                                        refunded: '#8e24aa',
                                        no_subscription: '#90a4ae'
                                      };
                                      const color = COLORS[key as keyof typeof COLORS] || ["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#0088FE", "#00C49F"][index % 6];
                                      return <Cell key={key} fill={color} />;
                                    })}
                                  </Pie>
                                  <RechartsTooltip formatter={(v: any) => v} />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </Box>
                          {/* Status cards moved below chart in two rows, ordered (scroll if overflow) */}
                          {(() => {
                            const order = ['active', 'expired', 'frozen', 'no_subscription', 'pre_start', 'refunded'];
                            const items = order.map((k) => ({ key: k, label: k.replace(/_/g, ' '), value: clientStatusCounts ? (clientStatusCounts[k] || 0) : 0 }));
                            const row1 = items.slice(0, 3);
                            const row2 = items.slice(3, 6);
                            return (
                              <Box sx={{ maxHeight: { xs: 'none', md: 340 }, overflowY: 'auto', overflowX: 'hidden', pr: 1 }}>
                                <Stack spacing={1}>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    {row1.map((it) => (
                                      <Card key={it.key} variant="outlined" sx={{ flex: 1 }}>
                                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            <Typography sx={{ textTransform: 'capitalize' }} color="text.secondary">{it.label}</Typography>
                                            <Typography variant="h6">{it.value}</Typography>
                                          </Stack>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </Stack>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                    {row2.map((it) => (
                                      <Card key={it.key} variant="outlined" sx={{ flex: 1 }}>
                                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            <Typography sx={{ textTransform: 'capitalize' }} color="text.secondary">{it.label}</Typography>
                                            <Typography variant="h6">{it.value}</Typography>
                                          </Stack>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </Stack>
                                </Stack>
                              </Box>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Bottom: remaining height - Three KPI cards (one column) */}
                      <Stack direction="column" spacing={2} sx={{ flex: 2 }}>
                        <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">New Inquiries</Typography>
                            <Typography variant="h5">{clientStatusCounts?.no_subscription ?? 0}</Typography>
                          </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">Re New</Typography>
                            <Typography variant="h5">{subscriptionKinds?.renewal ?? 0}</Typography>
                          </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ flex: 1, display: 'flex' }}>
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="subtitle2" color="text.secondary">New</Typography>
                            <Typography variant="h5">{subscriptionKinds?.firstPlan ?? 0}</Typography>
                          </CardContent>
                        </Card>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Right column 2/3 - cancellation/retention cards + retention chart */}
                  <Box sx={{ flex: 2, minHeight: { md: 420 }, display: 'flex' }}>
                    <Stack spacing={2} sx={{ flex: 1 }}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Client cancellation rate</Typography>
                          <Typography variant="h4">
                            {(() => {
                              // Prefer precise computation from status counts if available
                              if (clientStatusCounts && typeof clientStatusCounts.all === 'number') {
                                const totalAll = clientStatusCounts.all || 0;
                                const expired = clientStatusCounts.expired || 0;
                                const cancelled = (clientStatusCounts as any).cancelled || 0;
                                const cancelledTotal = expired + cancelled;
                                const pct = totalAll > 0 ? (cancelledTotal / totalAll) * 100 : 0;
                                return `${pct.toFixed(1)}%`;
                              }
                              // Fallback to previous approach using growthData (expired only)
                              const total = growthData?.total || 0;
                              const expired = growthData?.expiredClients || 0;
                              const pct = total > 0 ? (expired / total) * 100 : 0;
                              return `${pct.toFixed(1)}%`;
                            })()}
                          </Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Client retention rate</Typography>
                          <Typography variant="h4">
                            {(() => {
                              const total = growthData?.total || 0;
                              const returning = growthData?.returningClients || 0;
                              const pct = total > 0 ? (returning / total) * 100 : 0;
                              return `${pct.toFixed(1)}%`;
                            })()}
                          </Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ flex: 1, minHeight: 280, display: 'flex' }}>
                        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>Retention rate</Typography>
                          <Box sx={{ flex: 1 }}>
                            {(() => {
                              const fallbackSeries = (() => {
                                const totalAll = clientStatusCounts?.all || 0;
                                const expiredAll = clientStatusCounts?.expired || 0;
                                const cancelledAll = (clientStatusCounts as any)?.cancelled || 0;
                                const cancelledSum = expiredAll + cancelledAll;
                                const total = growthData?.total || 0;
                                const returning = growthData?.returningClients || 0;
                                const retentionPct = total > 0 ? (returning / total) * 100 : 0;
                                const cancellationPct = (totalAll > 0 ? (cancelledSum / totalAll) * 100 : (total > 0 ? ( (growthData?.expiredClients || 0) / total) * 100 : 0));
                                const now = new Date();
                                return Array.from({ length: 8 }).map((_, i) => {
                                  const d = new Date(now.getTime() - (7 - i) * 24 * 60 * 60 * 1000);
                                  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                  return { date: dateKey, retention: Number(retentionPct.toFixed(1)), cancellation: Number(cancellationPct.toFixed(1)) };
                                });
                              })();
                              const series = (retentionSeries && retentionSeries.length > 0)
                                ? retentionSeries.map((p) => ({ date: p.date, retention: Number(p.retentionPct.toFixed(1)), cancellation: Number(p.cancellationPct.toFixed(1)) }))
                                : fallbackSeries;
                              return (
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={series}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <RechartsTooltip formatter={(v: any) => `${v}%`} />
                                    <Legend />
                                    <Line type="monotone" dataKey="retention" stroke="#1976d2" strokeWidth={2} dot={false} name="Retention %" />
                                    <Line type="monotone" dataKey="cancellation" stroke="#ed6c02" strokeWidth={2} dot={false} name="Cancellation %" />
                                  </LineChart>
                                </ResponsiveContainer>
                              );
                            })()}
                          </Box>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : tabIndex === 2 ? (
          // Form submissions
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Form submissions</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'stretch' }}>
                  {/* Left column: 2/5 - Plan Workflow Metrics */}
                  <Box sx={{ flex: 2 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 2 }}>Plan Workflow Metrics</Typography>
                        {loadingForms ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                          </Box>
                        ) : !formsData ? (
                          <Typography color="text.secondary">No forms data</Typography>
                        ) : (
                          <Stack spacing={2}>
                            {[
                              // Render top-to-bottom so bottom-most is Scheduled
                              { key: 'completed', label: 'Completed', color: '#2e7d32', value: formsData?.completed?.total || 0, pct: workflowTotals.pctCompleted, overTime: formsData?.completed?.overTime || [], Icon: CheckCircleIcon },
                              { key: 'submitted', label: 'In Progress', color: '#7b1fa2', value: formsData?.submitted?.total || 0, pct: workflowTotals.pctSubmitted, overTime: formsData?.submitted?.overTime || [], Icon: AutorenewIcon },
                              { key: 'requested', label: 'Requested', color: '#1976d2', value: formsData?.requested?.total || 0, pct: workflowTotals.pctRequested, overTime: formsData?.requested?.overTime || [], Icon: RequestPageIcon },
                              { key: 'scheduled', label: 'Scheduled', color: '#ed6c02', value: formsData?.scheduled?.total || 0, pct: workflowTotals.pctScheduled, overTime: formsData?.scheduled?.overTime || [], Icon: EventAvailableIcon },
                            ].map((step, idx, arr) => (
                              <Stack key={step.key} direction="row" spacing={2} alignItems="stretch">
                                {/* left tracking line */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: step.color, mt: 1.25 }} />
                                  {idx < arr.length - 1 && (
                                    <Box sx={{ width: 2, bgcolor: step.color, flexGrow: 1, minHeight: 28, mt: 0.5 }} />
                                  )}
                                </Box>
                                {/* right content card */}
                                <Card variant="outlined" sx={{ flex: 1 }}>
                                  <CardContent sx={{ display: 'flex', flexDirection: 'column', py: 2 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Tooltip title={step.label}>
                                          <Box sx={{ display: 'flex' }}>
                                            <step.Icon sx={{ color: step.color }} />
                                          </Box>
                                        </Tooltip>
                                        <Typography sx={{ fontWeight: 600 }}>{step.label}</Typography>
                                      </Stack>
                                      <Typography variant="h6" sx={{ color: step.color }}>{step.value}</Typography>
                                    </Stack>
                                    {/* percentage contribution */}
                                    <Stack spacing={0.5} sx={{ mb: 1 }}>
                                      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, step.pct || 0))} sx={{ height: 6, borderRadius: 999, [`& .MuiLinearProgress-bar`]: { backgroundColor: step.color } }} />
                                      <Typography variant="caption" color="text.secondary">{step.pct}% of workflow</Typography>
                                    </Stack>
                                    {/* tiny sparkline */}
                                    {Array.isArray(step.overTime) && step.overTime.length > 0 && (
                                      <Box sx={{ width: '100%', height: 48 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <AreaChart data={step.overTime.map((row: any) => {
                                            const { date, ...rest } = row || {};
                                            const total = Object.entries(rest).reduce((acc, [k, v]) => k === 'date' ? acc : acc + (Number(v) || 0), 0);
                                            return { date, value: total };
                                          })}>
                                            <defs>
                                              <linearGradient id={`wf_${step.key}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={step.color} stopOpacity={0.5} />
                                                <stop offset="95%" stopColor={step.color} stopOpacity={0} />
                                              </linearGradient>
                                            </defs>
                                            <Area type="monotone" dataKey="value" stroke={step.color} fillOpacity={1} fill={`url(#wf_${step.key})`} />
                                          </AreaChart>
                                        </ResponsiveContainer>
                                      </Box>
                                    )}
                                  </CardContent>
                                </Card>
                              </Stack>
                            ))}
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                              Flow (bottom → top): Scheduled → Requested → In Progress → Completed
                            </Typography>
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  </Box>

                  {/* Right column: 3/5 - summary KPIs */}
                  <Box sx={{ flex: 3 }}>
                    <Stack spacing={2}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Total submissions</Typography>
                          <Typography variant="h4">{formsData?.submitted?.total ?? 0}</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined" sx={{ minHeight: 280, display: 'flex' }}>
                        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle1" sx={{ mb: 1 }}>Demand rate</Typography>
                          <Box sx={{ flex: 1 }}>
                            {loadingForms ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <CircularProgress />
                              </Box>
                            ) : demandSeries.length === 0 ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Typography color="text.secondary">No demand activity</Typography>
                              </Box>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={demandSeries} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
                                  <defs>
                                    <linearGradient id="colorRequested" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#1976d2" stopOpacity={0.45} />
                                      <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#7b1fa2" stopOpacity={0.45} />
                                      <stop offset="95%" stopColor="#7b1fa2" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" tickFormatter={(d) => {
                                    const [,m,day] = String(d).split('-');
                                    return `${m}/${day}`;
                                  }} />
                                  <YAxis yAxisId="left" allowDecimals={false} />
                                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                  <RechartsTooltip content={<DemandTooltip />} />
                                  <Legend />
                                  <Area yAxisId="left" type="monotone" dataKey="requested" stroke="#1976d2" strokeWidth={2} dot={false} fillOpacity={1} fill="url(#colorRequested)" name="Requested" stackId="1" animationDuration={400} />
                                  <Area yAxisId="left" type="monotone" dataKey="submitted" stroke="#7b1fa2" strokeWidth={2} dot={false} fillOpacity={1} fill="url(#colorSubmitted)" name="In Progress" stackId="1" animationDuration={400} />
                                  <Line yAxisId="right" type="monotone" dataKey="convPct" stroke="#2e7d32" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Conversion %" />
                                  <Brush dataKey="date" height={20} travellerWidth={8} stroke="#90a4ae" />
                                  
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'stretch' }}>
                            {/* Left: percentages */}
                            <Box sx={{ flex: 1, display: 'flex' }}>
                              <Stack spacing={1.5} sx={{ flex: 1, justifyContent: 'center' }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ed6c02' }} />
                                  <Typography variant="body2" sx={{ flex: 1 }}>Workout</Typography>
                                  <Typography variant="h6">{demandByType.workoutPct}%</Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1976d2' }} />
                                  <Typography variant="body2" sx={{ flex: 1 }}>Nutrition</Typography>
                                  <Typography variant="h6">{demandByType.nutritionPct}%</Typography>
                                </Stack>
                              </Stack>
                            </Box>
                            {/* Right: donut */}
                            <Box sx={{ flex: 1, minHeight: 220 }}>
                              <Box sx={{ position: 'relative', width: '100%', height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={[
                                        { name: 'Workout', value: demandByType.workout, color: '#ed6c02' },
                                        { name: 'Nutrition', value: demandByType.nutrition, color: '#1976d2' },
                                      ]}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={85}
                                      dataKey="value"
                                      paddingAngle={1}
                                    >
                                      <Cell key="workout" fill="#ed6c02" />
                                      <Cell key="nutrition" fill="#1976d2" />
                                    </Pie>
                                    <RechartsTooltip formatter={(v: any) => v} />
                                    <Legend />
                                  </PieChart>
                                </ResponsiveContainer>
                                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <Stack spacing={0} alignItems="center">
                                    <Typography variant="caption" color="text.secondary">Total Demand</Typography>
                                    <Typography variant="h6">{demandByType.total}</Typography>
                                  </Stack>
                                </Box>
                              </Box>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : tabIndex === 3 ? (
          // Team Capacity - 50/50 layout
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Team Capacity</Typography>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'stretch' }}>
                  {/* Left: Capacity VS Demand */}
                  <Box sx={{ flex: 1 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Capacity VS Demand</Typography>
                        <Box sx={{ width: '100%', height: 300 }}>
                          {loadingTeam ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <CircularProgress />
                            </Box>
                          ) : !capacityData ? (
                            <Typography color="text.secondary">No capacity data</Typography>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                { period: 'This Week', Capacity: capacityData?.thisWeek?.capacity || 0, Demand: capacityData?.thisWeek?.demand || 0 },
                                { period: 'Last Week', Capacity: capacityData?.lastWeek?.capacity || 0, Demand: capacityData?.lastWeek?.demand || 0 },
                              ]}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip />
                                <Legend />
                                <Bar dataKey="Capacity" fill="#2e7d32" radius={[4,4,0,0]} />
                                <Bar dataKey="Demand" fill="#1976d2" radius={[4,4,0,0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Box>
                  {/* Right: 3 vertical cards */}
                  <Box sx={{ flex: 1 }}>
                    <Stack spacing={2}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Total capacity (this week)</Typography>
                          <Typography variant="h4">{capacityData?.thisWeek?.capacity ?? 0}</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Workout capacity (this week)</Typography>
                          <Typography variant="h4">{capacityData?.thisWeek?.workoutCapacity ?? 0}</Typography>
                        </CardContent>
                      </Card>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary">Nutrition capacity (this week)</Typography>
                          <Typography variant="h4">{capacityData?.thisWeek?.nutritionCapacity ?? 0}</Typography>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : tabIndex === 4 ? (
          // Team Productivity (moved content)
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Team Productivity</Typography>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'stretch' }}>
                  {/* Left: 7/10 table */}
                  <Box sx={{ flex: 7 }}>
                    <Card variant="outlined">
                      <CardContent>
                        {loadingTeam ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                          </Box>
                        ) : !teamCapacity?.members?.length ? (
                          <Typography color="text.secondary">No team data</Typography>
                        ) : (
                          (() => {
                            const members = teamCapacity.members as any[];
                            const maxPending = Math.max(1, ...members.map(m => Number(m.pendingPlans || 0)));
                            const maxCreated = Math.max(1, ...members.map(m => Number(m.plansCreated || 0)));
                            const totalAll = members.reduce((a, b) => a + (Number(b.pendingPlans || 0) + Number(b.plansCreated || 0)), 0);
                            return (
                              <Table size="small" sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                                <TableHead>
                                  <TableRow sx={{ '& th': { backgroundColor: 'primary.main', color: 'common.white', fontWeight: 700, fontSize: '0.95rem', py: 1.25 } }}>
                                    <TableCell>Team Member</TableCell>
                                    <TableCell align="right">Plans Created</TableCell>
                                    <TableCell align="right">Pending Plans</TableCell>
                                    <TableCell align="right">Avg. Processing Time</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {members.map((m) => {
                                    const created = Number(m.plansCreated || 0);
                                    const pending = Number(m.pendingPlans || 0);
                                    const total = created + pending;
                                    const share = totalAll > 0 ? (total / totalAll) * 100 : 0;
                                    const createdPctOfMax = Math.min(100, (created / maxCreated) * 100);
                                    const pendingPctOfMax = Math.min(100, (pending / maxPending) * 100);
                                    const name = m.name || '—';
                                    return (
                                      <TableRow key={m.userId} hover>
                                        <TableCell>
                                          <Stack direction="row" spacing={1.25} alignItems="center">
                                            <Avatar sx={{ width: 28, height: 28 }}>{String(name).slice(0,1).toUpperCase()}</Avatar>
                                            <Stack spacing={0}>
                                              <Typography sx={{ lineHeight: 1.2 }}>{name}</Typography>
                                              <Typography variant="caption" color="text.secondary">Workload share: {share.toFixed(0)}%</Typography>
                                            </Stack>
                                          </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ minWidth: 140 }}>
                                          <Stack spacing={0.5} alignItems="flex-end">
                                            <Typography>{created.toLocaleString()}</Typography>
                                            <LinearProgress variant="determinate" value={createdPctOfMax} sx={{ width: 110, height: 6, borderRadius: 999 }} />
                                          </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ minWidth: 140 }}>
                                          <Stack spacing={0.5} alignItems="flex-end">
                                            <Typography>{pending.toLocaleString()}</Typography>
                                            <LinearProgress variant="determinate" value={pendingPctOfMax} sx={{ width: 110, height: 6, borderRadius: 999 }} />
                                          </Stack>
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                          <Typography>{(Number(m.avgProcessingHours || 0)).toFixed(1)} h</Typography>
                                        </TableCell>
                                        <TableCell align="right">{total.toLocaleString()}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  <TableRow>
                                    <TableCell>
                                      <Typography sx={{ fontWeight: 600 }}>Total</Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>{Number(teamCapacity?.summary?.totalCompleted || 0).toLocaleString()}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>{Number(teamCapacity?.summary?.totalPending || 0).toLocaleString()}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>—</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>{(Number(teamCapacity?.summary?.totalCompleted || 0) + Number(teamCapacity?.summary?.totalPending || 0)).toLocaleString()}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            );
                          })()
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                  {/* Right: 3/10 workload balance */}
                  <Box sx={{ flex: 3 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Coach workload balance</Typography>
                        {loadingTeam ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                          </Box>
                        ) : !teamCapacity?.members?.length ? (
                          <Typography color="text.secondary">No workload data</Typography>
                        ) : (
                          <Box sx={{ position: 'relative', width: '100%', height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={teamCapacity.members.map((m: any) => ({ name: m.name, value: m.pendingPlans || 0 }))}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={85}
                                  dataKey="value"
                                  paddingAngle={1}
                                  nameKey="name"
                                >
                                  {teamCapacity.members.map((m: any, idx: number) => (
                                    <Cell key={m.userId} fill={["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#0088FE", "#00C49F"][idx % 6]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(v: any) => v} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                              <Stack spacing={0} alignItems="center">
                                <Typography variant="caption" color="text.secondary">Total Pending</Typography>
                                <Typography variant="h6">{teamCapacity?.summary?.totalPending ?? 0}</Typography>
                              </Stack>
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {tabs[tabIndex]}
              </Typography>
              <Typography color="text.secondary">This page is blank for now.</Typography>
            </CardContent>
          </Card>
        )}
      </Container>
    </LocalizationProvider>
  );
}


