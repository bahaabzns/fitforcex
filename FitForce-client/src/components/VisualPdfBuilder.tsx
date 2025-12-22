'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Grid,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Radio,
  RadioGroup,
  FormLabel,
} from '@mui/material';
import { CloudUpload, Delete, Preview, Settings, Description, ViewDay, ExitToApp, CheckCircle, RadioButtonUnchecked, Palette, Image, TableChart, FormatSize, HelpOutline, ExpandMore, ExpandLess, Add, Edit, DragIndicator, QuestionAnswer, Gavel, Article, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import api from '@/utils/axios';
import { previewVisualPdfTemplate, createVisualPdfTemplate, deleteVisualPdfTemplate } from '@/api/visual-pdf-templates';
import { listPageTemplates, createPageTemplate, WorkspacePageTemplate } from '@/api/page-templates';

export interface CustomPageConfig {
  id: string;
  type: 'qa' | 'disclaimer' | 'custom' | 'terms';
  title?: string;
  enabled: boolean;
  position: 'beforeContent' | 'afterContent' | 'atEnd' | 'afterEnd'; // Where in document
  order: number; // Order within the same position group
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  fontSize?: number;
  config: QAPageConfig | DisclaimerPageConfig | CustomContentPageConfig;
}

export interface QAPageConfig {
  sections: QASection[];
  layout: 'list' | 'accordion' | 'table';
  showNumbers?: boolean;
  widgetStyle?: {
    enabled?: boolean;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    backgroundColor?: string;
    padding?: number;
    margin?: number;
  };
}

export interface QASection {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface DisclaimerPageConfig {
  content: string; // HTML or markdown
  showDate?: boolean;
  showSignature?: boolean;
  signatureLabel?: string;
  widgetStyle?: {
    enabled?: boolean;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    backgroundColor?: string;
    padding?: number;
    margin?: number;
  };
}

export interface CustomContentPageConfig {
  content: string; // HTML content
  allowImages: boolean;
  allowLinks: boolean;
}

interface VisualPdfConfig {
  introPage?: {
    enabled: boolean;
    showPlanTitle?: boolean;
    showWorkspaceName?: boolean;
    showClientName?: boolean;
    backgroundImage?: string;
    backgroundColor?: string;
    titleColor?: string;
    titleSize?: number;
  };
  endPage?: {
    enabled: boolean;
    showThankYouMessage?: boolean;
    showContactInfo?: boolean;
    backgroundImage?: string;
    backgroundColor?: string;
    textColor?: string;
    customMessage?: string;
  };
  customPages?: CustomPageConfig[]; // NEW: Custom pages array
  dayPages: {
    layout: 'vertical' | 'horizontal';
    daysPerPage: number;
    backgroundImage?: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: {
      exerciseName?: number;
      details?: number;
      dayTitle?: number;
    };
    table?: {
      headerBackground?: string;
      headerTextColor?: string;
      borderColor?: string;
      stripeColor?: string;
    };
    options: {
      // Workout plan options
      showGifImage?: boolean;
      gifHeight?: number;
      showExerciseName?: boolean;
      showExerciseDescription?: boolean;
      showSetRest?: boolean;
      showSetTempo?: boolean;
      showSetRir?: boolean;
      // Nutrition plan options
      showMealNames?: boolean;
      showMealTimes?: boolean;
      showFoodItems?: boolean;
      showQuantities?: boolean;
      showMacros?: boolean;
      showCalories?: boolean;
      showProtein?: boolean;
      showCarbs?: boolean;
      showFat?: boolean;
      showMealTotalCalories?: boolean;
      showDayTotalCalories?: boolean;
      showMealNotes?: boolean;
    };
  };
  options: {
    pageSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    fontFamily?: string;
    primaryColor?: string;
    secondaryColor?: string;
    textDirection?: 'ltr' | 'rtl';
    textAlignment?: 'left' | 'center' | 'right' | 'justify';
    logo?: {
      enabled: boolean;
      url?: string;
      position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
      size?: 'small' | 'medium' | 'large' | 'custom';
      customWidth?: number;
      customHeight?: number;
      opacity?: number;
      margin?: number;
    };
    watermark?: {
      enabled: boolean;
      text?: string;
      opacity?: number;
      fontSize?: number;
      color?: string;
      angle?: number;
      position?: 'center' | 'diagonal';
    };
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    pageNumbering?: {
      enabled: boolean;
      position: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right';
      format?: string;
      startFrom?: number;
      excludeFirstPage?: boolean;
    };
  };
}

interface VisualPdfBuilderProps {
  kind: 'workout' | 'nutrition';
  initialConfig?: VisualPdfConfig;
  initialName?: string;
  initialIsGlobal?: boolean;
  initialWorkspaceIds?: string[];
  templateId?: string; // For preview functionality
  onSave: (config: VisualPdfConfig, name: string, isGlobal: boolean, workspaceIds: string[]) => void;
  onCancel: () => void;
  workspaces?: Array<{ id: string; name: string }>;
}

export default function VisualPdfBuilder({ 
  kind, 
  initialConfig,
  initialName = '',
  initialIsGlobal = true,
  initialWorkspaceIds = [],
  templateId,
  onSave, 
  onCancel,
  workspaces = []
}: VisualPdfBuilderProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [templateName, setTemplateName] = useState(initialName);
  const [isGlobal, setIsGlobal] = useState(initialIsGlobal);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>(initialWorkspaceIds);
  const [introImageUrl, setIntroImageUrl] = useState(initialConfig?.introPage?.backgroundImage || '');
  const [endImageUrl, setEndImageUrl] = useState(initialConfig?.endPage?.backgroundImage || '');
  const [dayImageUrl, setDayImageUrl] = useState(initialConfig?.dayPages?.backgroundImage || '');
  const [uploadingImage, setUploadingImage] = useState<'intro' | 'end' | 'day' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActiveBg, setDragActiveBg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [autoPreviewEnabled, setAutoPreviewEnabled] = useState(true);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dragActive, setDragActive] = useState<'intro' | 'end' | 'day' | null>(null);
  const [editingCustomPage, setEditingCustomPage] = useState<CustomPageConfig | null>(null);
  const [showCustomPageDialog, setShowCustomPageDialog] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );
  
  const [config, setConfig] = useState<VisualPdfConfig>(
    initialConfig || {
      introPage: {
        enabled: true,
        showPlanTitle: true,
        showWorkspaceName: true,
        showClientName: true,
        backgroundColor: '#ffffff',
        titleColor: '#000000',
        titleSize: 32,
      },
      endPage: {
        enabled: true,
        showThankYouMessage: true,
        showContactInfo: true,
        backgroundColor: '#ffffff',
        textColor: '#000000',
        customMessage: 'Thank you for choosing us!',
      },
      customPages: [], // Initialize empty custom pages array
      dayPages: {
        layout: 'vertical',
        daysPerPage: 1,
        backgroundColor: '#ffffff',
        textColor: '#000000',
        table: {
          headerBackground: '#f5f7ff',
          headerTextColor: '#1a1a1a',
          borderColor: '#d4daec',
          stripeColor: '#f0f4ff',
        },
        fontSize: {
          dayTitle: 18,
          exerciseName: 12,
          details: 10,
        },
        options: {
          // Workout defaults
          showGifImage: true,
          gifHeight: 140,
          showExerciseName: true,
          showExerciseDescription: true,
          showSetRest: true,
          showSetTempo: true,
          showSetRir: true,
          // Nutrition defaults
          showMealNames: true,
          showMealTimes: true,
          showFoodItems: true,
          showQuantities: true,
          showMacros: true,
          showCalories: true,
          showProtein: true,
          showCarbs: true,
          showFat: true,
          showMealTotalCalories: true,
          showDayTotalCalories: true,
          showMealNotes: true,
        },
      },
      options: {
        pageSize: 'A4',
        orientation: 'portrait',
        fontFamily: 'Alexandria',
        primaryColor: '#3366cc',
        secondaryColor: '#333333',
        textDirection: 'ltr',
        textAlignment: 'left',
        logo: {
          enabled: false,
          position: 'top-left',
          size: 'medium',
          opacity: 1,
          margin: 20,
        },
        watermark: {
          enabled: false,
          text: '',
          opacity: 0.1,
          fontSize: 48,
          color: '#000000',
          angle: -45,
          position: 'diagonal',
        },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
        pageNumbering: {
          enabled: false,
          position: 'bottom-center',
          format: 'Page {page} of {total}',
          startFrom: 1,
          excludeFirstPage: false,
        },
      },
    }
  );

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleDrag = (e: React.DragEvent, type: 'intro' | 'end' | 'day') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(type);
    } else if (e.type === 'dragleave') {
      setDragActive(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, type: 'intro' | 'end' | 'day') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await processImageUpload(file, type);
  };

  const processImageUpload = async (file: File, type: 'intro' | 'end' | 'day') => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    try {
      setUploadingImage(type);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post('/api/admin/upload-template-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const imageUrl = response.data.imageUrl;
      
      // Set the appropriate image URL
      if (type === 'intro') {
        setIntroImageUrl(imageUrl);
      } else if (type === 'end') {
        setEndImageUrl(imageUrl);
      } else {
        setDayImageUrl(imageUrl);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'intro' | 'end' | 'day'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processImageUpload(file, type);
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post('/api/admin/upload-template-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data?.imageUrl) {
        setConfig({
          ...config,
          options: {
            ...config.options,
            logo: {
              ...config.options.logo,
              enabled: config.options.logo?.enabled ?? true,
              url: response.data.imageUrl,
              position: config.options.logo?.position || 'top-left',
              size: config.options.logo?.size || 'medium',
              opacity: config.options.logo?.opacity ?? 1,
              margin: config.options.logo?.margin || 20,
            },
          },
        });
      }
    } catch (error: any) {
      console.error('Failed to upload logo:', error);
      alert(error.response?.data?.message || 'Failed to upload logo');
    }
  };

  const generatePreviewInternal = async (showError = true) => {
    if (!templateId) {
      if (showError) {
        alert('Please save the template first to generate a preview');
      }
      return;
    }

    try {
      setGeneratingPreview(true);
      
      // First update the template with current config
      const finalConfig = {
        ...config,
        introPage: config.introPage ? {
          ...config.introPage,
          backgroundImage: introImageUrl || undefined,
        } : config.introPage,
        endPage: config.endPage ? {
          ...config.endPage,
          backgroundImage: endImageUrl || undefined,
        } : config.endPage,
        dayPages: {
          ...config.dayPages,
          backgroundImage: dayImageUrl || undefined,
        },
      };

      // Update template with current config
      await api.put(`/api/admin/visual-pdf-templates/${templateId}`, {
        config: finalConfig,
      });

      // Generate preview
      const { previewUrl } = await previewVisualPdfTemplate(templateId);
      setPreviewUrl(previewUrl);
    } catch (error: any) {
      console.error('Failed to generate preview:', error);
      if (showError) {
        alert(error.response?.data?.message || 'Failed to generate preview. Please try again.');
      }
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleGeneratePreview = () => {
    generatePreviewInternal(true);
  };

  // Auto-preview on config change (debounced)
  useEffect(() => {
    // Only auto-preview if template is saved and auto-preview is enabled
    if (!templateId || !autoPreviewEnabled) {
      return;
    }

    // Clear existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Set new timeout for debounced preview
    previewTimeoutRef.current = setTimeout(() => {
      generatePreviewInternal(false); // Don't show errors for auto-preview
    }, 2000); // 2 second delay

    // Cleanup
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [config, introImageUrl, endImageUrl, dayImageUrl, templateId, autoPreviewEnabled]);

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (!isGlobal && selectedWorkspaceIds.length === 0) {
      alert('Please select at least one workspace or make the template global');
      return;
    }
    
    // Update config with image URLs
    const finalConfig = {
      ...config,
      introPage: config.introPage ? {
        ...config.introPage,
        backgroundImage: introImageUrl || undefined,
      } : config.introPage,
      endPage: config.endPage ? {
        ...config.endPage,
        backgroundImage: endImageUrl || undefined,
      } : config.endPage,
      dayPages: {
        ...config.dayPages,
        backgroundImage: dayImageUrl || undefined,
      },
    };
    
    onSave(finalConfig, templateName, isGlobal, selectedWorkspaceIds);
  };

  const steps = [
    'General Settings',
    'Intro Page',
    'Content Pages',
    'End Page',
    'Review & Save',
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Enhanced Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'white' }}>
              Visual PDF Template Builder
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              Create a custom PDF template for {kind === 'workout' ? 'workout' : 'nutrition'} plans
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip 
                label={`Step ${activeStep + 1} of ${steps.length}`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label={kind === 'workout' ? 'Workout Plan' : 'Nutrition Plan'}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Box>
          </Box>
          {templateId && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoPreviewEnabled}
                    onChange={(e) => setAutoPreviewEnabled(e.target.checked)}
                    size="small"
                    sx={{ color: 'white', '&.Mui-checked': { color: 'white' } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    Auto-preview
                  </Typography>
                }
              />
              <Button
                variant="contained"
                startIcon={generatingPreview ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Preview />}
                onClick={handleGeneratePreview}
                disabled={generatingPreview}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              >
                {generatingPreview ? 'Generating...' : 'Preview Now'}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Enhanced Preview Panel */}
      {previewUrl && (
        <Paper 
          elevation={3} 
          sx={{ 
            mb: 3, 
            overflow: 'hidden',
            border: '2px solid',
            borderColor: 'success.main',
            borderRadius: 2
          }}
        >
          <Box sx={{ 
            bgcolor: 'success.main', 
            color: 'white', 
            p: 1.5, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <CheckCircle fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Preview Generated Successfully
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={() => window.open(previewUrl, '_blank')}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              >
                Open Full Size
              </Button>
              <IconButton
                size="small"
                onClick={() => setPreviewUrl(null)}
                sx={{ color: 'white' }}
              >
                <Delete />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ 
            position: 'relative', 
            bgcolor: '#f5f5f5',
            minHeight: '600px',
            borderTop: '1px solid',
            borderColor: 'divider'
          }}>
            <iframe 
              src={previewUrl} 
              width="100%" 
              height="600px"
              style={{ border: 'none', display: 'block' }}
              title="PDF Preview"
            />
          </Box>
        </Paper>
      )}

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 1: General Settings */}
        <Step>
          <StepLabel>General Settings</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  sx={{ mb: 3 }}
                  required
                  helperText="Give your template a descriptive name"
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="This name will be displayed in the template list">
                        <HelpOutline fontSize="small" color="action" sx={{ cursor: 'help' }} />
                      </Tooltip>
                    )
                  }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Page Size</InputLabel>
                      <Select
                        value={config.options.pageSize}
                        label="Page Size"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              pageSize: e.target.value as 'A4' | 'Letter',
                            },
                          })
                        }
                      >
                        <MenuItem value="A4">A4 (210 × 297mm)</MenuItem>
                        <MenuItem value="Letter">Letter (8.5 × 11in)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Orientation</InputLabel>
                      <Select
                        value={config.options.orientation}
                        label="Orientation"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              orientation: e.target.value as 'portrait' | 'landscape',
                            },
                          })
                        }
                      >
                        <MenuItem value="portrait">Portrait</MenuItem>
                        <MenuItem value="landscape">Landscape</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Font Family</InputLabel>
                      <Select
                        value={config.options.fontFamily || 'Alexandria'}
                        label="Font Family"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              fontFamily: e.target.value,
                            },
                          })
                        }
                      >
                        <MenuItem value="Alexandria">Alexandria (Arabic Support)</MenuItem>
                        <MenuItem value="Helvetica">Helvetica</MenuItem>
                        <MenuItem value="Times-Roman">Times Roman</MenuItem>
                        <MenuItem value="Courier">Courier</MenuItem>
                      </Select>
                      <Tooltip title="Alexandria supports Arabic and RTL text. Other fonts are standard PDF fonts.">
                        <HelpOutline fontSize="small" color="action" sx={{ mt: 0.5, cursor: 'help' }} />
                      </Tooltip>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }}>
                      <Chip icon={<FormatSize />} label="Text Direction & Alignment" size="small" />
                    </Divider>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Text Direction</InputLabel>
                      <Select
                        value={config.options.textDirection || 'ltr'}
                        label="Text Direction"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              textDirection: e.target.value as 'ltr' | 'rtl',
                            },
                          })
                        }
                      >
                        <MenuItem value="ltr">Left-to-Right (LTR)</MenuItem>
                        <MenuItem value="rtl">Right-to-Left (RTL)</MenuItem>
                      </Select>
                      <Tooltip title="RTL is useful for Arabic, Hebrew, and other RTL languages">
                        <HelpOutline fontSize="small" color="action" sx={{ mt: 0.5, cursor: 'help' }} />
                      </Tooltip>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Default Text Alignment</InputLabel>
                      <Select
                        value={config.options.textAlignment || 'left'}
                        label="Default Text Alignment"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              textAlignment: e.target.value as 'left' | 'center' | 'right' | 'justify',
                            },
                          })
                        }
                      >
                        <MenuItem value="left">Left</MenuItem>
                        <MenuItem value="center">Center</MenuItem>
                        <MenuItem value="right">Right</MenuItem>
                        <MenuItem value="justify">Justify</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }}>
                      <Chip icon={<Image />} label="Logo Settings" size="small" />
                    </Divider>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.options.logo?.enabled || false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                logo: {
                                  ...config.options.logo,
                                  enabled: e.target.checked,
                                  position: config.options.logo?.position || 'top-left',
                                  size: config.options.logo?.size || 'medium',
                                  opacity: config.options.logo?.opacity ?? 1,
                                  margin: config.options.logo?.margin || 20,
                                },
                              },
                            })
                          }
                        />
                      }
                      label="Enable Logo on All Pages"
                      sx={{ mb: 2 }}
                    />

                    {config.options.logo?.enabled && (
                      <Box sx={{ pl: 4, pt: 1 }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                            Logo Image
                          </Typography>
                          <Paper
                            elevation={1}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragActiveBg(true);
                            }}
                            onDragLeave={() => setDragActiveBg(false)}
                            onDrop={async (e) => {
                              e.preventDefault();
                              setDragActiveBg(false);
                              const file = e.dataTransfer.files[0];
                              if (file && file.type.startsWith('image/')) {
                                await handleLogoUpload(file);
                              }
                            }}
                            sx={{
                              p: 2,
                              border: '2px dashed',
                              borderColor: dragActiveBg ? 'primary.main' : 'divider',
                              bgcolor: dragActiveBg ? 'action.hover' : 'background.paper',
                              borderRadius: 2,
                              textAlign: 'center',
                              cursor: 'pointer',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'action.hover',
                              },
                            }}
                            onClick={() => document.getElementById('logo-upload')?.click()}
                          >
                            <input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  await handleLogoUpload(file);
                                }
                              }}
                            />
                            {config.options.logo?.url ? (
                              <Box>
                                <img
                                  src={config.options.logo.url}
                                  alt="Logo preview"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: 150,
                                    borderRadius: 8,
                                    marginBottom: 8,
                                  }}
                                />
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<Delete />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfig({
                                      ...config,
                                      options: {
                                        ...config.options,
                                        logo: {
                                          ...config.options.logo!,
                                          url: undefined,
                                        },
                                      },
                                    });
                                  }}
                                >
                                  Remove Logo
                                </Button>
                              </Box>
                            ) : (
                              <Box>
                                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                  Drag and drop logo here, or click to upload
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                              <InputLabel>Position</InputLabel>
                              <Select
                                value={config.options.logo?.position || 'top-left'}
                                label="Position"
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    options: {
                                      ...config.options,
                                      logo: {
                                        ...config.options.logo!,
                                        position: e.target.value as any,
                                      },
                                    },
                                  })
                                }
                              >
                                <MenuItem value="top-left">Top Left</MenuItem>
                                <MenuItem value="top-center">Top Center</MenuItem>
                                <MenuItem value="top-right">Top Right</MenuItem>
                                <MenuItem value="bottom-left">Bottom Left</MenuItem>
                                <MenuItem value="bottom-center">Bottom Center</MenuItem>
                                <MenuItem value="bottom-right">Bottom Right</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                              <InputLabel>Size</InputLabel>
                              <Select
                                value={config.options.logo?.size || 'medium'}
                                label="Size"
                                onChange={(e) =>
                                  setConfig({
                                    ...config,
                                    options: {
                                      ...config.options,
                                      logo: {
                                        ...config.options.logo!,
                                        size: e.target.value as any,
                                      },
                                    },
                                  })
                                }
                              >
                                <MenuItem value="small">Small (50px)</MenuItem>
                                <MenuItem value="medium">Medium (100px)</MenuItem>
                                <MenuItem value="large">Large (150px)</MenuItem>
                                <MenuItem value="custom">Custom</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          {config.options.logo?.size === 'custom' && (
                            <>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Width (points)"
                                  value={config.options.logo?.customWidth || 100}
                                  onChange={(e) =>
                                    setConfig({
                                      ...config,
                                      options: {
                                        ...config.options,
                                        logo: {
                                          ...config.options.logo!,
                                          customWidth: parseInt(e.target.value) || 100,
                                        },
                                      },
                                    })
                                  }
                                  inputProps={{ min: 10, max: 500 }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label="Height (points)"
                                  value={config.options.logo?.customHeight || 100}
                                  onChange={(e) =>
                                    setConfig({
                                      ...config,
                                      options: {
                                        ...config.options,
                                        logo: {
                                          ...config.options.logo!,
                                          customHeight: parseInt(e.target.value) || 100,
                                        },
                                      },
                                    })
                                  }
                                  inputProps={{ min: 10, max: 500 }}
                                />
                              </Grid>
                            </>
                          )}
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Opacity"
                              value={config.options.logo?.opacity ?? 1}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  options: {
                                    ...config.options,
                                    logo: {
                                      ...config.options.logo!,
                                      opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 1)),
                                    },
                                  },
                                })
                              }
                              inputProps={{ min: 0, max: 1, step: 0.1 }}
                              helperText="0 = transparent, 1 = opaque"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Margin (points)"
                              value={config.options.logo?.margin || 20}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  options: {
                                    ...config.options,
                                    logo: {
                                      ...config.options.logo!,
                                      margin: parseInt(e.target.value) || 20,
                                    },
                                  },
                                })
                              }
                              inputProps={{ min: 0 }}
                              helperText="Distance from page edge"
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }}>
                      <Chip icon={<Palette />} label="Color Scheme" size="small" />
                    </Divider>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: config.options.primaryColor,
                            border: '2px solid',
                            borderColor: 'divider',
                            boxShadow: 2
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Primary Color
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1.5 }}>
                        <TextField
                          type="color"
                          value={config.options.primaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                primaryColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 70,
                            height: 50,
                            '& input': { 
                              height: 50, 
                              cursor: 'pointer',
                              border: '2px solid',
                              borderColor: 'divider',
                              borderRadius: 1
                            }
                          }}
                        />
                        <TextField
                          value={config.options.primaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                primaryColor: e.target.value,
                              },
                            })
                          }
                          placeholder="#3366cc"
                          size="small"
                          sx={{ flex: 1 }}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Used for headings and accents
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Paper elevation={1} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: config.options.secondaryColor,
                            border: '2px solid',
                            borderColor: 'divider',
                            boxShadow: 2
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Secondary Color
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1.5 }}>
                        <TextField
                          type="color"
                          value={config.options.secondaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                secondaryColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 70,
                            height: 50,
                            '& input': { 
                              height: 50, 
                              cursor: 'pointer',
                              border: '2px solid',
                              borderColor: 'divider',
                              borderRadius: 1
                            }
                          }}
                        />
                        <TextField
                          value={config.options.secondaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                secondaryColor: e.target.value,
                              },
                            })
                          }
                          placeholder="#333333"
                          size="small"
                          sx={{ flex: 1 }}
                          InputProps={{
                            startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Used for text and borders
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={onCancel} sx={{ mt: 1, mr: 1 }}>
                Cancel
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 2: Intro Page */}
        <Step>
          <StepLabel 
            onClick={() => setActiveStep(1)}
            StepIconComponent={() => (
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: activeStep === 1 ? 'primary.main' : activeStep > 1 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 1 || activeStep > 1 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 4
                }
              }}>
                {activeStep > 1 ? <CheckCircle /> : <Description />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 1 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' }
              }}
            >
              Intro Page
            </Typography>
          </StepLabel>
          <StepContent>
            <Card sx={{ mb: 2, boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    mb: 2, 
                    bgcolor: config.introPage?.enabled ? 'success.50' : 'grey.50',
                    border: '2px solid',
                    borderColor: config.introPage?.enabled ? 'success.main' : 'transparent',
                    borderRadius: 2,
                    transition: 'all 0.3s'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.introPage?.enabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            introPage: {
                              ...config.introPage!,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        sx={{ 
                          '&.Mui-checked': { 
                            color: 'success.main' 
                          } 
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Include Intro Page
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Add a cover page with plan title and client information
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>

                {config.introPage?.enabled && (
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Show on intro page:
                    </Typography>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showPlanTitle}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showPlanTitle: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Plan Title"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showWorkspaceName}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showWorkspaceName: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Workspace Name"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showClientName}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showClientName: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Client Name"
                    />

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                            Background Image
                          </Typography>
                          
                          {!introImageUrl ? (
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={uploadingImage === 'intro' ? <CircularProgress size={20} /> : <CloudUpload />}
                              disabled={uploadingImage === 'intro'}
                              fullWidth
                            >
                              {uploadingImage === 'intro' ? 'Uploading...' : 'Upload Image'}
                              <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'intro')}
                              />
                            </Button>
                          ) : (
                            <Box>
                              <Alert 
                                severity="success" 
                                action={
                                  <IconButton
                                    size="small"
                                    onClick={() => setIntroImageUrl('')}
                                  >
                                    <Delete />
                                  </IconButton>
                                }
                              >
                                Image uploaded successfully
                              </Alert>
                              {introImageUrl.includes('http') && (
                                <Box sx={{ mt: 1 }}>
                                  <img 
                                    src={introImageUrl} 
                                    alt="Background preview" 
                                    style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                                  />
                                </Box>
                              )}
                            </Box>
                          )}
                          
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Supports JPG, PNG, GIF. Max 10MB. Image will cover the entire page.
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Background Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.introPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.introPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Used when no background image is set
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Title Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.introPage.titleColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    titleColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.introPage.titleColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    titleColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Title Font Size
                          </Typography>
                          <TextField
                            fullWidth
                            type="number"
                            value={config.introPage.titleSize}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                introPage: {
                                  ...config.introPage!,
                                  titleSize: parseInt(e.target.value) || 32,
                                },
                              })
                            }
                            InputProps={{
                              endAdornment: <Typography variant="body2" sx={{ ml: 1 }}>pt</Typography>,
                              sx: { fontSize: '16px' }
                            }}
                            helperText="Size in points (default: 32)"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ minWidth: 120 }}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: Custom Pages */}
        <Step>
          <StepLabel 
            onClick={() => setActiveStep(2)}
            StepIconComponent={() => (
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: activeStep === 2 ? 'primary.main' : activeStep > 2 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 2 || activeStep > 2 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 4
                }
              }}>
                {activeStep > 2 ? <CheckCircle /> : <Article />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 2 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' }
              }}
            >
              Custom Pages
            </Typography>
          </StepLabel>
          <StepContent>
            <Card sx={{ mb: 2, boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Article color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Custom Pages
                  </Typography>
                  <Tooltip title="Add custom pages like Q&A, disclaimers, or custom content between intro and content pages">
                    <HelpOutline fontSize="small" color="action" />
                  </Tooltip>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Add custom pages and control where they appear in the document. You can place them before content pages, after content pages, at the end, or even after the end page.
                </Typography>

                {(!config.customPages || config.customPages.length === 0) ? (
                  <Paper 
                    elevation={1}
                    sx={{ 
                      p: 4, 
                      textAlign: 'center',
                      bgcolor: 'grey.50',
                      borderRadius: 2,
                      border: '2px dashed',
                      borderColor: 'divider'
                    }}
                  >
                    <Article sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      No custom pages added yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Add Q&A sections, disclaimers, or custom content pages
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => {
                        setEditingCustomPage(null);
                        setShowCustomPageDialog(true);
                      }}
                    >
                      Add Custom Page
                    </Button>
                  </Paper>
                ) : (
                  <Box>
                    {(['beforeContent', 'afterContent', 'atEnd', 'afterEnd'] as const).map((position) => {
                      const positionPages = (config.customPages || [])
                        .filter(p => p.enabled && p.position === position)
                        .sort((a, b) => a.order - b.order);
                      
                      if (positionPages.length === 0) return null;
                      
                      const positionLabels = {
                        beforeContent: 'Before Content Pages',
                        afterContent: 'After Content Pages',
                        atEnd: 'At End (Before End Page)',
                        afterEnd: 'After End Page',
                      };
                      
                      return (
                        <Box key={position} sx={{ mb: 3 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
                            {positionLabels[position]}
                          </Typography>
                          {positionPages.map((page, index) => {
                            const allPagesInPosition = positionPages;
                            return (
                              <Paper
                                key={page.id}
                                elevation={2}
                                sx={{
                                  p: 2,
                                  mb: 1.5,
                                  borderRadius: 2,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  '&:hover': {
                                    boxShadow: 4
                                  }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <DragIndicator sx={{ color: 'text.secondary', cursor: 'grab' }} />
                                  <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                                      {page.type === 'qa' && <QuestionAnswer color="primary" fontSize="small" />}
                                      {page.type === 'disclaimer' && <Gavel color="primary" fontSize="small" />}
                                      {page.type === 'custom' && <Article color="primary" fontSize="small" />}
                                      {page.type === 'terms' && <Gavel color="primary" fontSize="small" />}
                                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {page.title || `${page.type.charAt(0).toUpperCase() + page.type.slice(1)} Page`}
                                      </Typography>
                                      <Chip 
                                        label={page.type.toUpperCase()} 
                                        size="small" 
                                        color="primary"
                                        variant="outlined"
                                      />
                                      <FormControl size="small" sx={{ minWidth: 180 }}>
                                        <Select
                                          value={page.position}
                                          onChange={(e) => {
                                            const newPosition = e.target.value as CustomPageConfig['position'];
                                            const pages = [...(config.customPages || [])];
                                            const pageIndex = pages.findIndex(p => p.id === page.id);
                                            if (pageIndex >= 0) {
                                              // Get max order in new position
                                              const maxOrder = Math.max(
                                                0,
                                                ...pages
                                                  .filter(p => p.enabled && p.position === newPosition && p.id !== page.id)
                                                  .map(p => p.order)
                                              );
                                              pages[pageIndex] = {
                                                ...pages[pageIndex],
                                                position: newPosition,
                                                order: maxOrder + 1,
                                              };
                                              setConfig({ ...config, customPages: pages });
                                            }
                                          }}
                                        >
                                          <MenuItem value="beforeContent">Before Content Pages</MenuItem>
                                          <MenuItem value="afterContent">After Content Pages</MenuItem>
                                          <MenuItem value="atEnd">At End (Before End Page)</MenuItem>
                                          <MenuItem value="afterEnd">After End Page</MenuItem>
                                        </Select>
                                      </FormControl>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      Order: {index + 1} of {allPagesInPosition.length} in this position
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        const pages = [...(config.customPages || [])];
                                        const currentIndex = pages.findIndex(p => p.id === page.id);
                                        const samePositionPages = pages
                                          .filter(p => p.enabled && p.position === page.position)
                                          .sort((a, b) => a.order - b.order);
                                        const positionIndex = samePositionPages.findIndex(p => p.id === page.id);
                                        
                                        if (positionIndex > 0) {
                                          const prevPage = samePositionPages[positionIndex - 1];
                                          const prevIndex = pages.findIndex(p => p.id === prevPage.id);
                                          
                                          const tempOrder = pages[currentIndex].order;
                                          pages[currentIndex].order = pages[prevIndex].order;
                                          pages[prevIndex].order = tempOrder;
                                          
                                          setConfig({ ...config, customPages: pages });
                                        }
                                      }}
                                      disabled={index === 0}
                                    >
                                      <ArrowUpward fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        const pages = [...(config.customPages || [])];
                                        const currentIndex = pages.findIndex(p => p.id === page.id);
                                        const samePositionPages = pages
                                          .filter(p => p.enabled && p.position === page.position)
                                          .sort((a, b) => a.order - b.order);
                                        const positionIndex = samePositionPages.findIndex(p => p.id === page.id);
                                        
                                        if (positionIndex < samePositionPages.length - 1) {
                                          const nextPage = samePositionPages[positionIndex + 1];
                                          const nextIndex = pages.findIndex(p => p.id === nextPage.id);
                                          
                                          const tempOrder = pages[currentIndex].order;
                                          pages[currentIndex].order = pages[nextIndex].order;
                                          pages[nextIndex].order = tempOrder;
                                          
                                          setConfig({ ...config, customPages: pages });
                                        }
                                      }}
                                      disabled={index === allPagesInPosition.length - 1}
                                    >
                                      <ArrowDownward fontSize="small" />
                                    </IconButton>
                                    <Tooltip title="Preview this page">
                                      <IconButton
                                        size="small"
                                        color="info"
                                        onClick={async () => {
                                          try {
                                            // Generate preview for this single page
                                            const response = await api.post('/api/admin/visual-pdf-templates/preview-page', {
                                              pageConfig: page,
                                              kind: kind,
                                            });
                                            if (response.data.previewUrl) {
                                              window.open(response.data.previewUrl, '_blank');
                                            }
                                          } catch (error: any) {
                                            console.error('Failed to preview page:', error);
                                            alert(error.response?.data?.message || 'Failed to generate page preview');
                                          }
                                        }}
                                      >
                                        <Preview fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit page">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => {
                                          setEditingCustomPage(page);
                                          setShowCustomPageDialog(true);
                                        }}
                                      >
                                        <Edit fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete page">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                          const pages = (config.customPages || []).filter(p => p.id !== page.id);
                                          setConfig({ ...config, customPages: pages });
                                        }}
                                      >
                                        <Delete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </Box>
                              </Paper>
                            );
                          })}
                        </Box>
                      );
                    })}
                    
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={() => {
                        setEditingCustomPage(null);
                        setShowCustomPageDialog(true);
                      }}
                      fullWidth
                      sx={{ mt: 2 }}
                    >
                      Add Custom Page
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ minWidth: 120 }}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 4: Content Pages */}
        <Step>
          <StepLabel 
            onClick={() => setActiveStep(3)}
            StepIconComponent={() => (
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: activeStep === 3 ? 'primary.main' : activeStep > 3 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 3 || activeStep > 3 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 4
                }
              }}>
                {activeStep > 3 ? <CheckCircle /> : <ViewDay />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 4 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' }
              }}
            >
              Content Pages
            </Typography>
          </StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Day/Content Page Layout
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Layout</InputLabel>
                      <Select
                        value={config.dayPages.layout}
                        label="Layout"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dayPages: {
                              ...config.dayPages,
                              layout: e.target.value as 'vertical' | 'horizontal',
                            },
                          })
                        }
                      >
                        <MenuItem value="vertical">Vertical</MenuItem>
                        <MenuItem value="horizontal">Horizontal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Days Per Page</InputLabel>
                      <Select
                        value={config.dayPages.daysPerPage}
                        label="Days Per Page"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dayPages: {
                              ...config.dayPages,
                              daysPerPage: e.target.value as number,
                            },
                          })
                        }
                      >
                        <MenuItem value={1}>1 Day</MenuItem>
                        <MenuItem value={2}>2 Days</MenuItem>
                        <MenuItem value={3}>3 Days</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                        Background Image
                      </Typography>
                      
                      {!dayImageUrl ? (
                        <Paper
                          elevation={dragActive === 'day' ? 8 : 1}
                          onDragEnter={(e) => handleDrag(e, 'day')}
                          onDragLeave={(e) => handleDrag(e, 'day')}
                          onDragOver={(e) => handleDrag(e, 'day')}
                          onDrop={(e) => handleDrop(e, 'day')}
                          sx={{
                            p: 3,
                            border: '2px dashed',
                            borderColor: dragActive === 'day' ? 'primary.main' : 'divider',
                            bgcolor: dragActive === 'day' ? 'primary.50' : 'grey.50',
                            borderRadius: 2,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'primary.50'
                            }
                          }}
                        >
                          <input
                            type="file"
                            id="day-image-upload"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'day')}
                          />
                          <label htmlFor="day-image-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {uploadingImage === 'day' ? (
                                <CircularProgress size={40} />
                              ) : (
                                <>
                                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Drag & drop image here
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    or click to browse
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </label>
                        </Paper>
                      ) : (
                        <Box>
                          <Alert 
                            severity="success" 
                            action={
                              <IconButton
                                size="small"
                                onClick={() => setDayImageUrl('')}
                              >
                                <Delete />
                              </IconButton>
                            }
                          >
                            Image uploaded - will be used for all content pages
                          </Alert>
                          {dayImageUrl.includes('http') && (
                            <Box sx={{ mt: 1 }}>
                              <img 
                                src={dayImageUrl} 
                                alt="Background preview" 
                                style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        This image will be used as background for all day/content pages
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Background Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Text Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.textColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                textColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.textColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                textColor: e.target.value,
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Table Appearance
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Header Background
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.table?.headerBackground || '#f5f7ff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  headerBackground: e.target.value,
                                },
                              },
                            })
                          }
                          sx={{
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.table?.headerBackground || '#f5f7ff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  headerBackground: e.target.value,
                                },
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Header Text
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.table?.headerTextColor || '#1a1a1a'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  headerTextColor: e.target.value,
                                },
                              },
                            })
                          }
                          sx={{
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.table?.headerTextColor || '#1a1a1a'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  headerTextColor: e.target.value,
                                },
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Border Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.table?.borderColor || '#d4daec'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  borderColor: e.target.value,
                                },
                              },
                            })
                          }
                          sx={{
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.table?.borderColor || '#d4daec'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  borderColor: e.target.value,
                                },
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Row Stripe
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.table?.stripeColor || '#f0f4ff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  stripeColor: e.target.value,
                                },
                              },
                            })
                          }
                          sx={{
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.table?.stripeColor || '#f0f4ff'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                table: {
                                  ...config.dayPages.table,
                                  stripeColor: e.target.value,
                                },
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  Font Sizes
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Day Title Size"
                      type="number"
                      fullWidth
                      value={config.dayPages.fontSize?.dayTitle || 18}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            fontSize: {
                              ...config.dayPages.fontSize,
                              dayTitle: parseInt(e.target.value) || 18,
                            },
                          },
                        })
                      }
                      InputProps={{ inputProps: { min: 8, max: 48 } }}
                      size="small"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Exercise Name Size"
                      type="number"
                      fullWidth
                      value={config.dayPages.fontSize?.exerciseName || 12}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            fontSize: {
                              ...config.dayPages.fontSize,
                              exerciseName: parseInt(e.target.value) || 12,
                            },
                          },
                        })
                      }
                      InputProps={{ inputProps: { min: 6, max: 32 } }}
                      size="small"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Details Size (sets, reps, etc.)"
                      type="number"
                      fullWidth
                      value={config.dayPages.fontSize?.details || 10}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            fontSize: {
                              ...config.dayPages.fontSize,
                              details: parseInt(e.target.value) || 10,
                            },
                          },
                        })
                      }
                      InputProps={{ inputProps: { min: 6, max: 24 } }}
                      size="small"
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {kind === 'workout' && (
                  <>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
                      Exercise Content
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showExerciseName !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showExerciseName: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Exercise Name"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showExerciseDescription !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showExerciseDescription: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Exercise Description"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showGifImage !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showGifImage: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="GIF / Image"
                        />
                      </Grid>
                      {config.dayPages.options.showGifImage && (
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="GIF Height (px)"
                            size="small"
                            value={config.dayPages.options.gifHeight || 140}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    gifHeight: Math.max(60, Math.min(240, Number(e.target.value) || 140)),
                                  },
                                },
                              }))
                            }
                            helperText="Applies to every exercise image"
                          />
                        </Grid>
                      )}
                    </Grid>

                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 3 }}>
                      Set Table Columns
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ fontSize: '0.8rem', mb: 1 }}>
                          The table always includes Set # and Reps. Toggle the additional columns below.
                        </Alert>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showSetRest !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showSetRest: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Rest"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showSetTempo !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showSetTempo: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Tempo"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showSetRir !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showSetRir: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="RIR"
                        />
                      </Grid>
                    </Grid>
                  </>
                )}

                {kind === 'nutrition' && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
                      Nutrition Content
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMealNames !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showMealNames: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Meal Names"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMealTimes !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showMealTimes: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Meal Times"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showFoodItems !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showFoodItems: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Food Items"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showQuantities !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showQuantities: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Quantities"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                          Macro Nutrients
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMacros !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showMacros: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Show All Macros"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showCalories !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showCalories: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Calories"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showProtein !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showProtein: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Protein"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showCarbs !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showCarbs: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Carbs"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showFat !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showFat: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Fat"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                          Totals & Notes
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMealTotalCalories !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showMealTotalCalories: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Meal Total Calories"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showDayTotalCalories !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showDayTotalCalories: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Day Total Calories"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMealNotes !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      showMealNotes: e.target.checked,
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Meal Notes"
                        />
                      </Grid>
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ minWidth: 120 }}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 5: End Page */}
        <Step>
          <StepLabel 
            onClick={() => setActiveStep(4)}
            StepIconComponent={() => (
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: activeStep === 4 ? 'primary.main' : activeStep > 4 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 4 || activeStep > 4 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 4
                }
              }}>
                {activeStep > 4 ? <CheckCircle /> : <ExitToApp />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 4 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' }
              }}
            >
              End Page
            </Typography>
          </StepLabel>
          <StepContent>
            <Card sx={{ mb: 2, boxShadow: 3, borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.endPage?.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          endPage: {
                            ...config.endPage!,
                            enabled: e.target.checked,
                          },
                        })
                      }
                    />
                  }
                  label="Include End Page"
                />

                {config.endPage?.enabled && (
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.endPage.showThankYouMessage}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                showThankYouMessage: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Show Thank You Message"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.endPage.showContactInfo}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                showContactInfo: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Show Contact Info"
                    />

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Custom Message
                      </Typography>
                      <TextField
                        fullWidth
                        value={config.endPage.customMessage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            endPage: {
                              ...config.endPage!,
                              customMessage: e.target.value,
                            },
                          })
                        }
                        multiline
                        rows={3}
                        placeholder="Thank you for choosing us!"
                        InputProps={{
                          sx: { fontSize: '14px' }
                        }}
                      />
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                        Background Image
                      </Typography>
                      
                      {!endImageUrl ? (
                        <Paper
                          elevation={dragActive === 'end' ? 8 : 1}
                          onDragEnter={(e) => handleDrag(e, 'end')}
                          onDragLeave={(e) => handleDrag(e, 'end')}
                          onDragOver={(e) => handleDrag(e, 'end')}
                          onDrop={(e) => handleDrop(e, 'end')}
                          sx={{
                            p: 3,
                            border: '2px dashed',
                            borderColor: dragActive === 'end' ? 'primary.main' : 'divider',
                            bgcolor: dragActive === 'end' ? 'primary.50' : 'grey.50',
                            borderRadius: 2,
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'primary.50'
                            }
                          }}
                        >
                          <input
                            type="file"
                            id="end-image-upload"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'end')}
                          />
                          <label htmlFor="end-image-upload" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                              {uploadingImage === 'end' ? (
                                <CircularProgress size={40} />
                              ) : (
                                <>
                                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Drag & drop image here
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    or click to browse
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </label>
                        </Paper>
                      ) : (
                        <Box>
                          <Alert 
                            severity="success" 
                            action={
                              <IconButton
                                size="small"
                                onClick={() => setEndImageUrl('')}
                              >
                                <Delete />
                              </IconButton>
                            }
                          >
                            Image uploaded successfully
                          </Alert>
                          {endImageUrl.includes('http') && (
                            <Box sx={{ mt: 1 }}>
                              <img 
                                src={endImageUrl} 
                                alt="Background preview" 
                                style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Background for the final thank you page
                      </Typography>
                    </Box>

                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Background Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.endPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  endPage: {
                                    ...config.endPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.endPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  endPage: {
                                    ...config.endPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Text Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.endPage.textColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  endPage: {
                                    ...config.endPage!,
                                    textColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.endPage.textColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  endPage: {
                                    ...config.endPage!,
                                    textColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ minWidth: 120 }}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 6: Review & Save */}
        <Step>
          <StepLabel>Review & Save</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Workspace Assignment
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isGlobal}
                        onChange={(e) => {
                          setIsGlobal(e.target.checked);
                          if (e.target.checked) {
                            setSelectedWorkspaceIds([]);
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          Make this template available globally
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          All workspaces will be able to use this template
                        </Typography>
                      </Box>
                    }
                  />

                  {!isGlobal && (
                    <Box sx={{ mt: 2, ml: 4 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Select Workspaces
                      </Typography>
                      <FormControl fullWidth>
                        <Select
                          multiple
                          value={selectedWorkspaceIds}
                          onChange={(e) => setSelectedWorkspaceIds(e.target.value as string[])}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((id) => {
                                const ws = workspaces.find(w => w.id === id);
                                return ws ? <Chip key={id} label={ws.name} size="small" /> : null;
                              })}
                            </Box>
                          )}
                        >
                          {workspaces.map((ws) => (
                            <MenuItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {selectedWorkspaceIds.length === 0 && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          Please select at least one workspace
                        </Alert>
                      )}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Template Configuration Summary
                  </Typography>
                  <Tooltip title="Review your template settings before saving">
                    <HelpOutline fontSize="small" color="action" />
                  </Tooltip>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {/* Visual Preview Cards */}
                  <Grid item xs={12} md={6}>
                    <Paper 
                      elevation={2}
                      sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: 'primary.main'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Palette fontSize="small" />
                        Color Scheme Preview
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Primary</Typography>
                          <Box sx={{ width: 60, height: 60, borderRadius: 1, bgcolor: config.options.primaryColor, border: '2px solid', borderColor: 'divider', boxShadow: 2 }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Secondary</Typography>
                          <Box sx={{ width: 60, height: 60, borderRadius: 1, bgcolor: config.options.secondaryColor, border: '2px solid', borderColor: 'divider', boxShadow: 2 }} />
                        </Box>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Font: {config.options.fontFamily || 'Alexandria'} • {config.options.pageSize} ({config.options.orientation})
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper 
                      elevation={2}
                      sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: 'info.main'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ViewDay fontSize="small" />
                        Layout Preview
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={`${config.dayPages.daysPerPage} day(s) per page`}
                          size="small"
                          color="primary"
                        />
                        <Chip 
                          label={config.dayPages.layout}
                          size="small"
                          color="secondary"
                        />
                        {config.introPage?.enabled && (
                          <Chip label="Intro Page" size="small" color="success" />
                        )}
                        {config.endPage?.enabled && (
                          <Chip label="End Page" size="small" color="success" />
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Template Name:</strong> {templateName || '(Not set)'}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Type:</strong> {kind === 'workout' ? 'Workout Plan' : 'Nutrition Plan'}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Assignment:</strong>{' '}
                    {isGlobal ? (
                      <Chip label="Global (All Workspaces)" color="success" size="small" />
                    ) : (
                      <Chip label={`${selectedWorkspaceIds.length} workspace(s)`} size="small" />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Page Size:</strong> {config.options.pageSize} ({config.options.orientation})
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Intro Page:</strong>{' '}
                    <Chip
                      label={config.introPage?.enabled ? 'Enabled' : 'Disabled'}
                      color={config.introPage?.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    {config.introPage?.enabled && introImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>End Page:</strong>{' '}
                    <Chip
                      label={config.endPage?.enabled ? 'Enabled' : 'Disabled'}
                      color={config.endPage?.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    {config.endPage?.enabled && endImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Content Pages:</strong> {config.dayPages.daysPerPage} day(s) per page ({config.dayPages.layout})
                    {dayImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </Paper>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Review your configuration and click "Save Template" to create your visual PDF template.
                </Typography>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={onCancel}
                sx={{ minWidth: 100 }}
              >
                Cancel
              </Button>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                color="success"
                onClick={handleSave}
                sx={{ minWidth: 140 }}
                size="large"
              >
                Save Template
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {/* Custom Page Dialog */}
      <Dialog
        open={showCustomPageDialog}
        onClose={() => setShowCustomPageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <CustomPageEditor
          page={editingCustomPage}
          config={config}
          onSave={(page) => {
            const pages = editingCustomPage
              ? (config.customPages || []).map(p => p.id === editingCustomPage.id ? page : p)
              : [...(config.customPages || []), page];
            setConfig({ ...config, customPages: pages });
            setShowCustomPageDialog(false);
            setEditingCustomPage(null);
          }}
          onCancel={() => {
            setShowCustomPageDialog(false);
            setEditingCustomPage(null);
          }}
        />
      </Dialog>
    </Box>
  );
}

// Custom Page Editor Component
function CustomPageEditor({
  page,
  onSave,
  onCancel,
  config,
}: {
  page: CustomPageConfig | null;
  onSave: (page: CustomPageConfig) => void;
  onCancel: () => void;
  config: VisualPdfConfig;
}) {
  const [pageType, setPageType] = useState<'qa' | 'disclaimer' | 'custom' | 'terms'>(page?.type || 'qa');
  const [title, setTitle] = useState(page?.title || '');
  const [enabled, setEnabled] = useState(page?.enabled !== false);
  const [position, setPosition] = useState<CustomPageConfig['position']>(page?.position || 'beforeContent');
  const [backgroundColor, setBackgroundColor] = useState(page?.backgroundColor || '#ffffff');
  const [textColor, setTextColor] = useState(page?.textColor || '#000000');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(page?.backgroundImage || '');
  const [uploadingBackgroundImage, setUploadingBackgroundImage] = useState(false);
  const [dragActiveBg, setDragActiveBg] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templates, setTemplates] = useState<WorkspacePageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  
  // Q&A specific state
  const [qaSections, setQaSections] = useState<QASection[]>(
    page?.type === 'qa' ? (page.config as QAPageConfig).sections : []
  );
  const [qaLayout, setQaLayout] = useState<'list' | 'accordion' | 'table'>(
    page?.type === 'qa' ? (page.config as QAPageConfig).layout : 'list'
  );
  const [showNumbers, setShowNumbers] = useState(
    page?.type === 'qa' ? (page.config as QAPageConfig).showNumbers : true
  );
  
  // Disclaimer specific state
  const [disclaimerContent, setDisclaimerContent] = useState(
    page?.type === 'disclaimer' ? (page.config as DisclaimerPageConfig).content : ''
  );
  const [showDate, setShowDate] = useState(
    page?.type === 'disclaimer' ? (page.config as DisclaimerPageConfig).showDate : true
  );
  const [showSignature, setShowSignature] = useState(
    page?.type === 'disclaimer' ? (page.config as DisclaimerPageConfig).showSignature : false
  );
  
  // Custom content state
  const [customContent, setCustomContent] = useState(
    page?.type === 'custom' ? (page.config as CustomContentPageConfig).content : ''
  );
  
  // Widget styling state (shared across page types)
  const [widgetStyle, setWidgetStyle] = useState<{
    enabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    backgroundColor: string;
    padding: number;
    margin: number;
  }>(() => {
    const config = page?.config as QAPageConfig | DisclaimerPageConfig | CustomContentPageConfig;
    return config?.widgetStyle || {
      enabled: false,
      borderColor: '#cccccc',
      borderWidth: 1,
      borderRadius: 4,
      backgroundColor: '#ffffff',
      padding: 10,
      margin: 10,
    };
  });

  const handleSave = () => {
    // Get max order for the selected position
    const existingPages = (config?.customPages || []);
    const maxOrder = Math.max(
      -1,
      ...existingPages
        .filter(p => p.enabled && p.position === position && p.id !== page?.id)
        .map(p => p.order)
    );
    
    const newPage: CustomPageConfig = {
      id: page?.id || `page-${Date.now()}`,
      type: pageType,
      title: title || undefined,
      enabled,
      position: position,
      order: page?.order ?? maxOrder + 1,
      backgroundColor,
      textColor,
      backgroundImage: backgroundImageUrl || undefined,
      config: pageType === 'qa'
        ? {
            sections: qaSections,
            layout: qaLayout,
            showNumbers,
          }
        : pageType === 'disclaimer'
        ? {
            content: disclaimerContent,
            showDate,
            showSignature,
          }
        : {
            content: customContent,
            allowImages: true,
            allowLinks: true,
          },
    };
    onSave(newPage);
  };

  const addQASection = () => {
    setQaSections([
      ...qaSections,
      {
        id: `qa-${Date.now()}`,
        question: '',
        answer: '',
        order: qaSections.length,
      },
    ]);
  };

  const updateQASection = (id: string, field: 'question' | 'answer', value: string) => {
    setQaSections(qaSections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeQASection = (id: string) => {
    setQaSections(qaSections.filter(s => s.id !== id));
  };

  const handleBackgroundImageUpload = async (file: File) => {
    setUploadingBackgroundImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post('/api/admin/upload-template-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data?.imageUrl) {
        setBackgroundImageUrl(response.data.imageUrl);
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      alert(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingBackgroundImage(false);
    }
  };

  // Load templates when dialog opens
  useEffect(() => {
    if (showTemplateDialog) {
      loadTemplates();
    }
  }, [showTemplateDialog, pageType]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const fetchedTemplates = await listPageTemplates(pageType);
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleLoadFromTemplate = (template: WorkspacePageTemplate) => {
    const templatePage = template.pageConfig as CustomPageConfig;
    setPageType(template.type);
    setTitle(templatePage.title || '');
    setEnabled(templatePage.enabled);
    setPosition(templatePage.position || 'beforeContent');
    setBackgroundColor(templatePage.backgroundColor || '#ffffff');
    setTextColor(templatePage.textColor || '#000000');
    setBackgroundImageUrl(templatePage.backgroundImage || '');
    
    if (template.type === 'qa' && templatePage.config) {
      const qaConfig = templatePage.config as QAPageConfig;
      setQaSections(qaConfig.sections || []);
      setQaLayout(qaConfig.layout || 'list');
      setShowNumbers(qaConfig.showNumbers !== false);
      if (qaConfig.widgetStyle) {
        setWidgetStyle({
          enabled: qaConfig.widgetStyle.enabled || false,
          borderColor: qaConfig.widgetStyle.borderColor || '#cccccc',
          borderWidth: qaConfig.widgetStyle.borderWidth || 1,
          borderRadius: qaConfig.widgetStyle.borderRadius || 4,
          backgroundColor: qaConfig.widgetStyle.backgroundColor || '#ffffff',
          padding: qaConfig.widgetStyle.padding || 10,
          margin: qaConfig.widgetStyle.margin || 10,
        });
      }
    } else if (template.type === 'disclaimer' && templatePage.config) {
      const disclaimerConfig = templatePage.config as DisclaimerPageConfig;
      setDisclaimerContent(disclaimerConfig.content || '');
      setShowDate(disclaimerConfig.showDate !== false);
      setShowSignature(disclaimerConfig.showSignature || false);
      if (disclaimerConfig.widgetStyle) {
        setWidgetStyle({
          enabled: disclaimerConfig.widgetStyle.enabled || false,
          borderColor: disclaimerConfig.widgetStyle.borderColor || '#cccccc',
          borderWidth: disclaimerConfig.widgetStyle.borderWidth || 1,
          borderRadius: disclaimerConfig.widgetStyle.borderRadius || 4,
          backgroundColor: disclaimerConfig.widgetStyle.backgroundColor || '#ffffff',
          padding: disclaimerConfig.widgetStyle.padding || 10,
          margin: disclaimerConfig.widgetStyle.margin || 10,
        });
      }
    } else if (template.type === 'custom' && templatePage.config) {
      const customConfig = templatePage.config as CustomContentPageConfig;
      setCustomContent(customConfig.content || '');
      if (customConfig.widgetStyle) {
        setWidgetStyle({
          enabled: customConfig.widgetStyle.enabled || false,
          borderColor: customConfig.widgetStyle.borderColor || '#cccccc',
          borderWidth: customConfig.widgetStyle.borderWidth || 1,
          borderRadius: customConfig.widgetStyle.borderRadius || 4,
          backgroundColor: customConfig.widgetStyle.backgroundColor || '#ffffff',
          padding: customConfig.widgetStyle.padding || 10,
          margin: customConfig.widgetStyle.margin || 10,
        });
      }
    }
    
    setShowTemplateDialog(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setSavingAsTemplate(true);
    try {
      const pageConfig: CustomPageConfig = {
        id: `page-${Date.now()}`,
        type: pageType,
        title: title || undefined,
        enabled,
        position: position,
        order: 0,
        backgroundColor,
        textColor,
        backgroundImage: backgroundImageUrl || undefined,
        config: pageType === 'qa'
          ? {
              sections: qaSections,
              layout: qaLayout,
              showNumbers,
            }
          : pageType === 'disclaimer'
          ? {
              content: disclaimerContent,
              showDate,
              showSignature,
            }
          : {
              content: customContent,
              allowImages: true,
              allowLinks: true,
            },
      };

      await createPageTemplate({
        name: templateName.trim(),
        type: pageType,
        description: templateDescription.trim() || undefined,
        pageConfig,
      });

      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      alert('Template saved successfully!');
    } catch (error: any) {
      console.error('Failed to save template:', error);
      alert(error.response?.data?.message || 'Failed to save template');
    } finally {
      setSavingAsTemplate(false);
    }
  };

  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {pageType === 'qa' && <QuestionAnswer color="primary" />}
            {pageType === 'disclaimer' && <Gavel color="primary" />}
            {pageType === 'custom' && <Article color="primary" />}
            <Typography variant="h6" component="span">
              {page ? 'Edit Custom Page' : 'Add Custom Page'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Article />}
              onClick={() => setShowTemplateDialog(true)}
            >
              Load Template
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={() => setShowSaveTemplateDialog(true)}
            >
              Save as Template
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <FormLabel sx={{ mb: 1.5, fontWeight: 600 }}>Page Type</FormLabel>
            <RadioGroup
              row
              value={pageType}
              onChange={(e) => setPageType(e.target.value as any)}
              sx={{ gap: 2 }}
            >
              <Paper
                elevation={pageType === 'qa' ? 3 : 1}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: pageType === 'qa' ? 'primary.main' : 'transparent',
                  cursor: 'pointer',
                  flex: 1,
                  '&:hover': {
                    boxShadow: 2,
                    borderColor: 'primary.light'
                  }
                }}
                onClick={() => setPageType('qa')}
              >
                <FormControlLabel
                  value="qa"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <QuestionAnswer />
                      <Typography>Q&A</Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              </Paper>
              <Paper
                elevation={pageType === 'disclaimer' ? 3 : 1}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: pageType === 'disclaimer' ? 'primary.main' : 'transparent',
                  cursor: 'pointer',
                  flex: 1,
                  '&:hover': {
                    boxShadow: 2,
                    borderColor: 'primary.light'
                  }
                }}
                onClick={() => setPageType('disclaimer')}
              >
                <FormControlLabel
                  value="disclaimer"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Gavel />
                      <Typography>Disclaimer</Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              </Paper>
              <Paper
                elevation={pageType === 'custom' ? 3 : 1}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: pageType === 'custom' ? 'primary.main' : 'transparent',
                  cursor: 'pointer',
                  flex: 1,
                  '&:hover': {
                    boxShadow: 2,
                    borderColor: 'primary.light'
                  }
                }}
                onClick={() => setPageType('custom')}
              >
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Article />
                      <Typography>Custom</Typography>
                    </Box>
                  }
                  sx={{ m: 0 }}
                />
              </Paper>
            </RadioGroup>
          </FormControl>

          <TextField
            fullWidth
            label="Page Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Optional: Leave empty to use default title"
            placeholder={`Enter ${pageType === 'qa' ? 'Q&A' : pageType === 'disclaimer' ? 'Disclaimer' : 'Custom'} page title`}
          />

          <FormControlLabel
            control={<Checkbox checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Enable this page"
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Page Position</InputLabel>
            <Select
              value={position}
              onChange={(e) => setPosition(e.target.value as CustomPageConfig['position'])}
              label="Page Position"
            >
              <MenuItem value="beforeContent">Before Content Pages</MenuItem>
              <MenuItem value="afterContent">After Content Pages</MenuItem>
              <MenuItem value="atEnd">At End (Before End Page)</MenuItem>
              <MenuItem value="afterEnd">After End Page</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Choose where this page appears in the document
            </Typography>
          </FormControl>

          {/* Background Image Upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
              Background Image (Optional)
            </Typography>
            <Paper
              elevation={1}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActiveBg(true);
              }}
              onDragLeave={() => setDragActiveBg(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragActiveBg(false);
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  await handleBackgroundImageUpload(file);
                }
              }}
              sx={{
                p: 3,
                border: '2px dashed',
                borderColor: dragActiveBg ? 'primary.main' : 'divider',
                bgcolor: dragActiveBg ? 'action.hover' : 'background.paper',
                borderRadius: 2,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => document.getElementById('custom-page-bg-upload')?.click()}
            >
              <input
                id="custom-page-bg-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleBackgroundImageUpload(file);
                  }
                }}
              />
              {uploadingBackgroundImage ? (
                <CircularProgress />
              ) : backgroundImageUrl ? (
                <Box>
                  <img
                    src={backgroundImageUrl}
                    alt="Background preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  />
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBackgroundImageUrl('');
                    }}
                  >
                    Remove Image
                  </Button>
                </Box>
              ) : (
                <Box>
                  <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Drag and drop an image here, or click to upload
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Supports: JPG, PNG, GIF
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          <Divider sx={{ my: 2 }} />

          {pageType === 'qa' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <QuestionAnswer color="primary" />
                <Typography variant="h6">
                  Questions & Answers
                </Typography>
              </Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Layout Style</InputLabel>
                    <Select value={qaLayout} onChange={(e) => setQaLayout(e.target.value as any)}>
                      <MenuItem value="list">List Format</MenuItem>
                      <MenuItem value="accordion">Accordion Style</MenuItem>
                      <MenuItem value="table">Table Format</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={<Checkbox checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />}
                    label="Show question numbers"
                    sx={{ mt: 2 }}
                  />
                </Grid>
              </Grid>
              
              {qaSections.length === 0 ? (
                <Paper
                  elevation={1}
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'divider',
                    mb: 2
                  }}
                >
                  <QuestionAnswer sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    No Q&A sections added yet
                  </Typography>
                  <Button
                    startIcon={<Add />}
                    onClick={addQASection}
                    variant="contained"
                    sx={{ mt: 2 }}
                  >
                    Add First Q&A Section
                  </Button>
                </Paper>
              ) : (
                <>
                  {qaSections.map((section, index) => (
                    <Paper key={section.id} elevation={2} sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Chip
                          label={`Q&A #${index + 1}`}
                          color="primary"
                          size="small"
                          icon={<QuestionAnswer />}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeQASection(section.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Question"
                        value={section.question}
                        onChange={(e) => updateQASection(section.id, 'question', e.target.value)}
                        sx={{ mb: 2 }}
                        placeholder="Enter your question here..."
                      />
                      <TextField
                        fullWidth
                        label="Answer"
                        value={section.answer}
                        onChange={(e) => updateQASection(section.id, 'answer', e.target.value)}
                        multiline
                        rows={4}
                        placeholder="Enter the answer here..."
                      />
                    </Paper>
                  ))}
                  <Button
                    startIcon={<Add />}
                    onClick={addQASection}
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    Add Another Q&A Section
                  </Button>
                </>
              )}
            </Box>
          )}

          {pageType === 'disclaimer' && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Disclaimer Content
              </Typography>
              <TextField
                fullWidth
                label="Disclaimer Text"
                value={disclaimerContent}
                onChange={(e) => setDisclaimerContent(e.target.value)}
                multiline
                rows={8}
                sx={{ mb: 2 }}
                helperText="Enter the disclaimer or terms text"
              />
              <FormControlLabel
                control={<Checkbox checked={showDate} onChange={(e) => setShowDate(e.target.checked)} />}
                label="Show date"
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={<Checkbox checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} />}
                label="Show signature line"
              />
            </Box>
          )}

          {pageType === 'custom' && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Custom Content
              </Typography>
              <TextField
                fullWidth
                label="Content (HTML supported)"
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                multiline
                rows={10}
                helperText="Enter custom HTML content for this page"
              />
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Widget/Frame Styling */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Widget/Frame Styling
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={widgetStyle.enabled}
                onChange={(e) => setWidgetStyle({ ...widgetStyle, enabled: e.target.checked })}
              />
            }
            label="Enable widget frame around content"
            sx={{ mb: 2 }}
          />

          {widgetStyle.enabled && (
            <Box sx={{ pl: 4, pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="color"
                    label="Border Color"
                    value={widgetStyle.borderColor}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, borderColor: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Border Width (px)"
                    value={widgetStyle.borderWidth}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, borderWidth: parseInt(e.target.value) || 1 })}
                    inputProps={{ min: 0, max: 10 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Border Radius (px)"
                    value={widgetStyle.borderRadius}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, borderRadius: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0, max: 50 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="color"
                    label="Background Color"
                    value={widgetStyle.backgroundColor}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, backgroundColor: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Padding (px)"
                    value={widgetStyle.padding}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, padding: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0, max: 50 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Margin (px)"
                    value={widgetStyle.margin}
                    onChange={(e) => setWidgetStyle({ ...widgetStyle, margin: parseInt(e.target.value) || 0 })}
                    inputProps={{ min: 0, max: 50 }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Styling
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 600 }}>
                  Background Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: 'divider',
                      bgcolor: backgroundColor,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = backgroundColor;
                      input.onchange = (e: any) => setBackgroundColor(e.target.value);
                      input.click();
                    }}
                  >
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Hex Color"
                    value={backgroundColor}
                    onChange={(e) => {
                      const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setBackgroundColor(value);
                      }
                    }}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>,
                    }}
                    helperText="Click color box or enter hex code"
                  />
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 600 }}>
                  Text Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: 'divider',
                      bgcolor: textColor,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = textColor;
                      input.onchange = (e: any) => setTextColor(e.target.value);
                      input.click();
                    }}
                  >
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Hex Color"
                    value={textColor}
                    onChange={(e) => {
                      const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setTextColor(value);
                      }
                    }}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>,
                    }}
                    helperText="Click color box or enter hex code"
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Quick Color Presets */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 600 }}>
              Quick Color Presets
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { bg: '#ffffff', text: '#000000', label: 'White/Black' },
                { bg: '#f5f5f5', text: '#333333', label: 'Light Gray' },
                { bg: '#1a1a1a', text: '#ffffff', label: 'Dark/White' },
                { bg: '#f0f8ff', text: '#1e3a8a', label: 'Light Blue' },
                { bg: '#fff5f5', text: '#991b1b', label: 'Light Red' },
                { bg: '#f0fdf4', text: '#166534', label: 'Light Green' },
              ].map((preset, idx) => (
                <Paper
                  key={idx}
                  elevation={1}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: backgroundColor === preset.bg && textColor === preset.text ? 'primary.main' : 'transparent',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2
                    }
                  }}
                  onClick={() => {
                    setBackgroundColor(preset.bg);
                    setTextColor(preset.text);
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 0.5,
                        bgcolor: preset.bg,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 0.5,
                        bgcolor: preset.text,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      {preset.label}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {page ? 'Update' : 'Add'} Page
        </Button>
      </DialogActions>

      {/* Template Selection Dialog */}
      <Dialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Article color="primary" />
            <Typography variant="h6">Load from Template</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : templates.length === 0 ? (
            <Paper
              elevation={1}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 2,
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Article sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                No templates found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Save a page as a template to reuse it later
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ pt: 2 }}>
              {templates.map((template) => (
                <Paper
                  key={template.id}
                  elevation={2}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'transparent',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => handleLoadFromTemplate(template)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {template.type === 'qa' && <QuestionAnswer color="primary" fontSize="small" />}
                        {template.type === 'disclaimer' && <Gavel color="primary" fontSize="small" />}
                        {template.type === 'custom' && <Article color="primary" fontSize="small" />}
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {template.name}
                        </Typography>
                        {template.isDefault && (
                          <Chip label="Default" color="primary" size="small" />
                        )}
                      </Box>
                      {template.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {template.description}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Type: {template.type.toUpperCase()} • Created: {new Date(template.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog
        open={showSaveTemplateDialog}
        onClose={() => setShowSaveTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save as Template</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              sx={{ mb: 2 }}
              required
              placeholder="e.g., Standard Q&A Page"
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Describe what this template is used for..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowSaveTemplateDialog(false);
            setTemplateName('');
            setTemplateDescription('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAsTemplate}
            variant="contained"
            disabled={!templateName.trim() || savingAsTemplate}
          >
            {savingAsTemplate ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

