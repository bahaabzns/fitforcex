'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Add, Delete, ArrowForward, ArrowBack, CheckCircle, Edit } from '@mui/icons-material';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash, CloseCircle, ArrowDown2, ArrowUp2 } from '@wandersonalwes/iconsax-react';
import { useTheme } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import { FormattedMessage, useIntl } from 'react-intl';
import { openSnackbar } from '@/api/snackbar';
import FileUpload from './FileUpload';
import api from '@/utils/axios';

const CHOICE_QUESTION_TYPES = ['select', 'checkbox', 'radio'] as const;

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
  const [skipping, setSkipping] = useState(false);

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
  const [customQuestionAllowOther, setCustomQuestionAllowOther] = useState<boolean>(false);
  const [customQuestionOptions, setCustomQuestionOptions] = useState<string[]>([]);
  const [customQuestionOptionsArabic, setCustomQuestionOptionsArabic] = useState<string[]>([]);
  const [customQuestionError, setCustomQuestionError] = useState<string>('');
  const [confirmCustomFormDiscard, setConfirmCustomFormDiscard] = useState(false);
  const [defaultQuestions, setDefaultQuestions] = useState<any[]>([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // Create form dialog state (from forms page)
  const [showCreate, setShowCreate] = useState(false);
  const [formType, setFormType] = useState<'nutrition' | 'workout' | 'other'>('nutrition');
  const [title, setTitle] = useState('');
  const [titleArabic, setTitleArabic] = useState('');
  const [newQuestions, setNewQuestions] = useState<
    Array<{ id: string; originalId?: string; label: string; labelArabic?: string; description?: string; descriptionArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[]; allowOther?: boolean }>
  >([]);
  const [creating, setCreating] = useState(false);
  // custom question builder
  const [customType, setCustomType] = useState<string>('text');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [customLabelArabic, setCustomLabelArabic] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customDescriptionArabic, setCustomDescriptionArabic] = useState<string>('');
  const [customRequired, setCustomRequired] = useState<boolean>(false);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [customOptionsArabic, setCustomOptionsArabic] = useState<string[]>([]);
  const [customAllowOther, setCustomAllowOther] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string>('');
  const [confirmDiscardTarget, setConfirmDiscardTarget] = useState<null | 'create' | 'edit'>(null);
  const intl = useIntl();
  const isArabic = String(intl.locale || '').toLowerCase().startsWith('ar');

  useEffect(() => {
    if (CHOICE_QUESTION_TYPES.includes(customQuestionType as typeof CHOICE_QUESTION_TYPES[number])) {
      if (customQuestionOptions.length === 0) {
        setCustomQuestionOptions(['']);
        setCustomQuestionOptionsArabic(['']);
      }
    } else if (customQuestionOptions.length > 0 || customQuestionOptionsArabic.length > 0 || customQuestionAllowOther) {
      setCustomQuestionOptions([]);
      setCustomQuestionOptionsArabic([]);
      setCustomQuestionAllowOther(false);
    }
  }, [customQuestionType, customQuestionOptions.length, customQuestionOptionsArabic.length, customQuestionAllowOther]);

  const addCustomOptionField = () => {
    setCustomQuestionOptions((prev) => [...prev, '']);
    setCustomQuestionOptionsArabic((prev) => [...prev, '']);
  };

  const updateCustomOptionField = (index: number, field: 'en' | 'ar', value: string) => {
    if (field === 'en') {
      setCustomQuestionOptions((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
    } else {
      setCustomQuestionOptionsArabic((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
    }
  };

  const removeCustomOptionField = (index: number) => {
    setCustomQuestionOptions((prev) => prev.filter((_, i) => i !== index));
    setCustomQuestionOptionsArabic((prev) => prev.filter((_, i) => i !== index));
  };

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
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleComplete = async () => {
    try {
      setCompleting(true);
      setError(null);

      // Helper function to ensure question has an ID
      const ensureQuestionId = (q: any, index: number, formIndex: number): string => {
        if (q?.id && typeof q.id === 'string' && q.id.trim()) {
          return q.id;
        }
        // Generate a unique ID if missing
        return `q_${formIndex}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      };

      // Prepare customized forms from templates
      const customizedTemplates = selectedTemplateIds.map((templateId, templateIndex) => {
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

        // Ensure all questions have IDs and valid structure
        const questionsWithIds = allQuestions.map((q: any, index: number) => {
          const questionType = q.type || 'text';
          const isChoiceType = ['select', 'checkbox', 'radio'].includes(questionType);
          
          return {
            ...q,
            id: ensureQuestionId(q, index, templateIndex),
            // Ensure required fields are present
            question: q.question || q.name || q.label || '',
            questionArabic: q.questionArabic || q.nameArabic || q.labelArabic || null,
            type: questionType,
            // Ensure options is always an array for choice types, or omitted for others
            ...(isChoiceType ? {
              options: Array.isArray(q.options) ? q.options : [],
              optionsArabic: Array.isArray(q.optionsArabic) ? q.optionsArabic : [],
            } : {}),
          };
        });

        return {
          type: template.type,
          title: template.title,
          titleArabic: template.titleArabic || '',
          questions: questionsWithIds
        };
      }).filter(Boolean);

      // Sanitize custom forms: remove helper fields like originalId and map to API format
      const sanitizedCustomForms = (customForms || []).map((form: any, formIndex: number) => ({
        type: form.type,
        title: form.title,
        titleArabic: form.titleArabic || '',
        questions: Array.isArray(form.questions)
          ? form.questions.map((q: any, index: number) => {
              const { originalId, question, questionArabic, ...rest } = q || {};
              // Preserve or generate ID
              const questionId = ensureQuestionId(q, index, formIndex + 1000); // Use offset to avoid conflicts
              const questionType = rest.type || 'text';
              const isChoiceType = ['select', 'checkbox', 'radio'].includes(questionType);
              
              // Build base question object
              const questionObj: any = {
                id: questionId, // Always include id - required by API
                name: question || q.label || q.name || '',
                nameArabic: questionArabic || q.labelArabic || q.nameArabic || null,
                question: question || q.label || q.name || '',
                questionArabic: questionArabic || q.labelArabic || q.nameArabic || null,
                description: rest.description || null,
                descriptionArabic: rest.descriptionArabic || null,
                type: questionType,
                required: !!rest.required,
                placeholder: rest.placeholder || null,
                placeholderArabic: rest.placeholderArabic || null,
              };
              
              // Only include options for choice-type questions, and ensure they're arrays
              if (isChoiceType) {
                questionObj.options = Array.isArray(rest.options) ? rest.options : [];
                questionObj.optionsArabic = Array.isArray(rest.optionsArabic) ? rest.optionsArabic : [];
                questionObj.allowOther = rest.allowOther || false;
              }
              
              return questionObj;
            })
          : []
      }));

      const payload = {
        brandingLogoUrl: logoUrl || null,
        brandingPrimaryHex: primaryColor || null,
        landingConfig: landingConfig.title || landingConfig.subtitle ? landingConfig : null,
        formTemplateIds: [], // Don't use raw template IDs
        customForms: [...customizedTemplates, ...sanitizedCustomForms], // Combine customized templates and custom forms (sanitized)
        packages,
        importAllFoodItems,
        importAllExercises,
      };

      await api.post('/api/workspaces/onboarding/complete', payload);

      // Hard reload so the dashboard re-mounts and re-checks onboarding status
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to complete onboarding');
      setCompleting(false);
    }
  };

  const handleSkip = async () => {
    if (!window.confirm('Are you sure you want to skip onboarding? You can always set up your workspace later in the settings.')) {
      return;
    }

    try {
      setSkipping(true);
      setError(null);

      await api.post('/api/workspaces/onboarding/skip');

      // Hard reload so the dashboard re-mounts and re-checks onboarding status
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to skip onboarding');
      setSkipping(false);
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

  // Create form functions (from forms page)
  const resetCreateState = () => {
    setShowCreate(false);
    setEditingFormIndex(null);
    setTitle('');
    setTitleArabic('');
    setFormType('nutrition');
    setNewQuestions([]);
    setCustomType('text');
    setCustomLabel('');
    setCustomLabelArabic('');
    setCustomDescription('');
    setCustomDescriptionArabic('');
    setCustomRequired(false);
    setCustomOptions([]);
    setCustomOptionsArabic([]);
    setCustomAllowOther(false);
    setCustomError('');
  };

  const createDialogDirty = useMemo(() => {
    if (editingFormIndex !== null) {
      // For edit mode, check if anything changed
      const originalForm = customForms[editingFormIndex];
      if (!originalForm) return false;
      
      // Normalize questions for comparison
      const normalizeQuestion = (q: any) => ({
        label: q.label || q.question || q.name || '',
        labelArabic: q.labelArabic || q.questionArabic || q.nameArabic || '',
        description: q.description || '',
        descriptionArabic: q.descriptionArabic || '',
        type: q.type || 'text',
        required: !!q.required,
        options: q.options || undefined,
        optionsArabic: q.optionsArabic || undefined,
        allowOther: q.allowOther || false,
      });
      
      const normalizedNew = newQuestions.map(normalizeQuestion);
      const normalizedOriginal = (originalForm.questions || []).map(normalizeQuestion);
      
      return Boolean(
        title.trim() !== (originalForm.title || '') ||
        titleArabic.trim() !== (originalForm.titleArabic || '') ||
        formType !== originalForm.type ||
        JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOriginal)
      );
    }
    // For create mode
    return Boolean(
      title.trim() ||
      titleArabic.trim() ||
      formType !== 'nutrition' ||
      newQuestions.length > 0
    );
  }, [title, titleArabic, formType, newQuestions, editingFormIndex, customForms]);

  const handleCloseCreateDialog = () => {
    if (createDialogDirty) {
      setConfirmDiscardTarget(editingFormIndex !== null ? 'edit' : 'create');
    } else {
      resetCreateState();
    }
  };

  const handleDiscardConfirmation = () => {
    if (confirmDiscardTarget === 'create' || confirmDiscardTarget === 'edit') {
      resetCreateState();
    }
    setConfirmDiscardTarget(null);
  };

  const handleCancelDiscard = () => {
    setConfirmDiscardTarget(null);
  };

  // Drag and drop handlers for questions
  const handleNewQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = newQuestions.findIndex((q) => q.id === active.id);
    const newIndex = newQuestions.findIndex((q) => q.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const updated = [...newQuestions];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      setNewQuestions(updated);
    }
  };

  const createTemplate = () => {
    if (!title.trim()) {
      setError('Please enter a form title');
      return;
    }
    
    if (newQuestions.length === 0) {
      setError('Please add at least one question to the form');
      return;
    }

    setError(null);
    
    // Map questions to the format expected by customForms
    const questions = newQuestions.map(({ id, label, labelArabic, description, descriptionArabic, type, required, options, optionsArabic, allowOther }) => ({
      id,
      question: label,
      questionArabic: labelArabic || '',
      description: description || '',
      descriptionArabic: descriptionArabic || '',
      type,
      required: !!required,
      options: options || undefined,
      optionsArabic: optionsArabic || undefined,
      allowOther: allowOther || undefined,
    }));

    if (editingFormIndex !== null) {
      // Update existing form
      const updated = [...customForms];
      updated[editingFormIndex] = {
        type: formType,
        title: title.trim(),
        titleArabic: titleArabic.trim() || '',
        questions: questions,
      };
      setCustomForms(updated);
      openSnackbar({ open: true, message: 'Form updated successfully', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
    } else {
      // Add new form
      setCustomForms([
        ...customForms,
        {
          type: formType,
          title: title.trim(),
          titleArabic: titleArabic.trim() || '',
          questions: questions,
        },
      ]);
      openSnackbar({ open: true, message: 'Form saved successfully', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
    }
    
    resetCreateState();
  };

  const openEditForm = (index: number) => {
    const form = customForms[index];
    if (!form) return;
    
    setEditingFormIndex(index);
    setTitle(form.title || '');
    setTitleArabic(form.titleArabic || '');
    setFormType((form.type === 'workout' ? 'workout' : form.type === 'other' ? 'other' : 'nutrition'));
    
    // Map questions back to the format used in the dialog
    const mappedQuestions = Array.isArray(form.questions) ? form.questions.map((q: any, idx: number) => ({
      id: q.id || `q_${idx}_${Date.now()}`,
      originalId: q.id,
      label: q.question || q.label || q.name || `Question ${idx + 1}`,
      labelArabic: q.questionArabic || q.labelArabic || q.nameArabic || '',
      description: q.description || '',
      descriptionArabic: q.descriptionArabic || '',
      type: q.type || 'text',
      required: !!q.required,
      options: q.options,
      optionsArabic: q.optionsArabic,
      allowOther: q.allowOther || false,
    })) : [];
    
    setNewQuestions(mappedQuestions);
    setShowCreate(true);
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

    const sanitizedOptionsEn = customQuestionOptions.map((opt) => opt.trim());
    const sanitizedOptionsAr = customQuestionOptionsArabic.map((opt) => opt.trim());
    const filteredOptionsEn: string[] = [];
    const filteredOptionsAr: string[] = [];

    sanitizedOptionsEn.forEach((opt, idx) => {
      if (opt) {
        filteredOptionsEn.push(opt);
        filteredOptionsAr.push(sanitizedOptionsAr[idx] || '');
      }
    });

    const isChoiceType = CHOICE_QUESTION_TYPES.includes(customQuestionType as typeof CHOICE_QUESTION_TYPES[number]);
    if (isChoiceType && filteredOptionsEn.length === 0) {
      setCustomQuestionError('Please add at least one option');
      return;
    }

    const newQuestion = {
      id: `custom_${Date.now()}`,
      type: customQuestionType,
      question: customQuestionLabel,
      questionArabic: customQuestionLabelArabic || '',
      required: customQuestionRequired,
      options: isChoiceType
        ? filteredOptionsEn
        : undefined,
      optionsArabic: isChoiceType
        ? filteredOptionsAr
        : undefined,
      allowOther: customQuestionType === 'select' ? customQuestionAllowOther : undefined,
    };

    if (editingQuestionIndex !== null) {
      // Update existing question
      const updated = [...newFormQuestions];
      updated[editingQuestionIndex] = newQuestion;
      setNewFormQuestions(updated);
      setEditingQuestionIndex(null);
    } else {
      // Add new question
    setNewFormQuestions([...newFormQuestions, newQuestion]);
    }
    
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions([]);
    setCustomQuestionOptionsArabic([]);
    setCustomQuestionAllowOther(false);
    setCustomQuestionError('');
  };

  const editCustomQuestion = (index: number) => {
    const question = newFormQuestions[index];
    if (question) {
      setEditingQuestionIndex(index);
      setCustomQuestionType(question.type || 'text');
      setCustomQuestionLabel(question.question || '');
      setCustomQuestionLabelArabic(question.questionArabic || '');
      setCustomQuestionRequired(question.required || false);
      if (CHOICE_QUESTION_TYPES.includes((question.type || 'text') as typeof CHOICE_QUESTION_TYPES[number])) {
        const normalizeOptions = (value: any): string[] => {
          if (Array.isArray(value)) return value as string[];
          if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
          return [];
        };
        const enOptions = normalizeOptions(question.options);
        const arOptions = normalizeOptions(question.optionsArabic);
        const effectiveLength = Math.max(enOptions.length, 1);
        const paddedEn = enOptions.length ? enOptions : Array(effectiveLength).fill('');
        const paddedAr = [...arOptions];
        while (paddedAr.length < effectiveLength) {
          paddedAr.push('');
        }
        setCustomQuestionOptions(paddedEn);
        setCustomQuestionOptionsArabic(paddedAr.slice(0, effectiveLength));
        setCustomQuestionAllowOther(Boolean(question.allowOther));
      } else {
        setCustomQuestionOptions([]);
        setCustomQuestionOptionsArabic([]);
        setCustomQuestionAllowOther(false);
      }
      setCustomQuestionError('');
      
      // Scroll to question builder section after a short delay to ensure DOM is updated
      setTimeout(() => {
        const questionBuilder = document.querySelector('[data-question-builder]');
        if (questionBuilder) {
          questionBuilder.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  const cancelEditQuestion = () => {
    setEditingQuestionIndex(null);
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions([]);
    setCustomQuestionOptionsArabic([]);
    setCustomQuestionAllowOther(false);
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

  const customFormDialogDirty = useMemo(() => {
    return Boolean(
      newFormTitle.trim() ||
      newFormQuestions.length > 0 ||
      editingFormIndex !== null ||
      newFormType !== 'nutrition'
    );
  }, [newFormTitle, newFormQuestions, editingFormIndex, newFormType]);

  const handleCloseCustomFormDialog = () => {
    setShowAddCustomForm(false);
    setEditingFormIndex(null);
    setNewFormTitle('');
    setNewFormQuestions([]);
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions([]);
    setCustomQuestionOptionsArabic([]);
    setCustomQuestionAllowOther(false);
    setCustomQuestionError('');
    setEditingQuestionIndex(null);
  };

  const handleRequestCloseCustomFormDialog = () => {
    if (customFormDialogDirty) {
      setConfirmCustomFormDiscard(true);
    } else {
      handleCloseCustomFormDialog();
    }
  };

  const confirmCustomFormDiscardClose = () => {
    setConfirmCustomFormDiscard(false);
    handleCloseCustomFormDialog();
  };

  const cancelCustomFormDiscardClose = () => {
    setConfirmCustomFormDiscard(false);
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
    setEditingQuestionIndex(null); // Reset question editing state
    setCustomQuestionLabel('');
    setCustomQuestionLabelArabic('');
    setCustomQuestionRequired(false);
    setCustomQuestionOptions([]);
    setCustomQuestionOptionsArabic([]);
    setCustomQuestionAllowOther(false);
    setCustomQuestionError('');
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

                  <Box>
                    <TextField
                      fullWidth
                      label="Primary Color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      helperText="Choose your workspace's primary brand color"
                    />
                  </Box>

                  {/* Preview */}
                  {(logoUrl || primaryColor) && (
                    <Box sx={{ 
                      p: 2, 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50' 
                    }}>
                      <Typography 
                        variant="subtitle2" 
                        gutterBottom
                        sx={{ color: 'text.primary' }}
                      >
                        Preview Your Workspace
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
                        <Typography variant="h6" sx={{ color: 'text.primary' }}>Your Workspace</Typography>
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
                  <Box>
                    <TextField
                      fullWidth
                      label="Landing Page Title"
                      value={landingConfig.title || ''}
                      onChange={(e) => setLandingConfig((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Welcome to Our Fitness Community"
                    />
                  </Box>
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
                  <Button size="small" startIcon={<Add />} onClick={() => setShowCreate(true)}>
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
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={form.type}
                                size="small"
                                color={form.type === 'nutrition' ? 'success' : form.type === 'workout' ? 'primary' : 'default'}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {Array.isArray(form.questions) ? `${form.questions.length} question${form.questions.length !== 1 ? 's' : ''}` : '0 questions'}
                              </Typography>
                            </Stack>
                          }
                        />
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => openEditForm(index)}>Edit</Button>
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

            {/* Create Form Dialog (from forms page) */}
            <Dialog 
              open={showCreate} 
              onClose={handleCloseCreateDialog} 
              fullWidth 
              maxWidth="md"
              PaperProps={{
                sx: {
                  bgcolor: 'background.paper',
                }
              }}
            >
              <DialogTitle sx={{ 
                pb: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {editingFormIndex !== null ? 'Edit Form' : <FormattedMessage id="new-form-template" defaultMessage="New Form Template" />}
                  </Typography>
                  {newQuestions.length > 0 && (
                    <Chip
                      label={`${newQuestions.length} ${newQuestions.length === 1 ? 'question' : 'questions'}`}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>
              </DialogTitle>
              <DialogContent dividers sx={{ bgcolor: 'background.paper' }}>
                <Stack spacing={3}>
                  <TextField fullWidth label={intl.formatMessage({ id: 'title', defaultMessage: 'Title' })} value={title} onChange={(e) => setTitle(e.target.value)} />
                  <TextField fullWidth label={intl.formatMessage({ id: 'title-arabic', defaultMessage: 'Title (Arabic)' })} value={titleArabic} onChange={(e) => setTitleArabic(e.target.value)} />
                  <FormControl fullWidth>
                    <InputLabel id="form-type-label"><FormattedMessage id="type" defaultMessage="Type" /></InputLabel>
                    <Select labelId="form-type-label" label={intl.formatMessage({ id: 'type', defaultMessage: 'Type' })} value={formType} onChange={(e) => setFormType(e.target.value as any)}>
                      <MenuItem value="nutrition">nutrition</MenuItem>
                      <MenuItem value="workout">workout</MenuItem>
                      <MenuItem value="other">other</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Fixed (default) questions list */}
                  {defaultQuestions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        <FormattedMessage id="fixed-questions" defaultMessage="Fixed Questions" />
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {defaultQuestions.map((q) => (
                          <Chip
                            key={q.id}
                            label={(isArabic ? (q as any).labelArabic : undefined) || q.label || q.question}
                            onClick={() =>
                              setNewQuestions((prev) => {
                                // prevent duplicate of the same default question
                                if (prev.some((p) => p.originalId === q.id)) return prev;
                                return [
                                  ...prev,
                                  { ...q, id: `${q.id}_${Date.now()}`, originalId: q.id, label: q.label || q.question, labelArabic: (q as any).labelArabic || q.questionArabic },
                                ];
                              })
                            }
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Added questions - editable with drag and drop */}
                  {newQuestions.length > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Questions ({newQuestions.length})
                        </Typography>
                        <Chip
                          label={`${newQuestions.length} ${newQuestions.length === 1 ? 'question' : 'questions'}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <DndContext collisionDetection={closestCenter} onDragEnd={handleNewQuestionDragEnd}>
                        <SortableContext items={newQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                          <Box>
                            {newQuestions.map((q, idx) => (
                              <SortableQuestion
                                key={q.id}
                                question={q}
                                index={idx}
                                onUpdate={(id, field, value) => {
                                  setNewQuestions((prev) => prev.map((x) => {
                                    if (x.id !== id) return x;
                                    if (field === 'type') {
                                      return { ...x, type: value, options: ['select','checkbox','radio'].includes(value) ? (x.options||[]) : undefined, optionsArabic: ['select','checkbox','radio'].includes(value) ? (x.optionsArabic||[]) : undefined };
                                    }
                                    return { ...x, [field]: value };
                                  }));
                                }}
                                onDelete={() => setNewQuestions((prev) => prev.filter((_, i) => i !== idx))}
                              />
                            ))}
                          </Box>
                        </SortableContext>
                      </DndContext>
                    </Box>
                  )}

                  {/* Custom question builder */}
                  <Box sx={{ 
                    mt: 3,
                    p: 2.5,
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'divider',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'action.hover',
                  }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Add size={20} />
                      Add Custom Question
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth>
                          <InputLabel id="custom-type-label">Type</InputLabel>
                          <Select labelId="custom-type-label" label="Type" value={customType} onChange={(e) => setCustomType(e.target.value)}>
                            <MenuItem value="text">text</MenuItem>
                            <MenuItem value="textarea">textarea</MenuItem>
                            <MenuItem value="number">number</MenuItem>
                            <MenuItem value="date">date</MenuItem>
                            <MenuItem value="select">select</MenuItem>
                            <MenuItem value="checkbox">checkbox</MenuItem>
                            <MenuItem value="radio">radio</MenuItem>
                            <MenuItem value="attachment">attachment</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField fullWidth label="Question label" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField fullWidth label="Question label (Arabic)" value={customLabelArabic} onChange={(e) => setCustomLabelArabic(e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField 
                          fullWidth 
                          label="Description (optional)" 
                          value={customDescription} 
                          onChange={(e) => setCustomDescription(e.target.value)} 
                          multiline
                          minRows={2}
                          placeholder="Help text or instructions"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField 
                          fullWidth 
                          label="Description (Arabic, optional)" 
                          value={customDescriptionArabic} 
                          onChange={(e) => setCustomDescriptionArabic(e.target.value)} 
                          multiline
                          minRows={2}
                          placeholder="نص المساعدة"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControlLabel control={<Switch checked={customRequired} onChange={(e) => setCustomRequired(e.target.checked)} />} label="Required" />
                      </Grid>
                      </Grid>
                    {['select', 'checkbox', 'radio'].includes(customType) && (
                      <Box sx={{ mt: 2 }}>
                        <OptionsEditor
                          questionId={`custom-${Date.now()}`}
                          options={customOptions}
                          optionsArabic={customOptionsArabic}
                          onUpdate={(options, optionsArabic) => {
                            setCustomOptions(options);
                            setCustomOptionsArabic(optionsArabic);
                          }}
                        />
                        {customType === 'select' && (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={customAllowOther}
                                onChange={(e) => setCustomAllowOther(e.target.checked)}
                              />
                            }
                            label="Allow 'Other' option"
                            sx={{ mt: 2 }}
                          />
                        )}
                      </Box>
                    )}
                    {customError && <Alert severity="error" sx={{ mt: 2 }}>{customError}</Alert>}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 1 }}>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setCustomLabel('');
                          setCustomLabelArabic('');
                          setCustomDescription('');
                          setCustomDescriptionArabic('');
                          setCustomRequired(false);
                          setCustomOptions([]);
                          setCustomOptionsArabic([]);
                          setCustomAllowOther(false);
                          setCustomError('');
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Add size={18} />}
                        onClick={() => {
                          setCustomError('');
                          if (!customLabel.trim()) {
                            setCustomError('Question label is required');
                            return;
                          }
                          setNewQuestions((prev) => [
                            ...prev,
                            {
                              id: `q_${Date.now()}`,
                              label: customLabel.trim(),
                              labelArabic: customLabelArabic.trim() || undefined,
                              description: customDescription.trim() || undefined,
                              descriptionArabic: customDescriptionArabic.trim() || undefined,
                              type: customType,
                              required: customRequired,
                              options: customOptions.length ? customOptions : undefined,
                              optionsArabic: customOptionsArabic.length ? customOptionsArabic : undefined,
                              allowOther: customType === 'select' ? customAllowOther : undefined,
                            },
                          ]);
                          setCustomLabel('');
                          setCustomLabelArabic('');
                          setCustomDescription('');
                          setCustomDescriptionArabic('');
                          setCustomRequired(false);
                          setCustomOptions([]);
                          setCustomOptionsArabic([]);
                          setCustomAllowOther(false);
                        }}
                      >
                        Add
                      </Button>
                    </Box>
                  </Box>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseCreateDialog}>Cancel</Button>
                <Button variant="contained" onClick={createTemplate}>
                  {editingFormIndex !== null ? 'Save Changes' : 'Save Form'}
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog open={!!confirmDiscardTarget} onClose={handleCancelDiscard} maxWidth="xs" fullWidth>
              <DialogTitle>Discard changes?</DialogTitle>
              <DialogContent>
                <Typography color="text.secondary">
                  You have unsaved changes. Do you want to discard them?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCancelDiscard}>Keep editing</Button>
                <Button color="error" onClick={handleDiscardConfirmation}>
                  Discard
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
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <Box>
                <Typography variant="h4" gutterBottom>
                  Welcome to FitForce! 👋
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Let's set up your workspace in a few simple steps.
                </Typography>
              </Box>
            </Box>

            <Box>
              <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>

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
                variant="outlined"
                color="warning"
                onClick={handleSkip}
                disabled={skipping || completing}
              >
                {skipping ? 'Skipping...' : 'Skip Onboarding'}
              </Button>

              <Stack direction="row" spacing={2}>
                <Button
                  disabled={activeStep === 0 || completing || skipping}
                  onClick={handleBack}
                  startIcon={<ArrowBack />}
                >
                  Back
                </Button>

                {activeStep === steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleComplete}
                    disabled={completing || skipping}
                    endIcon={completing ? <CircularProgress size={20} /> : <CheckCircle />}
                  >
                    {completing ? 'Completing...' : 'Complete Onboarding'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={skipping}
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

// SortableQuestion Component (from forms page)
function SortableQuestion({ 
  question, 
  index, 
  onUpdate, 
  onDelete,
  isEditMode = false 
}: { 
  question: { id: string; label: string; labelArabic?: string; description?: string; descriptionArabic?: string; type: string; required?: boolean; options?: string[]; optionsArabic?: string[]; allowOther?: boolean }; 
  index: number;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: () => void;
  isEditMode?: boolean;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const questionLabel = question.label || `Question ${index + 1}`;
  const questionType = question.type || 'text';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      sx={{
        mb: 2,
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: isDragging 
          ? (theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.08)' : 'rgba(25, 118, 210, 0.04)')
          : (theme.palette.mode === 'dark' ? 'background.paper' : 'background.paper'),
        boxShadow: isDragging 
          ? theme.shadows[4] 
          : (theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.05)'),
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[2],
          borderColor: 'primary.light',
        },
      }}
    >
      <CardContent sx={{ pb: expanded ? 1 : '16px !important', pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: isDragging ? 'grabbing' : 'grab',
              color: 'text.secondary',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              p: 0.5,
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'primary.main',
              },
              '&:active': { cursor: 'grabbing' }
            }}
          >
            ≡
          </Box>
          <Chip
            label={`#${index + 1}`}
            size="small"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.16)' : 'primary.lighter',
              color: 'primary.main',
              fontWeight: 600,
              minWidth: 40,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {questionLabel}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={questionType}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'action.hover',
                }}
              />
              {question.required && (
                <Chip
                  label="Required"
                  size="small"
                  color="error"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {question.description && (
                <Chip
                  label="Has Description"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.16)' : 'success.lighter',
                    color: 'success.main',
                  }}
                />
              )}
              {['select', 'checkbox', 'radio'].includes(questionType) && question.options && question.options.length > 0 && (
                <Chip
                  label={`${question.options.length} options`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.16)' : 'secondary.lighter',
                    color: 'secondary.main',
                  }}
                />
              )}
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'primary.main',
              },
            }}
          >
            {expanded ? <ArrowUp2 size={18} /> : <ArrowDown2 size={18} />}
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={onDelete}
            sx={{
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.16)' : 'error.lighter',
              },
            }}
          >
            <Trash size={18} />
          </IconButton>
        </Box>
      </CardContent>
      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0, bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'action.hover' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id={`qtype-${question.id}`}>Type</InputLabel>
                <Select
                  labelId={`qtype-${question.id}`}
                  label="Type"
                  value={question.type}
                  onChange={(e) => onUpdate(question.id, 'type', e.target.value)}
                >
                  <MenuItem value="text">text</MenuItem>
                  <MenuItem value="textarea">textarea</MenuItem>
                  <MenuItem value="number">number</MenuItem>
                  <MenuItem value="date">date</MenuItem>
                  <MenuItem value="select">select</MenuItem>
                  <MenuItem value="checkbox">checkbox</MenuItem>
                  <MenuItem value="radio">radio</MenuItem>
                  <MenuItem value="attachment">attachment</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel 
                control={
                  <Switch 
                    size="small" 
                    checked={!!question.required} 
                    onChange={(e) => onUpdate(question.id, 'required', e.target.checked)} 
                  />
                } 
                label="Required" 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                size="small" 
                fullWidth 
                label="Label" 
                value={question.label} 
                onChange={(e) => onUpdate(question.id, 'label', e.target.value)} 
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField 
                size="small" 
                fullWidth 
                label="Label (Arabic)" 
                value={question.labelArabic || ''} 
                onChange={(e) => onUpdate(question.id, 'labelArabic', e.target.value)} 
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                size="small" 
                fullWidth 
                label="Description (optional)" 
                value={question.description || ''} 
                onChange={(e) => onUpdate(question.id, 'description', e.target.value)} 
                multiline
                minRows={2}
                placeholder="Help text or instructions"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                size="small" 
                fullWidth 
                label="Description (Arabic, optional)" 
                value={question.descriptionArabic || ''} 
                onChange={(e) => onUpdate(question.id, 'descriptionArabic', e.target.value)} 
                multiline
                minRows={2}
                placeholder="نص المساعدة"
              />
            </Grid>
            {['select','checkbox','radio'].includes(question.type) && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 1, 
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    Options
                  </Typography>
                  <OptionsEditor
                    questionId={question.id}
                    options={question.options || []}
                    optionsArabic={question.optionsArabic || []}
                    onUpdate={(options, optionsArabic) => {
                      onUpdate(question.id, 'options', options);
                      onUpdate(question.id, 'optionsArabic', optionsArabic);
                    }}
                  />
                  {question.type === 'select' && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={question.allowOther || false}
                          onChange={(e) => onUpdate(question.id, 'allowOther', e.target.checked)}
                        />
                      }
                      label="Allow 'Other' option"
                      sx={{ mt: 2 }}
                    />
                  )}
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
}

// Options Editor Component (from forms page)
function OptionsEditor({
  questionId,
  options,
  optionsArabic,
  onUpdate
}: {
  questionId: string;
  options: string[];
  optionsArabic: string[];
  onUpdate: (options: string[], optionsArabic: string[]) => void;
}) {
  const theme = useTheme();
  const [localOptions, setLocalOptions] = useState<Array<{ en: string; ar: string }>>(() => {
    const maxLen = Math.max(options.length, optionsArabic.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      en: options[i] || '',
      ar: optionsArabic[i] || ''
    }));
  });

  useEffect(() => {
    const maxLen = Math.max(options.length, optionsArabic.length);
    setLocalOptions(Array.from({ length: maxLen }, (_, i) => ({
      en: options[i] || '',
      ar: optionsArabic[i] || ''
    })));
  }, [questionId]);

  const updateOption = (index: number, field: 'en' | 'ar', value: string) => {
    const updated = [...localOptions];
    updated[index] = { ...updated[index], [field]: value };
    setLocalOptions(updated);
    onUpdate(
      updated.map(o => o.en).filter(Boolean),
      updated.map(o => o.ar).filter(Boolean)
    );
  };

  const addOption = () => {
    setLocalOptions([...localOptions, { en: '', ar: '' }]);
  };

  const removeOption = (index: number) => {
    const updated = localOptions.filter((_, i) => i !== index);
    setLocalOptions(updated);
    onUpdate(
      updated.map(o => o.en).filter(Boolean),
      updated.map(o => o.ar).filter(Boolean)
    );
  };

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'divider',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Options</Typography>
      <Stack spacing={1}>
        {localOptions.map((opt, idx) => (
          <Grid container spacing={1} key={idx} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                size="small"
                fullWidth
                label="Option (English)"
                value={opt.en}
                onChange={(e) => updateOption(idx, 'en', e.target.value)}
                placeholder="Option name"
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                size="small"
                fullWidth
                label="Option (Arabic)"
                value={opt.ar}
                onChange={(e) => updateOption(idx, 'ar', e.target.value)}
                placeholder="اسم الخيار"
              />
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton size="small" color="error" onClick={() => removeOption(idx)}>
                <CloseCircle size={16} />
              </IconButton>
            </Grid>
          </Grid>
        ))}
        <Button
          size="small"
          startIcon={<Add size={16} />}
          onClick={addOption}
          variant="outlined"
        >
          Add Option
        </Button>
      </Stack>
    </Paper>
  );
}
