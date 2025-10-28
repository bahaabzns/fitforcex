'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Stack,
  TextField,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
} from '@mui/material';
import { Add, Delete, ArrowForward, ArrowBack, CheckCircle } from '@mui/icons-material';
import FileUpload from './FileUpload';
import api from '@/utils/axios';

interface DefaultFormTemplate {
  id: string;
  type: string;
  title: string;
  titleArabic?: string;
  description?: string;
  questions: any[];
}

interface Package {
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  features?: any;
  isActive: boolean;
}

const steps = [
  'Workspace Details',
  'Forms Setup',
  'Client Packages',
  'Import Data',
  'Complete'
];

export default function OnboardingWizard({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Step 1: Workspace Details
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [landingConfig, setLandingConfig] = useState<any>({
    title: '',
    subtitle: '',
    heroImage: '',
    ctaText: '',
    ctaUrl: '',
    allowNewSubscriptions: true,
    features: [],
    testimonials: [],
  });

  // Step 2: Forms
  const [defaultTemplates, setDefaultTemplates] = useState<DefaultFormTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [customForms, setCustomForms] = useState<any[]>([]);
  const [showAddCustomForm, setShowAddCustomForm] = useState(false);
  const [editingFormIndex, setEditingFormIndex] = useState<number | null>(null);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormType, setNewFormType] = useState<'nutrition' | 'workout'>('nutrition');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [templateCustomizations, setTemplateCustomizations] = useState<Record<string, {
    selectedQuestionIds: string[];
    additionalQuestions: any[];
  }>>({});
  
  // Custom form question builder state
  const [newFormQuestions, setNewFormQuestions] = useState<any[]>([]);
  const [customQuestionType, setCustomQuestionType] = useState<string>('text');
  const [customQuestionLabel, setCustomQuestionLabel] = useState<string>('');
  const [customQuestionLabelArabic, setCustomQuestionLabelArabic] = useState<string>('');
  const [customQuestionRequired, setCustomQuestionRequired] = useState<boolean>(false);
  const [customQuestionOptions, setCustomQuestionOptions] = useState<string>('');
  const [customQuestionError, setCustomQuestionError] = useState<string>('');
  const [defaultQuestions, setDefaultQuestions] = useState<any[]>([]);

  // Step 3: Packages
  const [packages, setPackages] = useState<Package[]>([
    {
      name: '1 Month Package',
      description: 'Basic monthly subscription',
      durationMonths: 1,
      priceCents: 100000, // 1000 EGP
      currency: 'EGP',
      isActive: true,
    },
  ]);

  // Step 4: Import Data
  const [importAllFoodItems, setImportAllFoodItems] = useState(false);
  const [importAllExercises, setImportAllExercises] = useState(false);

  useEffect(() => {
    // Load default form templates
    const loadDefaultTemplates = async () => {
      try {
        const { data } = await api.get('/api/workspaces/onboarding/default-templates');
        setDefaultTemplates(data.templates || []);
      } catch (err) {
        console.error('Error loading default templates:', err);
      }
    };
    loadDefaultTemplates();
    // Load default questions for quick add
    const loadDefaultQuestions = async () => {
      try {
        const { data } = await api.get('/api/forms/default-questions');
        const qs = Array.isArray(data?.questions) ? data.questions : [];
        setDefaultQuestions(qs.map((q: any, idx: number) => ({
          id: q.id || `dq_${idx}`,
          type: q.type || 'text',
          question: q.question || q.label || q.title || `Question ${idx + 1}`,
          questionArabic: q.questionArabic,
          required: !!q.required,
          options: q.options,
          optionsArabic: q.optionsArabic,
        })));
      } catch (err) {
        // non-blocking
      }
    };
    loadDefaultQuestions();
  }, []);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = async () => {
    try {
      setCompleting(true);
      await api.post('/api/workspaces/onboarding/skip');
      router.push('/dashboard/overview');
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to skip onboarding');
    } finally {
      setCompleting(false);
    }
  };

  const handleComplete = async () => {
    try {
      setCompleting(true);
      setError(null);

      // Prepare customized forms from templates
      const customizedTemplates = selectedTemplateIds.map(templateId => {
        const template = defaultTemplates.find(t => t.id === templateId);
        const customization = templateCustomizations[templateId];
        
        if (!template) return null;

        // Get selected questions
        const selectedQuestions = template.questions.filter((q: any) => 
          customization?.selectedQuestionIds.includes(q.id)
        );

        // Add additional questions
        const allQuestions = [
          ...selectedQuestions,
          ...(customization?.additionalQuestions || [])
        ];

        return {
          type: template.type,
          title: template.title,
          titleArabic: template.titleArabic || '',
          questions: allQuestions
        };
      }).filter(Boolean);

      const payload = {
        brandingLogoUrl: logoUrl || null,
        brandingPrimaryHex: primaryColor || null,
        landingConfig: landingConfig.title || landingConfig.subtitle ? landingConfig : null,
        formTemplateIds: [], // Don't use raw template IDs
        customForms: [...customizedTemplates, ...customForms], // Combine customized templates and custom forms
        packages,
        importAllFoodItems,
        importAllExercises,
      };

      await api.post('/api/workspaces/onboarding/complete', payload);

      // Redirect to overview
      router.push('/dashboard/overview');
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to complete onboarding');
      setCompleting(false);
    }
  };

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) => {
      const isCurrentlySelected = prev.includes(templateId);
      
      if (isCurrentlySelected) {
        // Unselecting - remove customizations
        const newCustomizations = { ...templateCustomizations };
        delete newCustomizations[templateId];
        setTemplateCustomizations(newCustomizations);
        return prev.filter((id) => id !== templateId);
      } else {
        // Selecting - initialize with all questions selected
        const template = defaultTemplates.find(t => t.id === templateId);
        if (template) {
          const allQuestionIds = template.questions.map((q: any) => q.id);
          setTemplateCustomizations({
            ...templateCustomizations,
            [templateId]: {
              selectedQuestionIds: allQuestionIds,
              additionalQuestions: []
            }
          });
        }
        return [...prev, templateId];
      }
    });
  };

  const toggleQuestionSelection = (templateId: string, questionId: string) => {
    setTemplateCustomizations(prev => {
      const current = prev[templateId] || { selectedQuestionIds: [], additionalQuestions: [] };
      const isSelected = current.selectedQuestionIds.includes(questionId);
      
      return {
        ...prev,
        [templateId]: {
          ...current,
          selectedQuestionIds: isSelected
            ? current.selectedQuestionIds.filter(id => id !== questionId)
            : [...current.selectedQuestionIds, questionId]
        }
      };
    });
  };

  const addQuestionToTemplate = (templateId: string) => {
    setTemplateCustomizations(prev => {
      const current = prev[templateId] || { selectedQuestionIds: [], additionalQuestions: [] };
      const newQuestion = {
        id: `custom_${Date.now()}`,
        type: 'text',
        question: '',
        questionArabic: '',
        required: false,
      };
      
      return {
        ...prev,
        [templateId]: {
          ...current,
          additionalQuestions: [...current.additionalQuestions, newQuestion]
        }
      };
    });
  };

  const updateAdditionalQuestion = (templateId: string, questionIndex: number, field: string, value: any) => {
    setTemplateCustomizations(prev => {
      const current = prev[templateId] || { selectedQuestionIds: [], additionalQuestions: [] };
      const updatedQuestions = [...current.additionalQuestions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        [field]: value
      };
      
      return {
        ...prev,
        [templateId]: {
          ...current,
          additionalQuestions: updatedQuestions
        }
      };
    });
  };

  const removeAdditionalQuestion = (templateId: string, questionIndex: number) => {
    setTemplateCustomizations(prev => {
      const current = prev[templateId] || { selectedQuestionIds: [], additionalQuestions: [] };
      
      return {
        ...prev,
        [templateId]: {
          ...current,
          additionalQuestions: current.additionalQuestions.filter((_, i) => i !== questionIndex)
        }
      };
    });
  };

  const addFeature = () => {
    setLandingConfig((prev: any) => ({
      ...prev,
      features: [...(prev.features || []), { title: '', description: '' }]
    }));
  };

  const removeFeature = (index: number) => {
    setLandingConfig((prev: any) => ({
      ...prev,
      features: prev.features.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateFeature = (index: number, field: string, value: string) => {
    setLandingConfig((prev: any) => ({
      ...prev,
      features: prev.features.map((f: any, i: number) => 
        i === index ? { ...f, [field]: value } : f
      )
    }));
  };

  const addTestimonial = () => {
    setLandingConfig((prev: any) => ({
      ...prev,
      testimonials: [...(prev.testimonials || []), { quote: '', author: '', role: '' }]
    }));
  };

  const removeTestimonial = (index: number) => {
    setLandingConfig((prev: any) => ({
      ...prev,
      testimonials: prev.testimonials.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateTestimonial = (index: number, field: string, value: string) => {
    setLandingConfig((prev: any) => ({
      ...prev,
      testimonials: prev.testimonials.map((t: any, i: number) => 
        i === index ? { ...t, [field]: value } : t
      )
    }));
  };

  const addCustomQuestion = () => {
    if (!customQuestionLabel.trim()) {
      setCustomQuestionError('Please enter a question label');
      return;
    }

    const newQuestion = {
      id: `custom_${Date.now()}`,
      type: customQuestionType,
      question: customQuestionLabel,
      questionArabic: customQuestionLabelArabic || '',
      required: customQuestionRequired,
      options: ['select', 'checkbox', 'radio'].includes(customQuestionType) 
        ? customQuestionOptions.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      optionsArabic: ['select', 'checkbox', 'radio'].includes(customQuestionType) 
        ? customQuestionOptions.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
    };

    setNewFormQuestions([...newFormQuestions, newQuestion]);
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions('');
    setCustomQuestionError('');
  };

  const removeCustomQuestion = (index: number) => {
    setNewFormQuestions(newFormQuestions.filter((_, i) => i !== index));
  };

  const addCustomForm = () => {
    if (!newFormTitle.trim()) {
      setError('Please enter a form title');
      return;
    }
    
    if (newFormQuestions.length === 0) {
      setError('Please add at least one question to the form');
      return;
    }
    
    if (editingFormIndex !== null) {
      const updated = [...customForms];
      updated[editingFormIndex] = {
        ...updated[editingFormIndex],
        type: newFormType,
        title: newFormTitle,
        titleArabic: updated[editingFormIndex]?.titleArabic || '',
        questions: newFormQuestions,
      };
      setCustomForms(updated);
    } else {
      setCustomForms([
        ...customForms,
        {
          type: newFormType,
          title: newFormTitle,
          titleArabic: '',
          questions: newFormQuestions,
        },
      ]);
    }
    setNewFormTitle('');
    setNewFormQuestions([]);
    setShowAddCustomForm(false);
    setEditingFormIndex(null);
  };

  const handleCloseCustomFormDialog = () => {
    setShowAddCustomForm(false);
    setEditingFormIndex(null);
    setNewFormTitle('');
    setNewFormQuestions([]);
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions('');
    setCustomQuestionError('');
  };

  const removeCustomForm = (index: number) => {
    setCustomForms(customForms.filter((_: any, i: number) => i !== index));
  };

  const openEditCustomForm = (index: number) => {
    const form = customForms[index];
    setEditingFormIndex(index);
    setNewFormTitle(form.title || '');
    setNewFormType((form.type === 'workout' ? 'workout' : 'nutrition'));
    setNewFormQuestions(Array.isArray(form.questions) ? form.questions : []);
    setShowAddCustomForm(true);
  };

  const addPackage = () => {
    setPackages([
      ...packages,
      {
        name: '',
        description: '',
        durationMonths: 1,
        priceCents: 100000,
        currency: 'EGP',
        isActive: true,
      },
    ]);
  };

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  const updatePackage = (index: number, field: string, value: any) => {
    const updated = [...packages];
    updated[index] = { ...updated[index], [field]: value };
    setPackages(updated);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Customize Your Workspace</Typography>
            <Typography variant="body2" color="text.secondary">
              Add branding and prepare your landing page to make your workspace unique.
            </Typography>

            <Card>
              <CardHeader title="Branding" />
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Workspace Logo
                    </Typography>
                    <FileUpload
                      onUploadComplete={(url) => setLogoUrl(url)}
                      currentImageUrl={logoUrl}
                      workspaceId={workspaceId}
                      uploadType="branding"
                      accept="image/*"
                      maxSize={5}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="Primary Color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    helperText="Choose your workspace's primary brand color"
                  />

                  {/* Preview */}
                  {(logoUrl || primaryColor) && (
                    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Preview
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {logoUrl ? (
                          <Box
                            component="img"
                            src={logoUrl}
                            alt="Logo preview"
                            sx={{ width: 48, height: 48, borderRadius: 1 }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 1,
                              bgcolor: primaryColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography sx={{ color: 'white', fontSize: 24 }}>🏋️</Typography>
                          </Box>
                        )}
                        <Typography variant="h6">Your Workspace</Typography>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Landing Page" />
              <CardContent>
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Landing Page Title"
                    value={landingConfig.title || ''}
                    onChange={(e) => setLandingConfig((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Welcome to Our Fitness Community"
                  />
                  <TextField
                    fullWidth
                    label="Subtitle"
                    value={landingConfig.subtitle || ''}
                    onChange={(e) => setLandingConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                    multiline
                    rows={2}
                    placeholder="Transform your fitness journey with personalized training"
                  />
                  <TextField
                    fullWidth
                    label="Call-to-Action Button Text"
                    value={landingConfig.ctaText || ''}
                    onChange={(e) => setLandingConfig((prev) => ({ ...prev, ctaText: e.target.value }))}
                    placeholder="Get Started"
                  />
                  <TextField
                    fullWidth
                    label="Call-to-Action URL (Optional)"
                    value={landingConfig.ctaUrl || ''}
                    onChange={(e) => setLandingConfig((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                    placeholder="https://calendly.com/your-link"
                    helperText="Leave empty if you don't have a booking link yet"
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardHeader 
                title="Features" 
                action={
                  <Button size="small" startIcon={<Add />} onClick={addFeature}>
                    Add Feature
                  </Button>
                }
              />
              <CardContent>
                {landingConfig.features?.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No features added yet. Click "Add Feature" to add one.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {landingConfig.features?.map((feature: any, index: number) => (
                      <Card key={index} variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2">Feature {index + 1}</Typography>
                              <IconButton size="small" color="error" onClick={() => removeFeature(index)}>
                                <Delete />
                              </IconButton>
                            </Box>
                            <TextField
                              fullWidth
                              label="Title"
                              size="small"
                              value={feature.title}
                              onChange={(e) => updateFeature(index, 'title', e.target.value)}
                              placeholder="Personal Training"
                            />
                            <TextField
                              fullWidth
                              label="Description"
                              size="small"
                              multiline
                              rows={2}
                              value={feature.description}
                              onChange={(e) => updateFeature(index, 'description', e.target.value)}
                              placeholder="One-on-one sessions with certified trainers"
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader 
                title="Testimonials" 
                action={
                  <Button size="small" startIcon={<Add />} onClick={addTestimonial}>
                    Add Testimonial
                  </Button>
                }
              />
              <CardContent>
                {landingConfig.testimonials?.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No testimonials added yet. Click "Add Testimonial" to add one.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {landingConfig.testimonials?.map((testimonial: any, index: number) => (
                      <Card key={index} variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle2">Testimonial {index + 1}</Typography>
                              <IconButton size="small" color="error" onClick={() => removeTestimonial(index)}>
                                <Delete />
                              </IconButton>
                            </Box>
                            <TextField
                              fullWidth
                              label="Quote"
                              size="small"
                              multiline
                              rows={2}
                              value={testimonial.quote}
                              onChange={(e) => updateTestimonial(index, 'quote', e.target.value)}
                              placeholder="Amazing results in just 3 months!"
                            />
                            <Grid container spacing={2}>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  label="Author"
                                  size="small"
                                  value={testimonial.author}
                                  onChange={(e) => updateTestimonial(index, 'author', e.target.value)}
                                  placeholder="John Doe"
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  label="Role"
                                  size="small"
                                  value={testimonial.role}
                                  onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                                  placeholder="Client"
                                />
                              </Grid>
                            </Grid>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Setup Forms</Typography>
            <Typography variant="body2" color="text.secondary">
              Import form templates, customize questions, or create custom forms for your clients.
            </Typography>

            <Card>
              <CardHeader title="Default Form Templates" subheader="Select and customize templates" />
              <CardContent>
                {defaultTemplates.length === 0 ? (
                  <Alert severity="info">No default templates available</Alert>
                ) : (
                  <Stack spacing={2}>
                    {defaultTemplates.map((template) => {
                      const isSelected = selectedTemplateIds.includes(template.id);
                      const isExpanded = expandedTemplateId === template.id;
                      const customization = templateCustomizations[template.id];

                      return (
                        <Card key={template.id} variant="outlined">
                          <CardContent>
                            <Stack spacing={2}>
                              {/* Template Header */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => toggleTemplateSelection(template.id)}
                                />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    {template.title}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {template.description || `${template.type} form`}
                                  </Typography>
                                  <Chip
                                    label={template.type}
                                    size="small"
                                    color={template.type === 'nutrition' ? 'success' : 'primary'}
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                                {isSelected && (
                                  <Button
                                    size="small"
                                    onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                                  >
                                    {isExpanded ? 'Hide Questions' : 'Customize Questions'}
                                  </Button>
                                )}
                              </Box>

                              {/* Expanded Questions View */}
                              {isSelected && isExpanded && (
                                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                                  <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Typography variant="subtitle2" color="text.secondary">
                                        Questions ({customization?.selectedQuestionIds?.length || 0} selected)
                                      </Typography>
                                      <Button
                                        size="small"
                                        startIcon={<Add />}
                                        onClick={() => addQuestionToTemplate(template.id)}
                                      >
                                        Add Question
                                      </Button>
                                    </Box>

                                    {/* Original Template Questions */}
                                    {template.questions.map((question: any) => (
                                      <Box
                                        key={question.id}
                                        sx={{
                                          p: 1,
                                          border: 1,
                                          borderColor: 'divider',
                                          borderRadius: 1,
                                          bgcolor: customization?.selectedQuestionIds?.includes(question.id) 
                                            ? 'action.selected' 
                                            : 'background.paper'
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Checkbox
                                            size="small"
                                            checked={customization?.selectedQuestionIds?.includes(question.id) || false}
                                            onChange={() => toggleQuestionSelection(template.id, question.id)}
                                          />
                                          <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2">
                                              {question.question || question.name || 'Unnamed Question'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              Type: {question.type} {question.required && '• Required'}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      </Box>
                                    ))}

                                    {/* Additional Custom Questions */}
                                    {customization?.additionalQuestions?.map((question: any, idx: number) => (
                                      <Card key={question.id} variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                                        <CardContent>
                                          <Stack spacing={2}>
                                            <Chip label="Custom Question" size="small" color="secondary" sx={{ alignSelf: 'flex-start' }} />
                                            {/* Row 1: Type + Required */}
                                            <Grid container spacing={2} alignItems="center">
                                              <Grid item xs={12} sm={8} md={6}>
                                                <FormControl fullWidth size="small">
                                                  <InputLabel>Type</InputLabel>
                                                  <Select
                                                    value={question.type}
                                                    label="Type"
                                                    onChange={(e) => updateAdditionalQuestion(template.id, idx, 'type', e.target.value)}
                                                  >
                                                    <MenuItem value="text">Text</MenuItem>
                                                    <MenuItem value="textarea">Text Area</MenuItem>
                                                    <MenuItem value="number">Number</MenuItem>
                                                    <MenuItem value="select">Select</MenuItem>
                                                    <MenuItem value="checkbox">Checkbox</MenuItem>
                                                    <MenuItem value="radio">Radio</MenuItem>
                                                    <MenuItem value="attachment">Attachment</MenuItem>
                                                  </Select>
                                                </FormControl>
                                              </Grid>
                                              <Grid item xs={12} sm={4} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                                                <FormControlLabel
                                                  control={
                                                    <Checkbox
                                                      size="small"
                                                      checked={question.required}
                                                      onChange={(e) => updateAdditionalQuestion(template.id, idx, 'required', e.target.checked)}
                                                    />
                                                  }
                                                  label="Required"
                                                />
                                              </Grid>
                                            </Grid>

                                            {/* Row 2: Labels */}
                                            <Grid container spacing={2}>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  size="small"
                                                  fullWidth
                                                  label="Label"
                                                  value={question.question}
                                                  onChange={(e) => updateAdditionalQuestion(template.id, idx, 'question', e.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  size="small"
                                                  fullWidth
                                                  label="Label (Arabic)"
                                                  value={question.questionArabic || ''}
                                                  onChange={(e) => updateAdditionalQuestion(template.id, idx, 'questionArabic', e.target.value)}
                                                />
                                              </Grid>
                                            </Grid>

                                            {/* Row 3: Options (if needed) + Delete */}
                                            <Grid container spacing={2} alignItems="center">
                                              {['select','checkbox','radio'].includes(question.type) ? (
                                                <Grid item xs={12} sm={9}>
                                                  <TextField
                                                    size="small"
                                                    fullWidth
                                                    label="Options (comma separated)"
                                                    value={(question.options || []).join(', ')}
                                                    onChange={(e) => updateAdditionalQuestion(template.id, idx, 'options', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                                                  />
                                                </Grid>
                                              ) : (
                                                <Grid item xs={12} sm={9} />
                                              )}
                                              <Grid item xs={12} sm={3} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  onClick={() => removeAdditionalQuestion(template.id, idx)}
                                                >
                                                  <Delete />
                                                </IconButton>
                                              </Grid>
                                            </Grid>
                                          </Stack>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader 
                title="Custom Forms" 
                subheader="Create your own forms"
                action={
                  <Button size="small" startIcon={<Add />} onClick={() => setShowAddCustomForm(true)}>
                    Create Form
                  </Button>
                }
              />
              <CardContent>
                {customForms.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No custom forms created yet. Click "Create Form" to add one.
                  </Typography>
                ) : (
                  <List>
                    {customForms.map((form, index) => (
                      <ListItem
                        key={index}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      >
                        <ListItemText
                          primary={form.title}
                          secondary={
                            <Chip
                              label={form.type}
                              size="small"
                              color={form.type === 'nutrition' ? 'success' : 'primary'}
                            />
                          }
                        />
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => openEditCustomForm(index)}>Edit</Button>
                          <IconButton edge="end" onClick={() => removeCustomForm(index)} color="error">
                            <Delete />
                          </IconButton>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Alert severity="info">
              Selected {selectedTemplateIds.length} default template(s) and {customForms.length} custom form(s).
            </Alert>

            {/* Add Custom Form Dialog */}
            <Dialog open={showAddCustomForm} onClose={handleCloseCustomFormDialog} maxWidth="md" fullWidth>
              <DialogTitle>Create Custom Form</DialogTitle>
              <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    label="Form Title"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="Initial Assessment"
                  />
                  <FormControl fullWidth>
                    <InputLabel>Form Type</InputLabel>
                    <Select
                      value={newFormType}
                      label="Form Type"
                      onChange={(e) => setNewFormType(e.target.value as 'nutrition' | 'workout')}
                    >
                      <MenuItem value="nutrition">Nutrition</MenuItem>
                      <MenuItem value="workout">Workout</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Questions List */}
                  {newFormQuestions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Questions ({newFormQuestions.length})
                      </Typography>
                      <Stack spacing={1}>
                        {newFormQuestions.map((question, index) => (
                          <Box key={question.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Grid container spacing={1}>
                              <Grid item xs={12} sm={6}>
                                <Typography variant="body2" fontWeight="medium">
                                  {question.question}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Type: {question.type} {question.required ? '(Required)' : '(Optional)'}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <IconButton size="small" color="error" onClick={() => removeCustomQuestion(index)}>
                                  <Delete />
                                </IconButton>
                              </Grid>
                            </Grid>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Question Builder */}
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      Add Question
                    </Typography>
                    {defaultQuestions.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Quick add from default questions
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {defaultQuestions.map((q: any) => (
                            <Chip
                              key={q.id}
                              label={q.question}
                              onClick={() => {
                                if (newFormQuestions.some((x) => x.originalId === q.id)) return;
                                setNewFormQuestions((prev) => [
                                  ...prev,
                                  {
                                    id: `dq_${q.id}_${Date.now()}`,
                                    originalId: q.id,
                                    type: q.type,
                                    question: q.question,
                                    questionArabic: q.questionArabic,
                                    required: !!q.required,
                                    options: q.options,
                                    optionsArabic: q.optionsArabic,
                                  },
                                ]);
                              }}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth>
                          <InputLabel>Type</InputLabel>
                          <Select
                            value={customQuestionType}
                            label="Type"
                            onChange={(e) => setCustomQuestionType(e.target.value)}
                          >
                            <MenuItem value="text">Text</MenuItem>
                            <MenuItem value="textarea">Textarea</MenuItem>
                            <MenuItem value="number">Number</MenuItem>
                            <MenuItem value="select">Select</MenuItem>
                            <MenuItem value="checkbox">Checkbox</MenuItem>
                            <MenuItem value="radio">Radio</MenuItem>
                            <MenuItem value="attachment">Attachment</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth
                          label="Question Label"
                          value={customQuestionLabel}
                          onChange={(e) => setCustomQuestionLabel(e.target.value)}
                          placeholder="What is your age?"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Question Label (Arabic)"
                          value={customQuestionLabelArabic}
                          onChange={(e) => setCustomQuestionLabelArabic(e.target.value)}
                          placeholder="ما عمرك؟"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={customQuestionRequired}
                              onChange={(e) => setCustomQuestionRequired(e.target.checked)}
                            />
                          }
                          label="Required"
                        />
                      </Grid>
                      <Grid item xs={12} sm={9}>
                        <TextField
                          fullWidth
                          label="Options (comma separated)"
                          value={customQuestionOptions}
                          onChange={(e) => setCustomQuestionOptions(e.target.value)}
                          disabled={!['select', 'checkbox', 'radio'].includes(customQuestionType)}
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </Grid>
                    </Grid>
                    {customQuestionError && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {customQuestionError}
                      </Alert>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={addCustomQuestion}
                        disabled={!customQuestionLabel.trim()}
                      >
                        Add Question
                      </Button>
                    </Box>
                  </Box>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseCustomFormDialog}>Cancel</Button>
                <Button 
                  onClick={addCustomForm} 
                  variant="contained"
                  disabled={!newFormTitle.trim() || newFormQuestions.length === 0}
                >
                  Create Form
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Create Client Packages</Typography>
            <Typography variant="body2" color="text.secondary">
              Define subscription packages for your clients.
            </Typography>

            {packages.map((pkg, index) => (
              <Card key={index}>
                <CardHeader
                  title={`Package ${index + 1}`}
                  action={
                    packages.length > 1 && (
                      <IconButton onClick={() => removePackage(index)} color="error">
                        <Delete />
                      </IconButton>
                    )
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Package Name"
                        value={pkg.name}
                        onChange={(e) => updatePackage(index, 'name', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Duration (Months)"
                        type="number"
                        value={pkg.durationMonths}
                        onChange={(e) => updatePackage(index, 'durationMonths', parseInt(e.target.value))}
                        inputProps={{ min: 1 }}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Description"
                        value={pkg.description}
                        onChange={(e) => updatePackage(index, 'description', e.target.value)}
                        multiline
                        rows={2}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Price (EGP)"
                        type="number"
                        value={pkg.priceCents / 100}
                        onChange={(e) => updatePackage(index, 'priceCents', parseFloat(e.target.value) * 100)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">EGP</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={pkg.isActive}
                            onChange={(e) => updatePackage(index, 'isActive', e.target.checked)}
                          />
                        }
                        label="Active"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addPackage}
              fullWidth
            >
              Add Another Package
            </Button>
          </Stack>
        );

      case 3:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Import Default Data</Typography>
            <Typography variant="body2" color="text.secondary">
              Import default food items and exercises to quickly start creating plans.
            </Typography>

            <Card>
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={importAllFoodItems}
                          onChange={(e) => setImportAllFoodItems(e.target.checked)}
                        />
                      }
                      label="Import All Default Food Items"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Import a comprehensive database of food items with nutritional information (calories, protein, carbs, fat).
                      This will help you create nutrition plans faster.
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={importAllExercises}
                          onChange={(e) => setImportAllExercises(e.target.checked)}
                        />
                      }
                      label="Import All Default Exercises"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Import a complete exercise library with muscle groups, equipment needed, and instructions.
                      This will help you create workout plans faster.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Alert severity="info">
              {importAllFoodItems && importAllExercises && 'Both food items and exercises will be imported.'}
              {importAllFoodItems && !importAllExercises && 'Only food items will be imported.'}
              {!importAllFoodItems && importAllExercises && 'Only exercises will be imported.'}
              {!importAllFoodItems && !importAllExercises && 'Nothing will be imported. You can add items manually later.'}
            </Alert>
          </Stack>
        );

      case 4:
        return (
          <Stack spacing={3} alignItems="center" textAlign="center">
            <CheckCircle sx={{ fontSize: 80, color: 'success.main' }} />
            <Typography variant="h5">You're All Set!</Typography>
            <Typography variant="body1" color="text.secondary">
              Your workspace is ready. Click "Complete" to start using FitForce.
            </Typography>

            <Card sx={{ width: '100%', textAlign: 'left' }}>
              <CardHeader title="Summary" />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Branding
                    </Typography>
                    <Typography variant="body2">
                      {logoUrl ? '✓ Logo uploaded' : '- No logo'}
                    </Typography>
                    <Typography variant="body2">
                      {primaryColor ? `✓ Primary color: ${primaryColor}` : '- No color'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Landing Page
                    </Typography>
                    <Typography variant="body2">
                      {landingConfig.title ? `✓ Title: ${landingConfig.title}` : '- No title'}
                    </Typography>
                    <Typography variant="body2">
                      {landingConfig.features?.length > 0 
                        ? `✓ ${landingConfig.features.length} feature(s)` 
                        : '- No features'}
                    </Typography>
                    <Typography variant="body2">
                      {landingConfig.testimonials?.length > 0 
                        ? `✓ ${landingConfig.testimonials.length} testimonial(s)` 
                        : '- No testimonials'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Form Templates
                    </Typography>
                    <Typography variant="body2">
                      {selectedTemplateIds.length > 0
                        ? `✓ ${selectedTemplateIds.length} default template(s) selected`
                        : '- No default templates selected'}
                    </Typography>
                    <Typography variant="body2">
                      {customForms.length > 0
                        ? `✓ ${customForms.length} custom form(s) created`
                        : '- No custom forms'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Client Packages
                    </Typography>
                    <Typography variant="body2">
                      ✓ {packages.length} package(s) created
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Default Data Import
                    </Typography>
                    <Typography variant="body2">
                      {importAllFoodItems ? '✓ Food items will be imported' : '- No food items'}
                    </Typography>
                    <Typography variant="body2">
                      {importAllExercises ? '✓ Exercises will be imported' : '- No exercises'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto', py: 4 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Welcome to FitForce! 👋
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Let's set up your workspace in a few simple steps.
              </Typography>
            </Box>

            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box sx={{ minHeight: 400 }}>
              {renderStepContent(activeStep)}
            </Box>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button
                onClick={handleSkip}
                disabled={completing}
                variant="text"
              >
                Skip Onboarding
              </Button>

              <Stack direction="row" spacing={2}>
                <Button
                  disabled={activeStep === 0 || completing}
                  onClick={handleBack}
                  startIcon={<ArrowBack />}
                >
                  Back
                </Button>

                {activeStep === steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleComplete}
                    disabled={completing}
                    endIcon={completing ? <CircularProgress size={20} /> : <CheckCircle />}
                  >
                    {completing ? 'Completing...' : 'Complete Onboarding'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    endIcon={<ArrowForward />}
                  >
                    Next
                  </Button>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
