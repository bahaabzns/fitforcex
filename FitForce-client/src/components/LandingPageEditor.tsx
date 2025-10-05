'use client';

import { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Typography,
  Stack,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material';
import {
  Add,
  Trash,
  Eye
} from '@wandersonalwes/iconsax-react';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import FileUpload from './FileUpload';

interface LandingConfig {
  title?: string;
  subtitle?: string;
  heroImage?: string;
  ctaText?: string;
  ctaUrl?: string;
  allowNewSubscriptions?: boolean;
  features?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  testimonials?: Array<{
    quote: string;
    author: string;
    role: string;
  }>;
}

interface LandingPageEditorProps {
  workspaceId: string;
  initialConfig?: LandingConfig;
  onSave?: (config: LandingConfig) => void;
}

export default function LandingPageEditor({
  workspaceId,
  initialConfig = {},
  onSave
}: LandingPageEditorProps) {
  const intl = useIntl();
  const [config, setConfig] = useState<LandingConfig>(initialConfig);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with default values if not provided
  useEffect(() => {
    if (!initialConfig || !initialConfig.title) {
      setConfig({
        title: "Welcome to Our Fitness Community",
        subtitle: "Transform your fitness journey with personalized training and nutrition plans",
        ctaText: "Get Started Today",
        ctaUrl: "",
        allowNewSubscriptions: true,
        features: [
          {
            title: "Personal Training",
            description: "One-on-one sessions with certified trainers",
            icon: ""
          },
          {
            title: "Nutrition Planning",
            description: "Custom meal plans tailored to your goals",
            icon: ""
          },
          {
            title: "Progress Tracking",
            description: "Monitor your fitness journey with detailed analytics",
            icon: ""
          }
        ],
        testimonials: [
          {
            quote: "Amazing results in just 3 months!",
            author: "Sarah Johnson",
            role: "Client"
          }
        ],
        ...(initialConfig || {})
      });
    } else {
      setConfig({ allowNewSubscriptions: true, ...initialConfig });
    }
  }, [initialConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.put(`/api/workspaces/${workspaceId}/landing`, {
        landingConfig: config
      });

      setSuccess(true);
      onSave?.(config);
      openSnackbar({
        open: true,
        message: 'Landing page saved successfully!',
        variant: 'alert',
        alert: { color: 'success' }
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save landing page configuration");
      openSnackbar({
        open: true,
        message: 'Failed to save landing page',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    setConfig(prev => ({
      ...prev,
      features: [
        ...(prev.features || []),
        { title: "", description: "", icon: "" }
      ]
    }));
  };

  const removeFeature = (index: number) => {
    setConfig(prev => ({
      ...prev,
      features: prev.features?.filter((_, i) => i !== index) || []
    }));
  };

  const updateFeature = (index: number, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      features: prev.features?.map((feature, i) =>
        i === index ? { ...feature, [field]: value } : feature
      ) || []
    }));
  };

  const addTestimonial = () => {
    setConfig(prev => ({
      ...prev,
      testimonials: [
        ...(prev.testimonials || []),
        { quote: "", author: "", role: "" }
      ]
    }));
  };

  const removeTestimonial = (index: number) => {
    setConfig(prev => ({
      ...prev,
      testimonials: prev.testimonials?.filter((_, i) => i !== index) || []
    }));
  };

  const updateTestimonial = (index: number, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      testimonials: prev.testimonials?.map((testimonial, i) =>
        i === index ? { ...testimonial, [field]: value } : testimonial
      ) || []
    }));
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Landing Page Builder</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add size={16} />}
            onClick={addFeature}
          >
            Add Feature
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add size={16} />}
            onClick={addTestimonial}
          >
            Add Testimonial
          </Button>
          <Button
            variant="outlined"
            startIcon={<Eye size={20} />}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : null}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </Box>

      {/* Status Messages */}
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">Landing page saved successfully!</Alert>}

      <Grid container spacing={3}>
        {/* Editor */}
        <Grid item xs={12} md={showPreview ? 6 : 12}>
          <Stack spacing={3}>
            {/* Hero Section */}
            <Card>
              <CardHeader>
                <Typography variant="h6">Hero Section</Typography>
              </CardHeader>
              <CardContent>
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={config.title || ""}
                    onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={intl.formatMessage({ id: 'welcome-to-our-fitness-community' })}
                  />

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Subtitle"
                    value={config.subtitle || ""}
                    onChange={(e) => setConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder={intl.formatMessage({ id: 'transform-your-fitness-journey' })}
                  />

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Hero Image
                    </Typography>
                    <FileUpload
                      onUploadComplete={(imageUrl) => {
                        setConfig(prev => ({ ...prev, heroImage: imageUrl }));
                      }}
                      currentImageUrl={config.heroImage || ""}
                      workspaceId={workspaceId}
                      uploadType="landing"
                      maxSize={5}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Upload a hero image for your landing page (PNG, JPG, or SVG, max 5MB)
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="CTA Button Text"
                        value={config.ctaText || ""}
                        onChange={(e) => setConfig(prev => ({ ...prev, ctaText: e.target.value }))}
                        placeholder={intl.formatMessage({ id: 'get-started-today' })}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="CTA Button URL"
                        value={config.ctaUrl || ""}
                        onChange={(e) => setConfig(prev => ({ ...prev, ctaUrl: e.target.value }))}
                        placeholder="https://calendly.com/your-studio"
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            {/* Features Section */}
            <Card>
              <CardHeader>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Features</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={addFeature}
                  >
                    Add Feature
                  </Button>
                </Box>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  {config.features && config.features.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography color="text.secondary" sx={{ mb: 1 }}>No features yet</Typography>
                      <Button variant="outlined" startIcon={<Add size={16} />} onClick={addFeature}>Add your first feature</Button>
                    </Box>
                  )}
                  {config.features?.map((feature, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2">Feature {index + 1}</Typography>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeFeature(index)}
                            >
                              <Trash size={16} />
                            </IconButton>
                          </Box>
                          <TextField
                            fullWidth
                            label="Title"
                            value={feature.title}
                            onChange={(e) => updateFeature(index, 'title', e.target.value)}
                            placeholder="Feature title"
                          />
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Description"
                            value={feature.description}
                            onChange={(e) => updateFeature(index, 'description', e.target.value)}
                            placeholder="Feature description"
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* Testimonials Section */}
            <Card>
              <CardHeader>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">Testimonials</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add size={16} />}
                    onClick={addTestimonial}
                  >
                    Add Testimonial
                  </Button>
                </Box>
              </CardHeader>
              <CardContent>
                <Stack spacing={2}>
                  {config.testimonials && config.testimonials.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography color="text.secondary" sx={{ mb: 1 }}>No testimonials yet</Typography>
                      <Button variant="outlined" startIcon={<Add size={16} />} onClick={addTestimonial}>Add your first testimonial</Button>
                    </Box>
                  )}
                  {config.testimonials?.map((testimonial, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2">Testimonial {index + 1}</Typography>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeTestimonial(index)}
                            >
                              <Trash size={16} />
                            </IconButton>
                          </Box>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Quote"
                            value={testimonial.quote}
                            onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                            placeholder="Customer testimonial"
                          />
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                label="Author"
                                value={testimonial.author}
                                onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
                                placeholder="Customer name"
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                label="Role"
                                value={testimonial.role}
                                onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                                placeholder="Client, Member, etc."
                              />
                            </Grid>
                          </Grid>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Preview */}
        {showPreview && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader>
                <Typography variant="h6">Preview</Typography>
              </CardHeader>
              <CardContent>
                <Box sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, p: 2 }}>
                  {/* Hero Section Preview */}
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    {config.heroImage && (
                      <Box
                        component="img"
                        src={config.heroImage}
                        alt="Hero"
                        sx={{
                          width: '100%',
                          maxHeight: 200,
                          objectFit: 'cover',
                          borderRadius: 1,
                          mb: 2
                        }}
                      />
                    )}
                    <Typography variant="h4" gutterBottom>
                      {config.title || "Welcome to Our Fitness Community"}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" paragraph>
                      {config.subtitle || "Transform your fitness journey with personalized training and nutrition plans"}
                    </Typography>
                    {config.ctaText && (
                      <Button variant="contained" size="large">
                        {config.ctaText}
                      </Button>
                    )}
                  </Box>

                  {/* Features Preview */}
                  {config.features && config.features.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                      <Typography variant="h5" gutterBottom>
                        Features
                      </Typography>
                      <Grid container spacing={2}>
                        {config.features.map((feature, index) => (
                          <Grid item xs={12} sm={6} key={index}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="h6" gutterBottom>
                                  {feature.title || `Feature ${index + 1}`}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {feature.description || "Feature description"}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* Testimonials Preview */}
                  {config.testimonials && config.testimonials.length > 0 && (
                    <Box>
                      <Typography variant="h5" gutterBottom>
                        Testimonials
                      </Typography>
                      <Stack spacing={2}>
                        {config.testimonials.map((testimonial, index) => (
                          <Card key={index} variant="outlined">
                            <CardContent>
                              <Typography variant="body1" paragraph>
                                "{testimonial.quote || "Customer testimonial"}"
                              </Typography>
                              <Typography variant="subtitle2">
                                {testimonial.author || "Customer Name"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {testimonial.role || "Client"}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Stack>
  );
}
