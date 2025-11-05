'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import { Add, Trash } from '@wandersonalwes/iconsax-react';
import api from '@/utils/axios';
import FileUpload from '@/components/FileUpload';

interface FeatureItem { title: string; description: string; icon?: string }
interface TestimonialItem { quote: string; author: string; role: string }
interface WhyPoint { title: string; desc: string }
interface PricingFeature { key: string }
interface PricingPlan { id: string; title: string; price: string; badge?: string; desc?: string; includes?: PricingFeature[]; bestForDesc?: string }
interface ProblemSection { header?: string; subheader?: string; title?: string; pointIntro?: string; points?: string[] }
interface SolutionSection { title?: string; subtitle?: string; intro?: string; features?: string[] }
interface WhySection { header?: string; subheader?: string; points?: WhyPoint[] }
interface PricingSection { header?: string; subheader?: string; plans?: PricingPlan[] }
interface FinalCtaSection { header?: string; subheader?: string }
interface BookDemoSection { title?: string; subtitle?: string }
interface SupportSection { title?: string; subtitle?: string }
interface VideoSection { title?: string; subtitle?: string; videoUrl?: string; posterUrl?: string }
interface Sections { problem?: ProblemSection; solution?: SolutionSection; why?: WhySection; pricing?: PricingSection; finalCta?: FinalCtaSection; bookDemo?: BookDemoSection; support?: SupportSection; video?: VideoSection }
interface PerLangContent { title?: string; subtitle?: string; ctaText?: string; ctaUrl?: string; features?: FeatureItem[]; testimonials?: TestimonialItem[]; sections?: Sections }
interface LandingConfig { heroImage?: string; allowNewSubscriptions?: boolean; translations: { en: PerLangContent; ar: PerLangContent } }

export default function AdminLandingPage() {
  const [config, setConfig] = useState<LandingConfig>({ translations: { en: {}, ar: {} } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeLang, setActiveLang] = useState<'en' | 'ar'>('en');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.get('/api/admin/landing');
        if (!isMounted) return;
        const initial: LandingConfig = res.data?.landing || { translations: { en: {}, ar: {} } };
        setConfig({
          heroImage: initial.heroImage || '',
          allowNewSubscriptions: initial.allowNewSubscriptions ?? true,
          translations: {
            en: {
              title: initial.translations?.en?.title || '',
              subtitle: initial.translations?.en?.subtitle || '',
              ctaText: initial.translations?.en?.ctaText || '',
              ctaUrl: initial.translations?.en?.ctaUrl || '',
              features: initial.translations?.en?.features || [],
              testimonials: initial.translations?.en?.testimonials || [],
              sections: initial.translations?.en?.sections || {}
            },
            ar: {
              title: initial.translations?.ar?.title || '',
              subtitle: initial.translations?.ar?.subtitle || '',
              ctaText: initial.translations?.ar?.ctaText || '',
              ctaUrl: initial.translations?.ar?.ctaUrl || '',
              features: initial.translations?.ar?.features || [],
              testimonials: initial.translations?.ar?.testimonials || [],
              sections: initial.translations?.ar?.sections || {}
            }
          }
        });
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load landing config');
      } finally {
        setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const addFeature = () => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), features: [ ...((prev.translations[activeLang].features) || []), { title: '', description: '', icon: '' } ] } }
    }));
  };
  const removeFeature = (index: number) => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), features: (prev.translations[activeLang].features || []).filter((_, i) => i !== index) } }
    }));
  };
  const updateFeature = (index: number, field: keyof FeatureItem, value: string) => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), features: (prev.translations[activeLang].features || []).map((f, i) => i === index ? { ...f, [field]: value } : f) } }
    }));
  };

  const addTestimonial = () => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), testimonials: [ ...((prev.translations[activeLang].testimonials) || []), { quote: '', author: '', role: '' } ] } }
    }));
  };
  const removeTestimonial = (index: number) => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), testimonials: (prev.translations[activeLang].testimonials || []).filter((_, i) => i !== index) } }
    }));
  };
  const updateTestimonial = (index: number, field: keyof TestimonialItem, value: string) => {
    setConfig(prev => ({
      ...prev,
      translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), testimonials: (prev.translations[activeLang].testimonials || []).map((t, i) => i === index ? { ...t, [field]: value } : t) } }
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put('/api/admin/landing', config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save landing config');
    } finally {
      setSaving(false);
    }
  };

  // Helpers for nested sections
  const updateSectionField = (section: keyof Sections, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLang]: {
          ...(prev.translations[activeLang] || {}),
          sections: {
            ...(prev.translations[activeLang].sections || {}),
            [section]: { ...(prev.translations[activeLang].sections?.[section] || {}), [field]: value }
          }
        }
      }
    }));
  };

  const pushToArrayField = (section: keyof Sections, field: string, defaultValue: any) => {
    setConfig(prev => {
      const current = prev.translations[activeLang].sections?.[section] as any || {};
      const arr = Array.isArray(current[field]) ? current[field] : [];
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [activeLang]: {
            ...(prev.translations[activeLang] || {}),
            sections: {
              ...(prev.translations[activeLang].sections || {}),
              [section]: { ...current, [field]: [...arr, defaultValue] }
            }
          }
        }
      };
    });
  };

  const removeFromArrayField = (section: keyof Sections, field: string, index: number) => {
    setConfig(prev => {
      const current = prev.translations[activeLang].sections?.[section] as any || {};
      const arr = Array.isArray(current[field]) ? current[field] : [];
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [activeLang]: {
            ...(prev.translations[activeLang] || {}),
            sections: {
              ...(prev.translations[activeLang].sections || {}),
              [section]: { ...current, [field]: arr.filter((_: any, i: number) => i !== index) }
            }
          }
        }
      };
    });
  };

  if (loading) return (
    <Box sx={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Container sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Landing Page (Global)</Typography>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={20} /> : undefined}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Tabs value={activeLang} onChange={(_, v) => setActiveLang(v)} aria-label="Language tabs">
          <Tab label="English" value="en" />
          <Tab label="Arabic" value="ar" />
        </Tabs>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Saved successfully</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={12}>
          <Card>
            <CardHeader title="Hero" />
            <CardContent>
              <Stack spacing={3}>
                <TextField label="Title" fullWidth value={config.translations[activeLang].title || ''} onChange={(e) => setConfig(p => ({ ...p, translations: { ...p.translations, [activeLang]: { ...(p.translations[activeLang] || {}), title: e.target.value } } }))} />
                <TextField label="Subtitle" fullWidth multiline rows={3} value={config.translations[activeLang].subtitle || ''} onChange={(e) => setConfig(p => ({ ...p, translations: { ...p.translations, [activeLang]: { ...(p.translations[activeLang] || {}), subtitle: e.target.value } } }))} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Hero Image</Typography>
                  <FileUpload
                    onUploadComplete={(url) => setConfig(p => ({ ...p, heroImage: url }))}
                    currentImageUrl={config.heroImage}
                    workspaceId={'global'}
                    uploadType="landing"
                    maxSize={5}
                  />
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField label="CTA Text" fullWidth value={config.translations[activeLang].ctaText || ''} onChange={(e) => setConfig(p => ({ ...p, translations: { ...p.translations, [activeLang]: { ...(p.translations[activeLang] || {}), ctaText: e.target.value } } }))} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="CTA URL" fullWidth value={config.translations[activeLang].ctaUrl || ''} onChange={(e) => setConfig(p => ({ ...p, translations: { ...p.translations, [activeLang]: { ...(p.translations[activeLang] || {}), ctaUrl: e.target.value } } }))} />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Features" action={<Button variant="outlined" startIcon={<Add size={16} />} onClick={addFeature}>Add</Button>} />
            <CardContent>
              <Stack spacing={2}>
                {(config.translations[activeLang].features || []).map((f, i) => (
                  <Card key={i} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2">Feature {i + 1}</Typography>
                          <IconButton color="error" onClick={() => removeFeature(i)}><Trash size={16} /></IconButton>
                        </Box>
                        <TextField label="Title" fullWidth value={f.title} onChange={(e) => updateFeature(i, 'title', e.target.value)} />
                        <TextField label="Description" fullWidth multiline rows={2} value={f.description} onChange={(e) => updateFeature(i, 'description', e.target.value)} />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Testimonials" action={<Button variant="outlined" startIcon={<Add size={16} />} onClick={addTestimonial}>Add</Button>} />
            <CardContent>
              <Stack spacing={2}>
                {(config.translations[activeLang].testimonials || []).map((t, i) => (
                  <Card key={i} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle2">Testimonial {i + 1}</Typography>
                          <IconButton color="error" onClick={() => removeTestimonial(i)}><Trash size={16} /></IconButton>
                        </Box>
                        <TextField label="Quote" fullWidth multiline rows={3} value={t.quote} onChange={(e) => updateTestimonial(i, 'quote', e.target.value)} />
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField label="Author" fullWidth value={t.author} onChange={(e) => updateTestimonial(i, 'author', e.target.value)} />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField label="Role" fullWidth value={t.role} onChange={(e) => updateTestimonial(i, 'role', e.target.value)} />
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Problem Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Problem Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Header" fullWidth value={config.translations[activeLang].sections?.problem?.header || ''} onChange={(e) => updateSectionField('problem', 'header', e.target.value)} />
                <TextField label="Subheader" fullWidth value={config.translations[activeLang].sections?.problem?.subheader || ''} onChange={(e) => updateSectionField('problem', 'subheader', e.target.value)} />
                <TextField label="Title" fullWidth value={config.translations[activeLang].sections?.problem?.title || ''} onChange={(e) => updateSectionField('problem', 'title', e.target.value)} />
                <TextField label="Intro" fullWidth value={config.translations[activeLang].sections?.problem?.pointIntro || ''} onChange={(e) => updateSectionField('problem', 'pointIntro', e.target.value)} />
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">Points</Typography>
                    <Button size="small" variant="outlined" startIcon={<Add size={16} />} onClick={() => pushToArrayField('problem', 'points', '')}>Add Point</Button>
                  </Stack>
                  <Stack spacing={1}>
                    {(config.translations[activeLang].sections?.problem?.points || []).map((p, idx) => (
                      <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                        <TextField fullWidth value={p} onChange={(e) => {
                          const val = e.target.value;
                          setConfig(prev => {
                            const current = prev.translations[activeLang].sections?.problem || {} as any;
                            const arr = Array.isArray(current.points) ? current.points.slice() : [];
                            arr[idx] = val;
                            return {
                              ...prev,
                              translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), problem: { ...current, points: arr } } } }
                            };
                          });
                        }} />
                        <Button color="error" variant="outlined" onClick={() => removeFromArrayField('problem', 'points', idx)}>Remove</Button>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Solution Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Solution Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Title" fullWidth value={config.translations[activeLang].sections?.solution?.title || ''} onChange={(e) => updateSectionField('solution', 'title', e.target.value)} />
                <TextField label="Subtitle" fullWidth value={config.translations[activeLang].sections?.solution?.subtitle || ''} onChange={(e) => updateSectionField('solution', 'subtitle', e.target.value)} />
                <TextField label="Intro" fullWidth value={config.translations[activeLang].sections?.solution?.intro || ''} onChange={(e) => updateSectionField('solution', 'intro', e.target.value)} />
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">Features</Typography>
                    <Button size="small" variant="outlined" startIcon={<Add size={16} />} onClick={() => pushToArrayField('solution', 'features', '')}>Add Feature</Button>
                  </Stack>
                  <Stack spacing={1}>
                    {(config.translations[activeLang].sections?.solution?.features || []).map((p, idx) => (
                      <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                        <TextField fullWidth value={p} onChange={(e) => {
                          const val = e.target.value;
                          setConfig(prev => {
                            const current = prev.translations[activeLang].sections?.solution || {} as any;
                            const arr = Array.isArray(current.features) ? current.features.slice() : [];
                            arr[idx] = val;
                            return {
                              ...prev,
                              translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), solution: { ...current, features: arr } } } }
                            };
                          });
                        }} />
                        <Button color="error" variant="outlined" onClick={() => removeFromArrayField('solution', 'features', idx)}>Remove</Button>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Video Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Video Section" />
            <CardContent>
              <Stack spacing={3}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Video Title" fullWidth value={config.translations[activeLang].sections?.video?.title || ''} onChange={(e) => updateSectionField('video', 'title', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Video Subtitle" fullWidth value={config.translations[activeLang].sections?.video?.subtitle || ''} onChange={(e) => updateSectionField('video', 'subtitle', e.target.value)} />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  label="YouTube URL (or direct MP4 URL)"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={config.translations[activeLang].sections?.video?.videoUrl || ''}
                  onChange={(e) => updateSectionField('video', 'videoUrl', e.target.value)}
                />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Poster Image (optional)
                  </Typography>
                  <FileUpload
                    onUploadComplete={(url) => updateSectionField('video', 'posterUrl', url)}
                    currentImageUrl={config.translations[activeLang].sections?.video?.posterUrl || ''}
                    workspaceId={'global'}
                    uploadType="landing"
                    accept="image/*"
                    maxSize={5}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Why FitForce Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Why FitForce Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Header" fullWidth value={config.translations[activeLang].sections?.why?.header || ''} onChange={(e) => updateSectionField('why', 'header', e.target.value)} />
                <TextField label="Subheader" fullWidth value={config.translations[activeLang].sections?.why?.subheader || ''} onChange={(e) => updateSectionField('why', 'subheader', e.target.value)} />
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">Points</Typography>
                    <Button size="small" variant="outlined" startIcon={<Add size={16} />} onClick={() => pushToArrayField('why', 'points', { title: '', desc: '' })}>Add Point</Button>
                  </Stack>
                  <Stack spacing={1}>
                    {(config.translations[activeLang].sections?.why?.points || []).map((p, idx) => (
                      <Card key={idx} variant="outlined">
                        <CardContent>
                          <Stack spacing={1}>
                            <TextField label="Title" fullWidth value={p.title} onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const current = prev.translations[activeLang].sections?.why || {} as any;
                                const arr = Array.isArray(current.points) ? current.points.slice() : [];
                                arr[idx] = { ...arr[idx], title: val };
                                return {
                                  ...prev,
                                  translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), why: { ...current, points: arr } } } }
                                };
                              });
                            }} />
                            <TextField label="Description" fullWidth value={p.desc} onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const current = prev.translations[activeLang].sections?.why || {} as any;
                                const arr = Array.isArray(current.points) ? current.points.slice() : [];
                                arr[idx] = { ...arr[idx], desc: val };
                                return {
                                  ...prev,
                                  translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), why: { ...current, points: arr } } } }
                                };
                              });
                            }} />
                            <Box>
                              <Button color="error" variant="outlined" onClick={() => removeFromArrayField('why', 'points', idx)}>Remove</Button>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Pricing Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Pricing Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Header" fullWidth value={config.translations[activeLang].sections?.pricing?.header || ''} onChange={(e) => updateSectionField('pricing', 'header', e.target.value)} />
                <TextField label="Subheader" fullWidth value={config.translations[activeLang].sections?.pricing?.subheader || ''} onChange={(e) => updateSectionField('pricing', 'subheader', e.target.value)} />
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">Plans</Typography>
                    <Button size="small" variant="outlined" startIcon={<Add size={16} />} onClick={() => pushToArrayField('pricing', 'plans', { id: crypto.randomUUID(), title: '', price: '', badge: '', desc: '', includes: [], bestForDesc: '' })}>Add Plan</Button>
                  </Stack>
                  <Stack spacing={1}>
                    {(config.translations[activeLang].sections?.pricing?.plans || []).map((plan, idx) => (
                      <Card key={plan.id || idx} variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}><TextField label="Title" fullWidth value={plan.title} onChange={(e) => {
                                const val = e.target.value;
                                setConfig(prev => {
                                  const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                  const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                  arr[idx] = { ...arr[idx], title: val };
                                  return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                });
                              }} /></Grid>
                              <Grid item xs={12} md={4}><TextField label="Price" fullWidth value={plan.price} onChange={(e) => {
                                const val = e.target.value;
                                setConfig(prev => {
                                  const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                  const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                  arr[idx] = { ...arr[idx], price: val };
                                  return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                });
                              }} /></Grid>
                              <Grid item xs={12} md={4}><TextField label="Badge" fullWidth value={plan.badge || ''} onChange={(e) => {
                                const val = e.target.value;
                                setConfig(prev => {
                                  const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                  const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                  arr[idx] = { ...arr[idx], badge: val };
                                  return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                });
                              }} /></Grid>
                            </Grid>
                            <TextField label="Description" fullWidth value={plan.desc || ''} onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                arr[idx] = { ...arr[idx], desc: val };
                                return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                              });
                            }} />
                            <TextField label="Best For" fullWidth value={plan.bestForDesc || ''} onChange={(e) => {
                              const val = e.target.value;
                              setConfig(prev => {
                                const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                arr[idx] = { ...arr[idx], bestForDesc: val };
                                return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                              });
                            }} />
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="subtitle2">Includes</Typography>
                                <Button size="small" variant="outlined" startIcon={<Add size={16} />} onClick={() => {
                                  setConfig(prev => {
                                    const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                    const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                    const includes = Array.isArray(arr[idx]?.includes) ? arr[idx].includes.slice() : [];
                                    includes.push({ key: '' });
                                    arr[idx] = { ...arr[idx], includes };
                                    return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                  });
                                }}>Add Item</Button>
                              </Stack>
                              <Stack spacing={1}>
                                {(plan.includes || []).map((inc, j) => (
                                  <Box key={j} sx={{ display: 'flex', gap: 1 }}>
                                    <TextField fullWidth value={inc.key} onChange={(e) => {
                                      const val = e.target.value;
                                      setConfig(prev => {
                                        const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                        const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                        const includes = Array.isArray(arr[idx]?.includes) ? arr[idx].includes.slice() : [];
                                        includes[j] = { key: val };
                                        arr[idx] = { ...arr[idx], includes };
                                        return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                      });
                                    }} />
                                    <Button color="error" variant="outlined" onClick={() => {
                                      setConfig(prev => {
                                        const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                        const arr = Array.isArray(current.plans) ? current.plans.slice() : [];
                                        const includes = Array.isArray(arr[idx]?.includes) ? arr[idx].includes.filter((_: any, k: number) => k !== j) : [];
                                        arr[idx] = { ...arr[idx], includes };
                                        return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                      });
                                    }}>Remove</Button>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                            <Box>
                              <Button color="error" variant="outlined" onClick={() => {
                                setConfig(prev => {
                                  const current = prev.translations[activeLang].sections?.pricing || {} as any;
                                  const arr = Array.isArray(current.plans) ? current.plans.filter((_: any, i: number) => i !== idx) : [];
                                  return { ...prev, translations: { ...prev.translations, [activeLang]: { ...(prev.translations[activeLang] || {}), sections: { ...(prev.translations[activeLang].sections || {}), pricing: { ...current, plans: arr } } } } };
                                });
                              }}>Remove Plan</Button>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Final CTA Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Final CTA Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Header" fullWidth value={config.translations[activeLang].sections?.finalCta?.header || ''} onChange={(e) => updateSectionField('finalCta', 'header', e.target.value)} />
                <TextField label="Subheader" fullWidth value={config.translations[activeLang].sections?.finalCta?.subheader || ''} onChange={(e) => updateSectionField('finalCta', 'subheader', e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Book Demo Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Book Demo Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Title" fullWidth value={config.translations[activeLang].sections?.bookDemo?.title || ''} onChange={(e) => updateSectionField('bookDemo', 'title', e.target.value)} />
                <TextField label="Subtitle" fullWidth value={config.translations[activeLang].sections?.bookDemo?.subtitle || ''} onChange={(e) => updateSectionField('bookDemo', 'subtitle', e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Support Section */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Support Section" />
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Title" fullWidth value={config.translations[activeLang].sections?.support?.title || ''} onChange={(e) => updateSectionField('support', 'title', e.target.value)} />
                <TextField label="Subtitle" fullWidth value={config.translations[activeLang].sections?.support?.subtitle || ''} onChange={(e) => updateSectionField('support', 'subtitle', e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}


