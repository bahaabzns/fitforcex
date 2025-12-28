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
  Slider,
} from '@mui/material';
import { CloudUpload, Delete, Preview, Settings, Description, ViewDay, ExitToApp, CheckCircle, RadioButtonUnchecked, Palette, Image, TableChart, FormatSize, HelpOutline, ExpandMore, ExpandLess, Add, Edit, DragIndicator, QuestionAnswer, Gavel, Article, ArrowUpward, ArrowDownward, ZoomIn, ZoomOut, Refresh, Fullscreen, FullscreenExit, Close } from '@mui/icons-material';
import api from '@/utils/axios';
import { previewVisualPdfTemplate, previewVisualPdfFromConfig, createVisualPdfTemplate, deleteVisualPdfTemplate } from '@/api/visual-pdf-templates';
import { listPageTemplates, createPageTemplate, WorkspacePageTemplate } from '@/api/page-templates';

export interface CustomPageConfig {
  id: string;
  type: 'qa' | 'disclaimer' | 'custom' | 'terms';
  title?: string;
  enabled: boolean;
  position: 'beforeContent' | 'afterContent' | 'atEnd' | 'afterEnd'; // Where in document
  order: number; // Order within the same position group
  backgroundColor?: string;
  backgroundColorOpacity?: number; // Opacity for background color overlay (0-1)
  backgroundImage?: string;
  textColor?: string;
  fontSize?: number;
  // Grid positioning system (3x4 grid = 12 cells)
  gridEnabled?: boolean; // Enable grid positioning
  gridColumns?: number; // Number of columns (default: 3)
  gridRows?: number; // Number of rows (default: 4)
  gridPosition?: {
    row: number; // Row index (0-based)
    col: number; // Column index (0-based)
    spanRows?: number; // How many rows to span (default: 1)
    spanCols?: number; // How many columns to span (default: 1)
  };
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
  buttons?: ButtonConfig[];
}

interface ButtonConfig {
  id: string;
  label: string;
  link: string;
  x: number; // X position in pixels
  y: number; // Y position in pixels
  width?: number; // Button width (default: auto)
  height?: number; // Button height (default: auto)
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    fontSize?: number;
    padding?: number;
  };
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
    buttons?: ButtonConfig[];
  };
  endPage?: {
    enabled: boolean;
    showThankYouMessage?: boolean;
    showContactInfo?: boolean;
    backgroundImage?: string;
    backgroundColor?: string;
    textColor?: string;
    customMessage?: string;
    buttons?: ButtonConfig[];
  };
  customPages?: CustomPageConfig[]; // NEW: Custom pages array
  dayPages: {
    layout: 'vertical' | 'horizontal';
    daysPerPage: number;
    mealsPerPage?: number; // For nutrition plans: how many meals per page before new page
    foodItemsPerMeal?: number; // For nutrition plans: max food items per meal before splitting to next page
    backgroundImage?: string;
    backgroundColor?: string;
    textColor?: string;
    buttons?: ButtonConfig[]; // Buttons for day/content pages
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
      showSetNotes?: boolean; // Show Notes column in workout table
      exerciseSpacing?: number; // Vertical spacing between exercises
      exerciseTitleMarginTop?: number; // Space above exercise title
      exerciseTitleMarginBottom?: number; // Space below exercise title
      // Exercise layout and display options
      exerciseLayout?: 'vertical' | 'horizontal' | 'table' | 'compact';
      // Exercise table styling
      exerciseTableBorder?: {
        enabled?: boolean;
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed' | 'dotted' | 'double';
        radius?: number;
        headerBackground?: string;
        headerTextColor?: string;
        rowStripeColor?: string;
      };
      // Advanced positioning for workout
      exerciseTablePosition?: {
        x?: number; // X position of table start (in pixels)
        y?: number; // Y position of table start (in pixels)
      };
      // Advanced spacing for workout
      spacingBetweenExercises?: number; // Spacing between exercises
      spacingBetweenExerciseAndDetails?: number; // Spacing between exercise name and details
      spacingBetweenSetDetails?: number; // Spacing between set details (reps, rest, tempo, RIR)
      // Nutrition plan options
      showMealNames?: boolean;
      mealSpacing?: number; // Vertical spacing between meals
      foodItemSpacing?: number; // Vertical spacing between food items within a meal
      mealTitleMarginTop?: number; // Space above meal title
      mealTitleMarginBottom?: number; // Space below meal title
      // Border options for nutrition
      mealBorder?: {
        enabled?: boolean;
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed' | 'dotted' | 'double';
        radius?: number;
      };
      foodItemBorder?: {
        enabled?: boolean;
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed' | 'dotted' | 'double';
        radius?: number;
      };
      // Food items layout and display options
      foodItemsLayout?: 'vertical' | 'horizontal' | 'table' | 'vertical-with-macros' | 'horizontal-calories-vertical-macros';
      // Meal table styling
      mealTableBorder?: {
        enabled?: boolean;
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed' | 'dotted' | 'double';
        radius?: number;
        headerBackground?: string;
        headerTextColor?: string;
        rowStripeColor?: string;
      };
      // Advanced positioning for nutrition
      mealTablePosition?: {
        x?: number; // X position of table start (in pixels)
        y?: number; // Y position of table start (in pixels)
      };
      // Advanced spacing for nutrition
      spacingBetweenFoodItems?: number; // Spacing between food items
      spacingBetweenFoodItemAndMacros?: number; // Spacing between food item name and macros
      spacingBetweenMacros?: number; // Spacing between macro values (calories, protein, carbs, fat)
      // Advanced spacing options (shared)
      contentPaddingTop?: number; // Top padding for content area
      contentPaddingBottom?: number; // Bottom padding for content area
      contentPaddingLeft?: number; // Left padding for content area
      contentPaddingRight?: number; // Right padding for content area
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
      mealSpacing?: number; // Vertical spacing between meals
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
    layoutPreset?: 'clean' | 'compact' | 'spacious' | 'card';
    typography?: {
      lineHeight?: number; // Line height multiplier (e.g., 1.5 = 150%)
      letterSpacing?: number; // Letter spacing in points
      wordSpacing?: number; // Word spacing in points
      textShadow?: {
        enabled?: boolean;
        offsetX?: number; // Shadow offset X in points
        offsetY?: number; // Shadow offset Y in points
        blur?: number; // Shadow blur radius
        color?: string; // Shadow color (hex)
        opacity?: number; // Shadow opacity (0-1)
      };
      fontWeights?: {
        normal?: 'light' | 'regular' | 'medium' | 'bold';
        bold?: 'medium' | 'bold' | 'extrabold';
      };
    };
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

// Reusable Button Manager Component
function ButtonManager({
  buttons,
  onButtonsChange,
  pageType = 'Page',
}: {
  buttons: ButtonConfig[];
  onButtonsChange: (buttons: ButtonConfig[]) => void;
  pageType?: string;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Buttons ({pageType})
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={() => {
            onButtonsChange([...buttons, {
              id: `btn-${Date.now()}`,
              label: 'Button',
              link: '',
              x: 100,
              y: 100,
              style: {
                backgroundColor: '#1976d2',
                textColor: '#ffffff',
                borderColor: '#1976d2',
                borderWidth: 1,
                borderRadius: 4,
                fontSize: 14,
                padding: 8,
              }
            }]);
          }}
        >
          Add Button
        </Button>
      </Box>
      
      {buttons.map((button, index) => (
        <Card key={button.id} sx={{ mb: 2, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Button {index + 1}
            </Typography>
            <IconButton
              size="small"
              color="error"
              onClick={() => onButtonsChange(buttons.filter(b => b.id !== button.id))}
            >
              <Delete />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Button Label"
                value={button.label}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].label = e.target.value;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Link URL"
                value={button.link}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].link = e.target.value;
                  onButtonsChange(updated);
                }}
                size="small"
                placeholder="https://example.com"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="X Position (px)"
                type="number"
                value={button.x}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].x = parseInt(e.target.value) || 0;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Y Position (px)"
                type="number"
                value={button.y}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].y = parseInt(e.target.value) || 0;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Width (px)"
                type="number"
                value={button.width || ''}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].width = e.target.value ? parseInt(e.target.value) : undefined;
                  onButtonsChange(updated);
                }}
                size="small"
                placeholder="Auto"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Height (px)"
                type="number"
                value={button.height || ''}
                onChange={(e) => {
                  const updated = [...buttons];
                  updated[index].height = e.target.value ? parseInt(e.target.value) : undefined;
                  onButtonsChange(updated);
                }}
                size="small"
                placeholder="Auto"
              />
            </Grid>
            
            {/* Button Style */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Button Style
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Background Color"
                type="color"
                value={button.style?.backgroundColor || '#1976d2'}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.backgroundColor = e.target.value;
                  onButtonsChange(updated);
                }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Text Color"
                type="color"
                value={button.style?.textColor || '#ffffff'}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.textColor = e.target.value;
                  onButtonsChange(updated);
                }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Border Color"
                type="color"
                value={button.style?.borderColor || '#1976d2'}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.borderColor = e.target.value;
                  onButtonsChange(updated);
                }}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Border Width (px)"
                type="number"
                value={button.style?.borderWidth || 1}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.borderWidth = parseInt(e.target.value) || 0;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Border Radius (px)"
                type="number"
                value={button.style?.borderRadius || 4}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.borderRadius = parseInt(e.target.value) || 0;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Font Size (px)"
                type="number"
                value={button.style?.fontSize || 14}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.fontSize = parseInt(e.target.value) || 12;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Padding (px)"
                type="number"
                value={button.style?.padding || 8}
                onChange={(e) => {
                  const updated = [...buttons];
                  if (!updated[index].style) updated[index].style = {};
                  updated[index].style!.padding = parseInt(e.target.value) || 0;
                  onButtonsChange(updated);
                }}
                size="small"
              />
            </Grid>
          </Grid>
        </Card>
      ))}
      
      {buttons.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50', border: '2px dashed', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            No buttons added. Click "Add Button" to add a clickable button with a link to this page.
          </Typography>
        </Paper>
      )}
    </Box>
  );
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
  const previewAbortControllerRef = useRef<AbortController | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showPreviewFullscreen, setShowPreviewFullscreen] = useState(false);
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
          showSetNotes: false, // Notes column disabled by default
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
          exerciseSpacing: 10,
          mealSpacing: 10,
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
        layoutPreset: 'clean',
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
        typography: {
          lineHeight: 1.5,
          letterSpacing: 0,
          wordSpacing: 0,
          textShadow: {
            enabled: false,
            offsetX: 2,
            offsetY: 2,
            blur: 3,
            color: '#000000',
            opacity: 0.5,
          },
          fontWeights: {
            normal: 'regular',
            bold: 'bold',
          },
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

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('Image size must be less than 50MB');
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
    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('Image size must be less than 50MB');
      return;
    }
    
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
    // Cancel any ongoing preview generation
    if (previewAbortControllerRef.current) {
      previewAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    previewAbortControllerRef.current = abortController;

    try {
      setGeneratingPreview(true);
      
      // Build final config with image URLs
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

      // Clean up undefined values to avoid sending them to the server
      const cleanConfig = JSON.parse(JSON.stringify(finalConfig));

      console.log('[Preview] Generating preview with config:', cleanConfig);
      console.log('[Preview] Kind:', kind);
      console.log('[Preview] Workspace name:', workspaces[0]?.name);

      // Use new direct preview endpoint (no templateId required)
      const { previewUrl } = await previewVisualPdfFromConfig(
        cleanConfig,
        kind,
        workspaces[0]?.name,
        abortController.signal
      );
      
      // Only update if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setPreviewUrl(previewUrl);
        // Reset zoom and pan when new preview loads
        setPreviewZoom(100);
        setPreviewPan({ x: 0, y: 0 });
        console.log('[Preview] Preview generated successfully:', previewUrl);
      }
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('[Preview] Failed to generate preview:', error);
      console.error('[Preview] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        config: error.config,
      });
      
      if (showError) {
        let errorMessage = 'Failed to generate preview. Please try again.';
        
        // Handle timeout errors
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('504')) {
          errorMessage = 'Preview generation is taking too long. This might be due to:\n\n' +
                        '• Large PDF content\n' +
                        '• Complex formatting\n' +
                        '• Server processing time\n\n' +
                        'Please try again or simplify your template configuration.';
        } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          errorMessage = 'Network error occurred. Please check your connection and try again.';
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setGeneratingPreview(false);
      }
    }
  };

  const handleGeneratePreview = () => {
    generatePreviewInternal(true);
  };

  // Auto-preview on config change (debounced) - Now works without templateId!
  useEffect(() => {
    // Only auto-preview if enabled
    if (!autoPreviewEnabled) {
      return;
    }

    // Clear existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Set new timeout for debounced preview (reduced to 800ms for better responsiveness)
    previewTimeoutRef.current = setTimeout(() => {
      generatePreviewInternal(false); // Don't show errors for auto-preview
    }, 800); // 800ms delay for better real-time feel

    // Cleanup
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [config, introImageUrl, endImageUrl, dayImageUrl, autoPreviewEnabled, kind]);

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

  const templateNameHelpAdornment = (
    <Tooltip title="This name will be displayed in the template list">
      <HelpOutline fontSize="small" color="action" sx={{ cursor: 'help' }} />
    </Tooltip>
  );

  const colorHashAdornment = (
    <Typography sx={{ mr: 1, color: 'text.secondary' }}>#</Typography>
  );

  const ptAdornment = (
    <Typography variant="body2" sx={{ ml: 1 }}>
      pt
    </Typography>
  );

  // High-level layout presets to quickly adjust margins, density, and font sizes
  const applyLayoutPreset = (preset: 'clean' | 'compact' | 'spacious' | 'card') => {
    setConfig((prev) => {
      const next: VisualPdfConfig = {
        ...prev,
        dayPages: {
          ...prev.dayPages,
          fontSize: {
            dayTitle: prev.dayPages.fontSize?.dayTitle ?? 18,
            exerciseName: prev.dayPages.fontSize?.exerciseName ?? 12,
            details: prev.dayPages.fontSize?.details ?? 10,
          },
        },
        options: {
          ...prev.options,
          layoutPreset: preset,
          margins: {
            top: prev.options.margins?.top ?? 50,
            bottom: prev.options.margins?.bottom ?? 50,
            left: prev.options.margins?.left ?? 50,
            right: prev.options.margins?.right ?? 50,
          },
        },
      };

      const margins = next.options.margins!;

      switch (preset) {
        case 'clean':
          margins.top = 50;
          margins.bottom = 50;
          margins.left = 50;
          margins.right = 50;
          next.dayPages.fontSize = {
            dayTitle: 18,
            exerciseName: 12,
            details: 10,
          };
          next.dayPages.daysPerPage = 1;
          break;
        case 'compact':
          margins.top = 35;
          margins.bottom = 35;
          margins.left = 35;
          margins.right = 35;
          next.dayPages.fontSize = {
            dayTitle: 16,
            exerciseName: 10,
            details: 8,
          };
          next.dayPages.daysPerPage = Math.min(3, Math.max(2, next.dayPages.daysPerPage || 2));
          break;
        case 'spacious':
          margins.top = 70;
          margins.bottom = 70;
          margins.left = 60;
          margins.right = 60;
          next.dayPages.fontSize = {
            dayTitle: 22,
            exerciseName: 14,
            details: 12,
          };
          next.dayPages.daysPerPage = 1;
          break;
        case 'card':
          margins.top = 45;
          margins.bottom = 45;
          margins.left = 40;
          margins.right = 40;
          next.dayPages.fontSize = {
            dayTitle: 20,
            exerciseName: 12,
            details: 10,
          };
          next.dayPages.daysPerPage = 2;
          break;
      }

      return next;
    });
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: 'grey.50',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      pb: 4
    }}>
      <Box sx={{ maxWidth: 1600, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* Enhanced Header with Modern Design */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 2.5, md: 4 }, 
            mb: 3, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
              pointerEvents: 'none'
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 280 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 2, 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <Settings sx={{ fontSize: 28, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 0.5, letterSpacing: '-0.02em' }}>
                      PDF Template Builder
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                      Design professional {kind === 'workout' ? 'workout' : 'nutrition'} plan templates
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip 
                    icon={<CheckCircle sx={{ color: 'white !important' }} />}
                    label={`Step ${activeStep + 1} of ${steps.length}`}
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.25)', 
                      color: 'white',
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  />
                  <Chip 
                    icon={kind === 'workout' ? <ViewDay sx={{ color: 'white !important' }} /> : <TableChart sx={{ color: 'white !important' }} />}
                    label={kind === 'workout' ? 'Workout Plan' : 'Nutrition Plan'}
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.25)', 
                      color: 'white',
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 1, 
                    bgcolor: 'rgba(255,255,255,0.15)', 
                    borderRadius: 2,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={autoPreviewEnabled}
                        onChange={(e) => setAutoPreviewEnabled(e.target.checked)}
                        size="small"
                        sx={{ 
                          color: 'white', 
                          '&.Mui-checked': { color: 'white' },
                          '& .MuiSvgIcon-root': { fontSize: 20 }
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, fontSize: '0.875rem' }}>
                        Auto-preview
                      </Typography>
                    }
                  />
                </Paper>
                <Button
                  variant="contained"
                  startIcon={generatingPreview ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <Preview />}
                  onClick={handleGeneratePreview}
                  disabled={generatingPreview}
                  size="medium"
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.25)', 
                    color: 'white',
                    fontWeight: 600,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    px: 2.5,
                    py: 1,
                    '&:hover': { 
                      bgcolor: 'rgba(255,255,255,0.35)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {generatingPreview ? 'Generating...' : 'Generate Preview'}
                </Button>
              </Box>
            </Box>
          </Box>
        </Paper>

      {/* Main Content with Preview on Left */}
      <Grid container spacing={3}>
        {/* Left Side: PDF Preview - Always Visible */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper 
            elevation={0}
            sx={{ 
              position: 'sticky',
              top: 20,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: generatingPreview ? 'warning.main' : (previewUrl ? 'success.main' : 'grey.300'),
              borderRadius: 3,
              maxHeight: 'calc(100vh - 40px)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '500px',
              bgcolor: 'white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)'
              }
            }}
          >
            {/* Preview Header */}
            <Box sx={{ 
              bgcolor: generatingPreview 
                ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' 
                : (previewUrl 
                  ? 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' 
                  : 'linear-gradient(135deg, #757575 0%, #616161 100%)'), 
              color: 'white', 
              p: 2, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {generatingPreview ? (
                  <>
                    <CircularProgress size={16} sx={{ color: 'white' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Generating Preview...
                    </Typography>
                  </>
                ) : previewUrl ? (
                  <>
                    <CheckCircle fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Live Preview
                    </Typography>
                  </>
                ) : (
                  <>
                    <Preview fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      PDF Preview
                    </Typography>
                  </>
                )}
              </Box>
              {previewUrl && (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Zoom Controls */}
                  <Tooltip title="Zoom Out">
                    <IconButton
                      size="small"
                      onClick={() => setPreviewZoom(Math.max(25, previewZoom - 25))}
                      sx={{ color: 'white' }}
                    >
                      <ZoomOut />
                    </IconButton>
                  </Tooltip>
                  <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center', fontSize: '0.75rem' }}>
                    {previewZoom}%
                  </Typography>
                  <Tooltip title="Zoom In">
                    <IconButton
                      size="small"
                      onClick={() => setPreviewZoom(Math.min(300, previewZoom + 25))}
                      sx={{ color: 'white' }}
                    >
                      <ZoomIn />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset Zoom">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setPreviewZoom(100);
                        setPreviewPan({ x: 0, y: 0 });
                      }}
                      sx={{ color: 'white' }}
                    >
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip title="Fullscreen">
                    <IconButton
                      size="small"
                      onClick={() => setShowPreviewFullscreen(true)}
                      sx={{ color: 'white' }}
                    >
                      <Fullscreen />
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => window.open(previewUrl, '_blank')}
                    sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, ml: 0.5 }}
                  >
                    Open
                  </Button>
                </Box>
              )}
            </Box>
            
            {/* Preview Content */}
            {previewUrl ? (
              <Box sx={{ 
                position: 'relative', 
                bgcolor: '#f5f5f5',
                flex: 1,
                minHeight: '500px',
                maxHeight: 'calc(100vh - 120px)',
                overflow: 'auto',
                cursor: isPanning ? 'grabbing' : 'grab'
              }}
                onMouseDown={(e) => {
                  if (previewZoom > 100) {
                    setIsPanning(true);
                    setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
                  }
                }}
                onMouseMove={(e) => {
                  if (isPanning && previewZoom > 100) {
                    setPreviewPan({
                      x: e.clientX - panStart.x,
                      y: e.clientY - panStart.y,
                    });
                  }
                }}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
              >
                <Box
                  sx={{
                    transform: `scale(${previewZoom / 100}) translate(${previewPan.x / (previewZoom / 100)}px, ${previewPan.y / (previewZoom / 100)}px)`,
                    transformOrigin: 'top left',
                    width: `${100 / (previewZoom / 100)}%`,
                    minHeight: '500px',
                    transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <iframe 
                    src={previewUrl} 
                    width="100%" 
                    height="100%"
                    style={{ border: 'none', display: 'block', minHeight: '500px' }}
                    title="PDF Preview"
                  />
                </Box>
              </Box>
            ) : generatingPreview ? (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '500px',
                bgcolor: '#f5f5f5',
                flex: 1
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Generating preview PDF...
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '500px',
                bgcolor: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                flex: 1,
                p: 4,
                textAlign: 'center',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 50% 50%, rgba(102, 126, 234, 0.05) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }
              }}>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'rgba(102, 126, 234, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}>
                    <Preview sx={{ fontSize: 40, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                    PDF Preview
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 300, mx: 'auto' }}>
                    Click "Generate Preview" in the header to see your PDF template as you make changes
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Preview />}
                    onClick={handleGeneratePreview}
                    disabled={generatingPreview}
                    size="medium"
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    Generate Preview
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Side: Builder Form */}
        <Grid item xs={12} md={7} lg={8}>
          <Paper 
            elevation={0}
            sx={{
              bgcolor: 'white',
              borderRadius: 3,
              p: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <Stepper 
              activeStep={activeStep} 
              orientation="vertical"
              sx={{
                '& .MuiStep-root': {
                  '& .MuiStepLabel-root': {
                    '& .MuiStepLabel-label': {
                      fontSize: '1rem',
                      fontWeight: 500
                    }
                  },
                  '& .MuiStepContent-root': {
                    borderLeft: '2px solid',
                    borderColor: 'divider',
                    ml: 2.5,
                    pl: 4,
                    mt: 2
                  },
                  '&.Mui-active .MuiStepContent-root': {
                    borderColor: 'primary.main'
                  },
                  '&.Mui-completed .MuiStepContent-root': {
                    borderColor: 'success.main'
                  }
                }
              }}
            >
        {/* Step 1: General Settings */}
        <Step>
          <StepLabel
            StepIconComponent={() => (
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: activeStep === 0 ? 'primary.main' : activeStep > 0 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 0 || activeStep > 0 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                cursor: 'pointer',
                boxShadow: activeStep === 0 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 4
                }
              }}>
                {activeStep > 0 ? <CheckCircle /> : <Settings />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 0 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
                transition: 'color 0.2s'
              }}
            >
              General Settings
            </Typography>
          </StepLabel>
          <StepContent>
            <Card 
              elevation={0}
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: 'primary.main',
                      },
                      '&.Mui-focused fieldset': {
                        borderWidth: 2,
                      }
                    }
                  }}
                  required
                  helperText="Give your template a descriptive name"
                  InputProps={{
                    endAdornment: templateNameHelpAdornment,
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

                  {/* Layout Presets */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }}>
                      <Chip icon={<ViewDay />} label="Layout Presets" size="small" />
                    </Divider>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                      {[
                        {
                          id: 'clean' as const,
                          title: 'Clean',
                          description: 'Balanced margins, 1 day per page, medium fonts.',
                        },
                        {
                          id: 'compact' as const,
                          title: 'Compact',
                          description: 'Smaller margins and fonts, fits more content.',
                        },
                        {
                          id: 'spacious' as const,
                          title: 'Spacious',
                          description: 'Large margins and fonts for a premium look.',
                        },
                        {
                          id: 'card' as const,
                          title: 'Card Layout',
                          description: 'Two days per page with comfortable spacing.',
                        },
                      ].map((preset) => {
                        const selected = config.options.layoutPreset === preset.id;
                        return (
                          <Card
                            key={preset.id}
                            variant={selected ? 'outlined' : 'elevation'}
                            sx={{
                              borderRadius: 2,
                              border: '2px solid',
                              borderColor: selected ? 'primary.main' : 'divider',
                              boxShadow: selected ? 4 : 1,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                boxShadow: 6,
                                borderColor: 'primary.main',
                              },
                            }}
                            onClick={() => applyLayoutPreset(preset.id)}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <ViewDay color="primary" fontSize="small" />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {preset.title}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                {preset.description}
                              </Typography>
                              <Button
                                size="small"
                                variant={selected ? 'contained' : 'outlined'}
                                color="primary"
                                fullWidth
                              >
                                {selected ? 'Selected' : 'Apply'}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  </Grid>

                  {/* Typography Controls */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Advanced Typography
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Line Height"
                      value={config.options.typography?.lineHeight || 1.5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          options: {
                            ...config.options,
                            typography: {
                              ...config.options.typography,
                              lineHeight: parseFloat(e.target.value) || 1.5,
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0.5, max: 3, step: 0.1 }}
                      helperText="Line height multiplier (1.5 = 150%)"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Letter Spacing (pt)"
                      value={config.options.typography?.letterSpacing || 0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          options: {
                            ...config.options,
                            typography: {
                              ...config.options.typography,
                              letterSpacing: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      inputProps={{ min: -5, max: 10, step: 0.5 }}
                      helperText="Space between letters in points"
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Word Spacing (pt)"
                      value={config.options.typography?.wordSpacing || 0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          options: {
                            ...config.options,
                            typography: {
                              ...config.options.typography,
                              wordSpacing: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0, max: 20, step: 0.5 }}
                      helperText="Space between words in points"
                    />
                  </Grid>

                  {/* Text Shadow Controls */}
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.options.typography?.textShadow?.enabled || false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                typography: {
                                  ...config.options.typography,
                                  textShadow: {
                                    ...config.options.typography?.textShadow,
                                    enabled: e.target.checked,
                                    offsetX: config.options.typography?.textShadow?.offsetX || 2,
                                    offsetY: config.options.typography?.textShadow?.offsetY || 2,
                                    blur: config.options.typography?.textShadow?.blur || 3,
                                    color: config.options.typography?.textShadow?.color || '#000000',
                                    opacity: config.options.typography?.textShadow?.opacity ?? 0.5,
                                  },
                                },
                              },
                            })
                          }
                        />
                      }
                      label="Enable Text Shadow"
                      sx={{ mb: 2 }}
                    />
                  </Grid>

                  {config.options.typography?.textShadow?.enabled && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Shadow Offset X (pt)"
                          value={config.options.typography?.textShadow?.offsetX || 2}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                typography: {
                                  ...config.options.typography,
                                  textShadow: {
                                    ...config.options.typography?.textShadow!,
                                    offsetX: parseFloat(e.target.value) || 0,
                                  },
                                },
                              },
                            })
                          }
                          inputProps={{ min: -10, max: 10, step: 0.5 }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Shadow Offset Y (pt)"
                          value={config.options.typography?.textShadow?.offsetY || 2}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                typography: {
                                  ...config.options.typography,
                                  textShadow: {
                                    ...config.options.typography?.textShadow!,
                                    offsetY: parseFloat(e.target.value) || 0,
                                  },
                                },
                              },
                            })
                          }
                          inputProps={{ min: -10, max: 10, step: 0.5 }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Shadow Blur (pt)"
                          value={config.options.typography?.textShadow?.blur || 3}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                typography: {
                                  ...config.options.typography,
                                  textShadow: {
                                    ...config.options.typography?.textShadow!,
                                    blur: parseFloat(e.target.value) || 0,
                                  },
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 20, step: 0.5 }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1, fontWeight: 600 }}>
                            Shadow Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 50,
                                height: 50,
                                borderRadius: 1,
                                border: '2px solid',
                                borderColor: 'divider',
                                bgcolor: config.options.typography?.textShadow?.color || '#000000',
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'color';
                                input.value = config.options.typography?.textShadow?.color || '#000000';
                                input.onchange = (e: any) =>
                                  setConfig({
                                    ...config,
                                    options: {
                                      ...config.options,
                                      typography: {
                                        ...config.options.typography,
                                        textShadow: {
                                          ...config.options.typography?.textShadow!,
                                          color: e.target.value,
                                        },
                                      },
                                    },
                                  });
                                input.click();
                              }}
                            />
                            <TextField
                              size="small"
                              value={config.options.typography?.textShadow?.color || '#000000'}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  options: {
                                    ...config.options,
                                    typography: {
                                      ...config.options.typography,
                                      textShadow: {
                                        ...config.options.typography?.textShadow!,
                                        color: e.target.value,
                                      },
                                    },
                                  },
                                })
                              }
                            />
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Shadow Opacity"
                          value={(config.options.typography?.textShadow?.opacity ?? 0.5) * 100}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                typography: {
                                  ...config.options.typography,
                                  textShadow: {
                                    ...config.options.typography?.textShadow!,
                                    opacity: (parseFloat(e.target.value) || 50) / 100,
                                  },
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100, step: 5 }}
                          helperText="0-100%"
                        />
                      </Grid>
                    </>
                  )}

                  {/* Font Weight Controls */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      Font Weights
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Normal Text Weight</InputLabel>
                      <Select
                        value={config.options.typography?.fontWeights?.normal || 'regular'}
                        label="Normal Text Weight"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              typography: {
                                ...config.options.typography,
                                fontWeights: {
                                  ...config.options.typography?.fontWeights,
                                  normal: e.target.value as any,
                                },
                              },
                            },
                          })
                        }
                      >
                        <MenuItem value="light">Light</MenuItem>
                        <MenuItem value="regular">Regular</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="bold">Bold</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Bold Text Weight</InputLabel>
                      <Select
                        value={config.options.typography?.fontWeights?.bold || 'bold'}
                        label="Bold Text Weight"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              typography: {
                                ...config.options.typography,
                                fontWeights: {
                                  ...config.options.typography?.fontWeights,
                                  bold: e.target.value as any,
                                },
                              },
                            },
                          })
                        }
                      >
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="bold">Bold</MenuItem>
                        <MenuItem value="extrabold">Extra Bold</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
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
                            startAdornment: colorHashAdornment,
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
                            startAdornment: colorHashAdornment,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Used for text and borders
                      </Typography>
                    </Paper>
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
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                bgcolor: activeStep === 1 ? 'primary.main' : activeStep > 1 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 1 || activeStep > 1 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s ease-in-out',
                cursor: 'pointer',
                boxShadow: activeStep === 1 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: activeStep === 1 ? '0 6px 16px rgba(102, 126, 234, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
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
            <Card 
              elevation={0}
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                    <Paper 
                      elevation={0} 
                      sx={{ 
                        p: 2.5, 
                        mb: 3, 
                        bgcolor: config.introPage?.enabled ? 'success.50' : 'grey.50',
                        border: '2px solid',
                        borderColor: config.introPage?.enabled ? 'success.main' : 'grey.200',
                        borderRadius: 2,
                        transition: 'all 0.3s',
                        '&:hover': {
                          borderColor: config.introPage?.enabled ? 'success.dark' : 'grey.300',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                        }
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
                              endAdornment: ptAdornment,
                              sx: { fontSize: '16px' },
                            }}
                            helperText="Size in points (default: 32)"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}
                
                {/* Buttons Section for Intro Page */}
                {config.introPage?.enabled && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 3 }} />
                    <ButtonManager
                      buttons={config.introPage.buttons || []}
                      onButtonsChange={(buttons) =>
                        setConfig({
                          ...config,
                          introPage: {
                            ...config.introPage!,
                            buttons: buttons.length > 0 ? buttons : undefined,
                          },
                        })
                      }
                      pageType="Intro Page"
                    />
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ 
                  minWidth: 120,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ 
                  minWidth: 140,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
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
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                bgcolor: activeStep === 2 ? 'primary.main' : activeStep > 2 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 2 || activeStep > 2 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s ease-in-out',
                cursor: 'pointer',
                boxShadow: activeStep === 2 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: activeStep === 2 ? '0 6px 16px rgba(102, 126, 234, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
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
            <Card 
              elevation={0}
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
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

            <Box sx={{ mb: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ 
                  minWidth: 120,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ 
                  minWidth: 140,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
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
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                bgcolor: activeStep === 3 ? 'primary.main' : activeStep > 3 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 3 || activeStep > 3 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s ease-in-out',
                cursor: 'pointer',
                boxShadow: activeStep === 3 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: activeStep === 3 ? '0 6px 16px rgba(102, 126, 234, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ViewDay sx={{ color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Day/Content Page Layout
                  </Typography>
                </Box>

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

                  {kind === 'nutrition' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Meals Per Page</InputLabel>
                          <Select
                            value={config.dayPages.mealsPerPage || ''}
                            label="Meals Per Page"
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                dayPages: {
                                  ...config.dayPages,
                                  mealsPerPage: e.target.value === '' ? undefined : (e.target.value as number),
                                },
                              })
                            }
                          >
                            <MenuItem value="">Unlimited</MenuItem>
                            <MenuItem value={1}>1 Meal</MenuItem>
                            <MenuItem value={2}>2 Meals</MenuItem>
                            <MenuItem value={3}>3 Meals</MenuItem>
                            <MenuItem value={4}>4 Meals</MenuItem>
                            <MenuItem value={5}>5 Meals</MenuItem>
                            <MenuItem value={6}>6 Meals</MenuItem>
                          </Select>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Start a new page after this many meals. If a meal is too large, it will continue on the next page.
                          </Typography>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Food Items Per Meal</InputLabel>
                          <Select
                            value={config.dayPages.foodItemsPerMeal || ''}
                            label="Food Items Per Meal"
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                dayPages: {
                                  ...config.dayPages,
                                  foodItemsPerMeal: e.target.value === '' ? undefined : (e.target.value as number),
                                },
                              })
                            }
                          >
                            <MenuItem value="">Unlimited</MenuItem>
                            <MenuItem value={3}>3 Items</MenuItem>
                            <MenuItem value={5}>5 Items</MenuItem>
                            <MenuItem value={8}>8 Items</MenuItem>
                            <MenuItem value={10}>10 Items</MenuItem>
                            <MenuItem value={12}>12 Items</MenuItem>
                            <MenuItem value={15}>15 Items</MenuItem>
                            <MenuItem value={20}>20 Items</MenuItem>
                          </Select>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            Maximum food items per meal before continuing on next page. If a meal exceeds this, it will split across pages.
                          </Typography>
                        </FormControl>
                      </Grid>
                    </>
                  )}

                  {/* Spacing Controls */}
                  <Grid item xs={12}>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Spacing
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Control vertical spacing between items to make the layout more compact or more airy.
                      </Typography>
                    </Box>
                  </Grid>

                  {kind === 'workout' && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Exercise Spacing (px)"
                        value={config.dayPages.options.exerciseSpacing ?? 10}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dayPages: {
                              ...config.dayPages,
                              options: {
                                ...config.dayPages.options,
                                exerciseSpacing: Math.max(0, parseInt(e.target.value) || 0),
                              },
                            },
                          })
                        }
                        inputProps={{ min: 0, max: 40 }}
                        helperText="Vertical space between exercises"
                      />
                    </Grid>
                  )}

                  {kind === 'nutrition' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Meal Spacing (px)"
                          value={config.dayPages.options.mealSpacing ?? 10}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  mealSpacing: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Vertical space between meals"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Food Item Spacing (px)"
                          value={config.dayPages.options.foodItemSpacing ?? 5}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  foodItemSpacing: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 50 }}
                          helperText="Vertical space between food items within a meal"
                        />
                      </Grid>
                    </>
                  )}
                  
                  {/* Advanced Spacing Controls */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      Advanced Spacing & Positioning
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Fine-tune content positioning and spacing for better layout control
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Content Padding Top (px)"
                      value={config.dayPages.options.contentPaddingTop ?? 20}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            options: {
                              ...config.dayPages.options,
                              contentPaddingTop: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0, max: 200 }}
                      helperText="Top padding for content area"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Content Padding Bottom (px)"
                      value={config.dayPages.options.contentPaddingBottom ?? 20}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            options: {
                              ...config.dayPages.options,
                              contentPaddingBottom: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0, max: 200 }}
                      helperText="Bottom padding for content area"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Content Padding Left (px)"
                      value={config.dayPages.options.contentPaddingLeft ?? 20}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            options: {
                              ...config.dayPages.options,
                              contentPaddingLeft: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0, max: 200 }}
                      helperText="Left padding for content area"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Content Padding Right (px)"
                      value={config.dayPages.options.contentPaddingRight ?? 20}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dayPages: {
                            ...config.dayPages,
                            options: {
                              ...config.dayPages.options,
                              contentPaddingRight: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      inputProps={{ min: 0, max: 200 }}
                      helperText="Right padding for content area"
                    />
                  </Grid>
                  
                  {kind === 'nutrition' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Meal Title Margin Top (px)"
                          value={config.dayPages.options.mealTitleMarginTop ?? 15}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  mealTitleMarginTop: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Space above meal title"
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Meal Title Margin Bottom (px)"
                          value={config.dayPages.options.mealTitleMarginBottom ?? 10}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  mealTitleMarginBottom: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Space below meal title"
                        />
                      </Grid>
                    </>
                  )}
                  
                  {kind === 'workout' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Exercise Title Margin Top (px)"
                          value={config.dayPages.options.exerciseTitleMarginTop ?? 15}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  exerciseTitleMarginTop: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Space above exercise title"
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Exercise Title Margin Bottom (px)"
                          value={config.dayPages.options.exerciseTitleMarginBottom ?? 10}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                options: {
                                  ...config.dayPages.options,
                                  exerciseTitleMarginBottom: Math.max(0, parseInt(e.target.value) || 0),
                                },
                              },
                            })
                          }
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Space below exercise title"
                        />
                      </Grid>
                    </>
                  )}

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

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 3 }}>
                      <TableChart sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Set Table Columns
                      </Typography>
                    </Box>
                    <Grid container spacing={1}>
                      <Grid item xs={12}>
                      <Alert 
                        severity="info" 
                        sx={{ 
                          fontSize: '0.875rem', 
                          mb: 2,
                          borderRadius: 2,
                          bgcolor: 'info.50',
                          border: '1px solid',
                          borderColor: 'info.200',
                          '& .MuiAlert-icon': {
                            color: 'info.main'
                          }
                        }}
                        icon={<HelpOutline />}
                      >
                        The table always includes <strong>Set #</strong> and <strong>Reps</strong>. Toggle the additional columns below to customize what appears in the workout table.
                      </Alert>
                      </Grid>
                      <Grid item xs={12}>
                        <Card 
                          variant="outlined" 
                          sx={{ 
                            p: 2.5, 
                            bgcolor: 'grey.50',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              bgcolor: 'grey.100',
                              borderColor: 'primary.light',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                            }
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 600 }}>
                            Always Visible Columns:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                            <Chip label="Set #" size="small" color="primary" />
                            <Chip label="Reps" size="small" color="primary" />
                          </Box>
                          
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontWeight: 600 }}>
                            Optional Columns (Toggle to show/hide):
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={4}>
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
                                label={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      Rest
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Rest time between sets
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
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
                                label={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      Tempo
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Movement tempo (e.g., 2-0-1-0)
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
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
                                label={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      RIR
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Reps in Reserve
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={config.dayPages.options.showSetNotes !== false}
                                    onChange={(e) =>
                                      setConfig((prev) => ({
                                        ...prev,
                                        dayPages: {
                                          ...prev.dayPages,
                                          options: {
                                            ...prev.dayPages.options,
                                            showSetNotes: e.target.checked,
                                          },
                                        },
                                      }))
                                    }
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      Notes
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Set-specific notes
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Grid>
                          </Grid>
                        </Card>
                      </Grid>
                    </Grid>
                    
                    {/* Exercise Layout Options */}
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Exercise Layout & Display
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Exercise View/Layout</InputLabel>
                          <Select
                            value={config.dayPages.options.exerciseLayout || 'vertical'}
                            label="Exercise View/Layout"
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    exerciseLayout: e.target.value as 'vertical' | 'horizontal' | 'table' | 'compact',
                                  },
                                },
                              }))
                            }
                          >
                            <MenuItem value="vertical">Vertical - Exercises stacked vertically</MenuItem>
                            <MenuItem value="horizontal">Horizontal - Exercises in horizontal rows</MenuItem>
                            <MenuItem value="table">Table Format - Traditional table layout</MenuItem>
                            <MenuItem value="compact">Compact - Minimal spacing, compact view</MenuItem>
                          </Select>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Choose how exercises are displayed in the workout plan
                          </Typography>
                        </FormControl>
                      </Grid>
                    </Grid>
                    
                    {/* Exercise Table Border & Styling */}
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Exercise Table Styling
                    </Typography>
                    
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        mb: 3, 
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Exercise Table Border
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.exerciseTableBorder?.enabled || false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      exerciseTableBorder: {
                                        ...prev.dayPages.options.exerciseTableBorder,
                                        enabled: e.target.checked,
                                        color: prev.dayPages.options.exerciseTableBorder?.color || '#d0d0d0',
                                        width: prev.dayPages.options.exerciseTableBorder?.width || 1,
                                        style: prev.dayPages.options.exerciseTableBorder?.style || 'solid',
                                        radius: prev.dayPages.options.exerciseTableBorder?.radius || 0,
                                        headerBackground: prev.dayPages.options.exerciseTableBorder?.headerBackground || '#f5f5f5',
                                        headerTextColor: prev.dayPages.options.exerciseTableBorder?.headerTextColor || '#000000',
                                        rowStripeColor: prev.dayPages.options.exerciseTableBorder?.rowStripeColor || '#fafafa',
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Enable Table Border"
                        />
                      </Box>
                      
                      {config.dayPages.options.exerciseTableBorder?.enabled && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Border Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.exerciseTableBorder?.color || '#d0d0d0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.exerciseTableBorder?.color || '#d0d0d0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Border Width (px)"
                              value={config.dayPages.options.exerciseTableBorder?.width || 1}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      exerciseTableBorder: {
                                        ...prev.dayPages.options.exerciseTableBorder!,
                                        width: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 10 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Border Radius (px)"
                              value={config.dayPages.options.exerciseTableBorder?.radius || 0}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      exerciseTableBorder: {
                                        ...prev.dayPages.options.exerciseTableBorder!,
                                        radius: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 50 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Border Style</InputLabel>
                              <Select
                                value={config.dayPages.options.exerciseTableBorder?.style || 'solid'}
                                label="Border Style"
                                onChange={(e) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    dayPages: {
                                      ...prev.dayPages,
                                      options: {
                                        ...prev.dayPages.options,
                                        exerciseTableBorder: {
                                          ...prev.dayPages.options.exerciseTableBorder!,
                                          style: e.target.value as 'solid' | 'dashed' | 'dotted' | 'double',
                                        },
                                      },
                                    },
                                  }))
                                }
                              >
                                <MenuItem value="solid">Solid</MenuItem>
                                <MenuItem value="dashed">Dashed</MenuItem>
                                <MenuItem value="dotted">Dotted</MenuItem>
                                <MenuItem value="double">Double</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Header Background Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.exerciseTableBorder?.headerBackground || '#f5f5f5'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            headerBackground: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.exerciseTableBorder?.headerBackground || '#f5f5f5'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            headerBackground: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Header Text Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.exerciseTableBorder?.headerTextColor || '#000000'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            headerTextColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.exerciseTableBorder?.headerTextColor || '#000000'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            headerTextColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Row Stripe Color (Alternating Rows)
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.exerciseTableBorder?.rowStripeColor || '#fafafa'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            rowStripeColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.exerciseTableBorder?.rowStripeColor || '#fafafa'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          exerciseTableBorder: {
                                            ...prev.dayPages.options.exerciseTableBorder!,
                                            rowStripeColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      )}
                    </Card>
                    
                    {/* Advanced Positioning for Workout */}
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Advanced Positioning
                    </Typography>
                    
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        mb: 3, 
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Control the starting position of the exercise table/content area on the page
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Table Start X Position (px)"
                            value={config.dayPages.options.exerciseTablePosition?.x ?? 20}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    exerciseTablePosition: {
                                      ...prev.dayPages.options.exerciseTablePosition,
                                      x: parseInt(e.target.value) || 0,
                                    },
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 1000 }}
                            helperText="Horizontal starting position of the table"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Table Start Y Position (px)"
                            value={config.dayPages.options.exerciseTablePosition?.y ?? 20}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    exerciseTablePosition: {
                                      ...prev.dayPages.options.exerciseTablePosition,
                                      y: parseInt(e.target.value) || 0,
                                    },
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 1000 }}
                            helperText="Vertical starting position of the table"
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Card>
                    
                    {/* Advanced Spacing for Workout */}
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                      Advanced Spacing Controls
                    </Typography>
                    
                    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Fine-tune spacing between exercises and their elements
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Exercises (px)"
                            value={config.dayPages.options.spacingBetweenExercises ?? 15}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenExercises: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 100 }}
                            helperText="Vertical/horizontal space between each exercise"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Exercise & Details (px)"
                            value={config.dayPages.options.spacingBetweenExerciseAndDetails ?? 10}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenExerciseAndDetails: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 100 }}
                            helperText="Space between exercise name and set details"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Set Details (px)"
                            value={config.dayPages.options.spacingBetweenSetDetails ?? 5}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenSetDetails: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 50 }}
                            helperText="Space between set details (reps, rest, tempo, RIR)"
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Card>
                  </>
                )}

                {kind === 'nutrition' && (
                  <>
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TableChart sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Nutrition Content
                      </Typography>
                    </Box>
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
                    
                    {/* Border Options */}
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <Palette sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Border Styling
                      </Typography>
                    </Box>
                    
                    {/* Meal Border */}
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        mb: 3, 
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Meal Border
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.mealBorder?.enabled || false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealBorder: {
                                        ...prev.dayPages.options.mealBorder,
                                        enabled: e.target.checked,
                                        color: prev.dayPages.options.mealBorder?.color || '#e0e0e0',
                                        width: prev.dayPages.options.mealBorder?.width || 1,
                                        style: prev.dayPages.options.mealBorder?.style || 'solid',
                                        radius: prev.dayPages.options.mealBorder?.radius || 0,
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Enable Border"
                        />
                      </Box>
                      
                      {config.dayPages.options.mealBorder?.enabled && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Border Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.mealBorder?.color || '#e0e0e0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealBorder: {
                                            ...prev.dayPages.options.mealBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.mealBorder?.color || '#e0e0e0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealBorder: {
                                            ...prev.dayPages.options.mealBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Width (px)"
                              value={config.dayPages.options.mealBorder?.width || 1}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealBorder: {
                                        ...prev.dayPages.options.mealBorder!,
                                        width: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 10 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Radius (px)"
                              value={config.dayPages.options.mealBorder?.radius || 0}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealBorder: {
                                        ...prev.dayPages.options.mealBorder!,
                                        radius: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 50 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Border Style</InputLabel>
                              <Select
                                value={config.dayPages.options.mealBorder?.style || 'solid'}
                                label="Border Style"
                                onChange={(e) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    dayPages: {
                                      ...prev.dayPages,
                                      options: {
                                        ...prev.dayPages.options,
                                        mealBorder: {
                                          ...prev.dayPages.options.mealBorder!,
                                          style: e.target.value as 'solid' | 'dashed' | 'dotted' | 'double',
                                        },
                                      },
                                    },
                                  }))
                                }
                              >
                                <MenuItem value="solid">Solid</MenuItem>
                                <MenuItem value="dashed">Dashed</MenuItem>
                                <MenuItem value="dotted">Dotted</MenuItem>
                                <MenuItem value="double">Double</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      )}
                    </Card>
                    
                    {/* Food Item Border */}
                    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Food Item Border
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.foodItemBorder?.enabled || false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      foodItemBorder: {
                                        ...prev.dayPages.options.foodItemBorder,
                                        enabled: e.target.checked,
                                        color: prev.dayPages.options.foodItemBorder?.color || '#f0f0f0',
                                        width: prev.dayPages.options.foodItemBorder?.width || 1,
                                        style: prev.dayPages.options.foodItemBorder?.style || 'solid',
                                        radius: prev.dayPages.options.foodItemBorder?.radius || 0,
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Enable Border"
                        />
                      </Box>
                      
                      {config.dayPages.options.foodItemBorder?.enabled && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Border Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.foodItemBorder?.color || '#f0f0f0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          foodItemBorder: {
                                            ...prev.dayPages.options.foodItemBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.foodItemBorder?.color || '#f0f0f0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          foodItemBorder: {
                                            ...prev.dayPages.options.foodItemBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Width (px)"
                              value={config.dayPages.options.foodItemBorder?.width || 1}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      foodItemBorder: {
                                        ...prev.dayPages.options.foodItemBorder!,
                                        width: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 10 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Radius (px)"
                              value={config.dayPages.options.foodItemBorder?.radius || 0}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      foodItemBorder: {
                                        ...prev.dayPages.options.foodItemBorder!,
                                        radius: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 50 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Border Style</InputLabel>
                              <Select
                                value={config.dayPages.options.foodItemBorder?.style || 'solid'}
                                label="Border Style"
                                onChange={(e) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    dayPages: {
                                      ...prev.dayPages,
                                      options: {
                                        ...prev.dayPages.options,
                                        foodItemBorder: {
                                          ...prev.dayPages.options.foodItemBorder!,
                                          style: e.target.value as 'solid' | 'dashed' | 'dotted' | 'double',
                                        },
                                      },
                                    },
                                  }))
                                }
                              >
                                <MenuItem value="solid">Solid</MenuItem>
                                <MenuItem value="dashed">Dashed</MenuItem>
                                <MenuItem value="dotted">Dotted</MenuItem>
                                <MenuItem value="double">Double</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      )}
                    </Card>
                    
                    {/* Food Items Layout Options */}
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <FormatSize sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Food Items Layout & Display
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Food Items View/Layout</InputLabel>
                          <Select
                            value={config.dayPages.options.foodItemsLayout || 'vertical'}
                            label="Food Items View/Layout"
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    foodItemsLayout: e.target.value as 'vertical' | 'horizontal' | 'table' | 'vertical-with-macros' | 'horizontal-calories-vertical-macros',
                                  },
                                },
                              }))
                            }
                          >
                            <MenuItem value="vertical">Vertical - Food items stacked vertically with grams</MenuItem>
                            <MenuItem value="vertical-with-macros">Vertical with Macros - Food items with grams and macros below</MenuItem>
                            <MenuItem value="horizontal">Horizontal - Food items in horizontal rows</MenuItem>
                            <MenuItem value="horizontal-calories-vertical-macros">Horizontal Calories, Vertical Macros - Calories horizontal, other macros vertical</MenuItem>
                            <MenuItem value="table">Table Format - Traditional table layout</MenuItem>
                          </Select>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Choose how food items are displayed in each meal
                          </Typography>
                        </FormControl>
                      </Grid>
                    </Grid>
                    
                    {/* Meal Table Border & Styling */}
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <Image sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Meal Table Styling
                      </Typography>
                    </Box>
                    
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        mb: 3, 
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Meal Table Border
                        </Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.mealTableBorder?.enabled || false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealTableBorder: {
                                        ...prev.dayPages.options.mealTableBorder,
                                        enabled: e.target.checked,
                                        color: prev.dayPages.options.mealTableBorder?.color || '#d0d0d0',
                                        width: prev.dayPages.options.mealTableBorder?.width || 1,
                                        style: prev.dayPages.options.mealTableBorder?.style || 'solid',
                                        radius: prev.dayPages.options.mealTableBorder?.radius || 0,
                                        headerBackground: prev.dayPages.options.mealTableBorder?.headerBackground || '#f5f5f5',
                                        headerTextColor: prev.dayPages.options.mealTableBorder?.headerTextColor || '#000000',
                                        rowStripeColor: prev.dayPages.options.mealTableBorder?.rowStripeColor || '#fafafa',
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          }
                          label="Enable Table Border"
                        />
                      </Box>
                      
                      {config.dayPages.options.mealTableBorder?.enabled && (
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Border Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.mealTableBorder?.color || '#d0d0d0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.mealTableBorder?.color || '#d0d0d0'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            color: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Border Width (px)"
                              value={config.dayPages.options.mealTableBorder?.width || 1}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealTableBorder: {
                                        ...prev.dayPages.options.mealTableBorder!,
                                        width: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 10 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Border Radius (px)"
                              value={config.dayPages.options.mealTableBorder?.radius || 0}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  dayPages: {
                                    ...prev.dayPages,
                                    options: {
                                      ...prev.dayPages.options,
                                      mealTableBorder: {
                                        ...prev.dayPages.options.mealTableBorder!,
                                        radius: Math.max(0, parseInt(e.target.value) || 0),
                                      },
                                    },
                                  },
                                }))
                              }
                              inputProps={{ min: 0, max: 50 }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Border Style</InputLabel>
                              <Select
                                value={config.dayPages.options.mealTableBorder?.style || 'solid'}
                                label="Border Style"
                                onChange={(e) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    dayPages: {
                                      ...prev.dayPages,
                                      options: {
                                        ...prev.dayPages.options,
                                        mealTableBorder: {
                                          ...prev.dayPages.options.mealTableBorder!,
                                          style: e.target.value as 'solid' | 'dashed' | 'dotted' | 'double',
                                        },
                                      },
                                    },
                                  }))
                                }
                              >
                                <MenuItem value="solid">Solid</MenuItem>
                                <MenuItem value="dashed">Dashed</MenuItem>
                                <MenuItem value="dotted">Dotted</MenuItem>
                                <MenuItem value="double">Double</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Header Background Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.mealTableBorder?.headerBackground || '#f5f5f5'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            headerBackground: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.mealTableBorder?.headerBackground || '#f5f5f5'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            headerBackground: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Header Text Color
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.mealTableBorder?.headerTextColor || '#000000'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            headerTextColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.mealTableBorder?.headerTextColor || '#000000'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            headerTextColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box>
                              <Typography variant="caption" gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                                Row Stripe Color (Alternating Rows)
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  type="color"
                                  value={config.dayPages.options.mealTableBorder?.rowStripeColor || '#fafafa'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            rowStripeColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  sx={{ width: 60, '& input': { height: 40, cursor: 'pointer' } }}
                                />
                                <TextField
                                  value={config.dayPages.options.mealTableBorder?.rowStripeColor || '#fafafa'}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      dayPages: {
                                        ...prev.dayPages,
                                        options: {
                                          ...prev.dayPages.options,
                                          mealTableBorder: {
                                            ...prev.dayPages.options.mealTableBorder!,
                                            rowStripeColor: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  size="small"
                                  sx={{ flex: 1 }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      )}
                    </Card>
                    
                    {/* Advanced Positioning */}
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <Settings sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Advanced Positioning
                      </Typography>
                    </Box>
                    
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        mb: 3, 
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: 'white',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Control the starting position of the meal table/content area on the page
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Table Start X Position (px)"
                            value={config.dayPages.options.mealTablePosition?.x ?? 20}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    mealTablePosition: {
                                      ...prev.dayPages.options.mealTablePosition,
                                      x: parseInt(e.target.value) || 0,
                                    },
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 1000 }}
                            helperText="Horizontal starting position of the table"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Table Start Y Position (px)"
                            value={config.dayPages.options.mealTablePosition?.y ?? 20}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    mealTablePosition: {
                                      ...prev.dayPages.options.mealTablePosition,
                                      y: parseInt(e.target.value) || 0,
                                    },
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 1000 }}
                            helperText="Vertical starting position of the table"
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Card>
                    
                    {/* Advanced Spacing */}
                    <Divider sx={{ my: 3, borderWidth: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <FormatSize sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Advanced Spacing Controls
                      </Typography>
                    </Box>
                    
                    <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Fine-tune spacing between food items and their elements
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Food Items (px)"
                            value={config.dayPages.options.spacingBetweenFoodItems ?? 8}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenFoodItems: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 100 }}
                            helperText="Vertical/horizontal space between each food item"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Food Item & Macros (px)"
                            value={config.dayPages.options.spacingBetweenFoodItemAndMacros ?? 10}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenFoodItemAndMacros: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 100 }}
                            helperText="Space between food item name and macro values"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Spacing Between Macros (px)"
                            value={config.dayPages.options.spacingBetweenMacros ?? 5}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                dayPages: {
                                  ...prev.dayPages,
                                  options: {
                                    ...prev.dayPages.options,
                                    spacingBetweenMacros: Math.max(0, parseInt(e.target.value) || 0),
                                  },
                                },
                              }))
                            }
                            inputProps={{ min: 0, max: 50 }}
                            helperText="Space between macro values (calories, protein, carbs, fat)"
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Card>
                  </>
                )}
                
                {/* Buttons Section for Day/Content Pages */}
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 3 }} />
                  <ButtonManager
                    buttons={config.dayPages.buttons || []}
                    onButtonsChange={(buttons) =>
                      setConfig({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          buttons: buttons.length > 0 ? buttons : undefined,
                        },
                      })
                    }
                    pageType="Content Pages"
                  />
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ 
                  minWidth: 120,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ 
                  minWidth: 140,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
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
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                bgcolor: activeStep === 4 ? 'primary.main' : activeStep > 4 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 4 || activeStep > 4 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s ease-in-out',
                cursor: 'pointer',
                boxShadow: activeStep === 4 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: activeStep === 4 ? '0 6px 16px rgba(102, 126, 234, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
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
            <Card 
              elevation={0}
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
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
                
                {/* Buttons Section for End Page */}
                {config.endPage?.enabled && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 3 }} />
                    <ButtonManager
                      buttons={config.endPage.buttons || []}
                      onButtonsChange={(buttons) =>
                        setConfig({
                          ...config,
                          endPage: {
                            ...config.endPage!,
                            buttons: buttons.length > 0 ? buttons : undefined,
                          },
                        })
                      }
                      pageType="End Page"
                    />
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3 }}>
              <Button 
                variant="outlined" 
                onClick={handleBack}
                sx={{ 
                  minWidth: 120,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
                sx={{ 
                  minWidth: 140,
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Continue
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 6: Review & Save */}
        <Step>
          <StepLabel
            StepIconComponent={() => (
              <Box sx={{ 
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                bgcolor: activeStep === 5 ? 'primary.main' : activeStep > 5 ? 'success.main' : 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activeStep === 5 || activeStep > 5 ? 'white' : 'grey.600',
                fontWeight: 'bold',
                transition: 'all 0.3s ease-in-out',
                cursor: 'pointer',
                boxShadow: activeStep === 5 ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: activeStep === 5 ? '0 6px 16px rgba(102, 126, 234, 0.4)' : '0 4px 12px rgba(0,0,0,0.15)'
                }
              }}>
                {activeStep > 5 ? <CheckCircle /> : <CheckCircle />}
              </Box>
            )}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: activeStep === 5 ? 600 : 400,
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
                transition: 'color 0.2s'
              }}
            >
              Review & Save
            </Typography>
          </StepLabel>
          <StepContent>
            <Card 
              elevation={0}
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Settings sx={{ color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Workspace Assignment
                  </Typography>
                </Box>
                
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
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: 'primary.main',
                        boxShadow: '0 2px 12px rgba(102, 126, 234, 0.15)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.2)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                        <Palette sx={{ color: 'primary.main', fontSize: 24 }} />
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
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: 'info.main',
                        boxShadow: '0 2px 12px rgba(33, 150, 243, 0.15)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 4px 20px rgba(33, 150, 243, 0.2)',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
                        <ViewDay sx={{ color: 'info.main', fontSize: 24 }} />
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

                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3, 
                    mb: 3, 
                    bgcolor: 'white', 
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <CheckCircle sx={{ color: 'primary.main', fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Template Summary
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Template Name
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, color: 'text.primary' }}>
                          {templateName || '(Not set)'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Type
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, color: 'text.primary' }}>
                          {kind === 'workout' ? 'Workout Plan' : 'Nutrition Plan'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Assignment
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {isGlobal ? (
                            <Chip label="Global (All Workspaces)" color="success" size="small" sx={{ fontWeight: 600 }} />
                          ) : (
                            <Chip label={`${selectedWorkspaceIds.length} workspace(s)`} size="small" sx={{ fontWeight: 600 }} />
                          )}
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Page Size
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, color: 'text.primary' }}>
                          {config.options.pageSize} ({config.options.orientation})
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Pages Configuration
                        </Typography>
                        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Intro Page:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip
                                label={config.introPage?.enabled ? 'Enabled' : 'Disabled'}
                                color={config.introPage?.enabled ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                              {config.introPage?.enabled && introImageUrl && (
                                <Chip label="+ Image" color="info" size="small" sx={{ fontWeight: 600 }} />
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              End Page:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip
                                label={config.endPage?.enabled ? 'Enabled' : 'Disabled'}
                                color={config.endPage?.enabled ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                              {config.endPage?.enabled && endImageUrl && (
                                <Chip label="+ Image" color="info" size="small" sx={{ fontWeight: 600 }} />
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Content Pages:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Chip 
                                label={`${config.dayPages.daysPerPage} day(s)/page`}
                                size="small"
                                color="primary"
                                sx={{ fontWeight: 600 }}
                              />
                              <Chip 
                                label={config.dayPages.layout}
                                size="small"
                                color="secondary"
                                sx={{ fontWeight: 600 }}
                              />
                              {dayImageUrl && (
                                <Chip label="+ Image" color="info" size="small" sx={{ fontWeight: 600 }} />
                              )}
                            </Box>
                          </Box>
                          {config.customPages && config.customPages.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                Custom Pages:
                              </Typography>
                              <Chip 
                                label={`${config.customPages.filter(p => p.enabled).length} page(s)`}
                                size="small"
                                color="info"
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Review your configuration and click "Save Template" to create your visual PDF template.
                  </Typography>
                </Paper>
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
                sx={{ 
                  minWidth: 180,
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: '0 4px 16px rgba(76, 175, 80, 0.4)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(76, 175, 80, 0.5)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
                size="large"
              >
                Save Template
              </Button>
            </Box>
          </StepContent>
        </Step>
            </Stepper>
          </Paper>
        </Grid>
      </Grid>
      </Box>

      {/* Fullscreen Preview Dialog */}
      <Dialog
        open={showPreviewFullscreen}
        onClose={() => setShowPreviewFullscreen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            m: 0,
            borderRadius: 0,
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'success.main', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}>
          <Typography variant="h6">PDF Preview - Fullscreen</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={() => setPreviewZoom(Math.max(25, previewZoom - 25))} sx={{ color: 'white' }}>
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
              {previewZoom}%
            </Typography>
            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={() => setPreviewZoom(Math.min(300, previewZoom + 25))} sx={{ color: 'white' }}>
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Zoom">
              <IconButton
                size="small"
                onClick={() => {
                  setPreviewZoom(100);
                  setPreviewPan({ x: 0, y: 0 });
                }}
                sx={{ color: 'white' }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setShowPreviewFullscreen(false)} sx={{ color: 'white' }}>
              <FullscreenExit />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f5f5f5', position: 'relative', overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
          {previewUrl && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                cursor: isPanning ? 'grabbing' : 'grab',
                position: 'relative'
              }}
              onMouseDown={(e) => {
                if (previewZoom > 100) {
                  setIsPanning(true);
                  setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isPanning && previewZoom > 100) {
                  setPreviewPan({
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y,
                  });
                }
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <Box
                sx={{
                  transform: `scale(${previewZoom / 100}) translate(${previewPan.x / (previewZoom / 100)}px, ${previewPan.y / (previewZoom / 100)}px)`,
                  transformOrigin: 'top left',
                  width: `${100 / (previewZoom / 100)}%`,
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                <iframe 
                  src={previewUrl} 
                  width="100%" 
                  height="100%"
                  style={{ border: 'none', display: 'block', minHeight: '100vh' }}
                  title="PDF Preview Fullscreen"
                />
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

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
  const [backgroundColorOpacity, setBackgroundColorOpacity] = useState(page?.backgroundColorOpacity ?? 1);
  const [textColor, setTextColor] = useState(page?.textColor || '#000000');
  const [gridEnabled, setGridEnabled] = useState(page?.gridEnabled || false);
  const [gridColumns, setGridColumns] = useState(page?.gridColumns || 3);
  const [gridRows, setGridRows] = useState(page?.gridRows || 4);
  const [gridPosition, setGridPosition] = useState<{ row: number; col: number; spanRows?: number; spanCols?: number }>(
    page?.gridPosition || { row: 0, col: 0, spanRows: 1, spanCols: 1 }
  );
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
  const [buttons, setButtons] = useState<ButtonConfig[]>(
    page?.type === 'custom' ? (page.config as CustomContentPageConfig).buttons || [] : []
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
      backgroundColorOpacity,
      textColor,
      backgroundImage: backgroundImageUrl || undefined,
      gridEnabled: gridEnabled || undefined,
      gridColumns: gridEnabled ? gridColumns : undefined,
      gridRows: gridEnabled ? gridRows : undefined,
      gridPosition: gridEnabled ? gridPosition : undefined,
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
            buttons: buttons.length > 0 ? buttons : undefined,
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
    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('Image size must be less than 50MB');
      return;
    }
    
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
    setBackgroundColorOpacity(templatePage.backgroundColorOpacity ?? 1);
    setTextColor(templatePage.textColor || '#000000');
    setBackgroundImageUrl(templatePage.backgroundImage || '');
    setGridEnabled(templatePage.gridEnabled || false);
    setGridColumns(templatePage.gridColumns || 3);
    setGridRows(templatePage.gridRows || 4);
    setGridPosition(templatePage.gridPosition || { row: 0, col: 0, spanRows: 1, spanCols: 1 });
    
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
      setButtons(customConfig.buttons || []);
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
              buttons: buttons.length > 0 ? buttons : undefined,
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
                sx={{ mb: 3 }}
              />
              
              {/* Buttons Section */}
              <Divider sx={{ my: 3 }} />
              <ButtonManager
                buttons={buttons}
                onButtonsChange={setButtons}
                pageType="Custom Page"
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
                {backgroundImageUrl && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Background Color Opacity (overlay on image)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                      <Slider
                        value={backgroundColorOpacity * 100}
                        onChange={(_, value) => setBackgroundColorOpacity((value as number) / 100)}
                        min={0}
                        max={100}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        value={Math.round(backgroundColorOpacity * 100)}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(100, Number(e.target.value)));
                          setBackgroundColorOpacity(value / 100);
                        }}
                        inputProps={{ min: 0, max: 100, step: 1 }}
                        sx={{ width: 80 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Adjust opacity to create an overlay effect on the background image
                    </Typography>
                  </Box>
                )}
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

          <Divider sx={{ my: 3 }} />

          {/* Grid Positioning System */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Grid Positioning (3x4 Grid System)
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={gridEnabled}
                onChange={(e) => setGridEnabled(e.target.checked)}
              />
            }
            label="Enable grid positioning for this page"
            sx={{ mb: 2 }}
          />

          {gridEnabled && (
            <Box sx={{ pl: 4, pt: 1 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Grid Columns"
                    value={gridColumns}
                    onChange={(e) => setGridColumns(Math.max(1, Math.min(12, parseInt(e.target.value) || 3)))}
                    inputProps={{ min: 1, max: 12 }}
                    helperText="Number of columns in the grid (default: 3)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Grid Rows"
                    value={gridRows}
                    onChange={(e) => setGridRows(Math.max(1, Math.min(12, parseInt(e.target.value) || 4)))}
                    inputProps={{ min: 1, max: 12 }}
                    helperText="Number of rows in the grid (default: 4)"
                  />
                </Grid>
              </Grid>

              {/* Grid Position Selector */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                  Select Grid Position
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                    gap: 1,
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  {Array.from({ length: gridRows * gridColumns }).map((_, index) => {
                    const row = Math.floor(index / gridColumns);
                    const col = index % gridColumns;
                    const isSelected = gridPosition.row === row && gridPosition.col === col;
                    const isInSpan = 
                      row >= gridPosition.row && 
                      row < gridPosition.row + (gridPosition.spanRows || 1) &&
                      col >= gridPosition.col && 
                      col < gridPosition.col + (gridPosition.spanCols || 1);

                    return (
                      <Box
                        key={index}
                        onClick={() => setGridPosition({ ...gridPosition, row, col })}
                        sx={{
                          aspectRatio: '1',
                          bgcolor: isSelected ? 'primary.main' : isInSpan ? 'primary.light' : 'white',
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.dark' : 'divider',
                          borderRadius: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: isSelected || isInSpan ? 'white' : 'text.secondary',
                          fontWeight: isSelected ? 600 : 400,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: isSelected ? 'primary.dark' : 'primary.light',
                            borderColor: 'primary.dark',
                            color: 'white',
                          },
                        }}
                      >
                        {row + 1},{col + 1}
                      </Box>
                    );
                  })}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Selected: Row {gridPosition.row + 1}, Column {gridPosition.col + 1}
                </Typography>
              </Box>

              {/* Span Controls */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Span Rows"
                    value={gridPosition.spanRows || 1}
                    onChange={(e) => setGridPosition({ 
                      ...gridPosition, 
                      spanRows: Math.max(1, Math.min(gridRows - gridPosition.row, parseInt(e.target.value) || 1))
                    })}
                    inputProps={{ min: 1, max: gridRows }}
                    helperText="How many rows to span"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Span Columns"
                    value={gridPosition.spanCols || 1}
                    onChange={(e) => setGridPosition({ 
                      ...gridPosition, 
                      spanCols: Math.max(1, Math.min(gridColumns - gridPosition.col, parseInt(e.target.value) || 1))
                    })}
                    inputProps={{ min: 1, max: gridColumns }}
                    helperText="How many columns to span"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

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

