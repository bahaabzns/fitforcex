'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useParams } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Pagination
} from '@mui/material';
import {
  Add,
  Trash,
  ArrowLeft2,
  ArrowRight2,
  Copy,
  AttachCircle,
  CloseCircle,
  Information,
  Category,
  DocumentText,
  Setting2,
  Messages2
} from '@wandersonalwes/iconsax-react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';
import { listPdfTemplates, generatePdfFromTemplate } from '@/api/templates';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';
import LoadPlanDialog from '@/components/LoadPlanDialog';
import { Dialog as MuiDialog } from '@mui/material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import { FormSchedulingPopup } from '@/components/forms/FormSchedulingPopup';
import { exportNutritionPlanToPDF } from '@/utils/pdfExport';
import { useWorkspaceBranding } from '@/hooks/useWorkspaceBranding';

interface FoodItem {
  id: string;
  name: string;
  servingSize: number; // e.g., 100
  unit: string; // e.g., g, ml
  calories: number; // per serving
  protein: number;
  carbs: number;
  fat: number;
}

interface Plan {
  id: string;
  title: string;
  createdBy?: string;
  createdAt?: string;
  status?: string;
  clientId?: string;
  cycles?: Cycle[];
  waterForDay?: number;
  waterForTraining?: number;
}

interface Cycle {
  id: string;
  title: string;
  label: string;
  dayIndex: number;
  notes?: string;
  meals?: Meal[];
  microTotals?: Record<string, number>;
}

interface MealFoodItem {
  id: string;
  mealId: string;
  foodItemId: string;
  quantity: number; // quantity in food unit
  foodItem: FoodItem;
}

interface Meal {
  id: string;
  dayId: string;
  meal: string;
  notes?: string;
  foodItems: MealFoodItem[];
  recipeName?: string;
  recipeNameArabic?: string;
  recipeImageUrl?: string;
}

export default function ClientNutritionPage() {
  const { id: clientId } = useParams() as { id: string };
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileSection, setMobileSection] = useState(0);
  
  // State for plans with all data loaded
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planQuery, setPlanQuery] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(false);
  
  // Current working data (derived from selected plan)
  const [currentCycles, setCurrentCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [currentCycleIndex, setCurrentCycleIndex] = useState<number>(0);
  
  // Current meals (derived from selected cycle)
  const [currentMeals, setCurrentMeals] = useState<Meal[]>([]);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  
  // State for food items
  const [workspaceFood, setWorkspaceFood] = useState<FoodItem[]>([]);
  const [loadingFood, setLoadingFood] = useState(false);
  
  // Dialog states
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);
  const [isCreateMealDialogOpen, setIsCreateMealDialogOpen] = useState(false);
  const [isAddFoodDialogOpen, setIsAddFoodDialogOpen] = useState(false);
  const [isMacrosDialogOpen, setIsMacrosDialogOpen] = useState(false);
  
  // Form states
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newMealTitle, setNewMealTitle] = useState('');
  const [selectedFoodItems, setSelectedFoodItems] = useState<string[]>([]);
  const [editingQuantities, setEditingQuantities] = useState<{[key: string]: number}>({});
  const [isEditingQuantities, setIsEditingQuantities] = useState(false);
  const [isPlanDirty, setIsPlanDirty] = useState(false);
  const [foodSearchTerm, setFoodSearchTerm] = useState('');
  const [foodPage, setFoodPage] = useState(1);
  const foodItemsPerPage = 10;
  
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activating, setActivating] = useState(false);
  const [loadPlanDialogOpen, setLoadPlanDialogOpen] = useState(false);
  const [copyingPlanId, setCopyingPlanId] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [cycleNotesDialogOpen, setCycleNotesDialogOpen] = useState(false);
  const [cycleNotesDraft, setCycleNotesDraft] = useState('');
  const [mealNotesDialogOpen, setMealNotesDialogOpen] = useState(false);
  const [mealNotesDraft, setMealNotesDraft] = useState('');
  const [mealNotesMealId, setMealNotesMealId] = useState<string | null>(null);
  const [showMealNotesSection, setShowMealNotesSection] = useState(false);
  
  // Recipe states
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipeDropdownOpen, setRecipeDropdownOpen] = useState(false);
  const [plansTab, setPlansTab] = useState(0); // 0: Plans, 1: Forms, 2: Tools
  const [planTab, setPlanTab] = useState(0); // 0: Cycles & Meals, 1: Water
  const [dragFoodIndex, setDragFoodIndex] = useState<number | null>(null);
  const [dragMealIndex, setDragMealIndex] = useState<number | null>(null);
  const [editingPlanTitleId, setEditingPlanTitleId] = useState<string | null>(null);
  const [editingPlanTitleValue, setEditingPlanTitleValue] = useState('');
  const [editingMealTitleId, setEditingMealTitleId] = useState<string | null>(null);
  const [editingMealTitleValue, setEditingMealTitleValue] = useState('');
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [editingCycleValue, setEditingCycleValue] = useState('');
  const [waterForDay, setWaterForDay] = useState<number>(0);
  const [waterForTraining, setWaterForTraining] = useState<number>(0);
  // Inline Messenger (Chat Tab)
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatPollRef = useRef<number | null>(null);
  // Client display name
  const [clientName, setClientName] = useState<string>('');
  // Workspace branding
  const { workspaceName } = useWorkspaceBranding();
  // PDF export state
  const [exportingPdf, setExportingPdf] = useState(false);
  // Forms tab state
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [formsSubmissions, setFormsSubmissions] = useState<Array<{ id: string; form: { id: string; title: string; questions?: any }; answers?: any; status?: string; createdAt?: string; formTitle?: string; formType?: string; submittedAt?: string }>>([]);
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<Record<string, boolean>>({});
  
  // Form completion dialog for plan activation
  const [formCompletionDialogOpen, setFormCompletionDialogOpen] = useState(false);
  const [submittedForms, setSubmittedForms] = useState<Array<{ id: string; formTitle: string; submittedAt: string }>>([]);
  const [selectedFormsToArchive, setSelectedFormsToArchive] = useState<string[]>([]);
  const [archivingForms, setArchivingForms] = useState(false);
  
  // Form scheduling popup after plan activation
  const [formSchedulingPopupOpen, setFormSchedulingPopupOpen] = useState(false);

  const handleSendAsPdf = useCallback(async () => {
    try {
      if (!selectedPlanId) {
        if (typeof window !== 'undefined') window.alert('Select a plan first');
        return;
      }
      setGeneratingPdf(true);
      const { templates } = await listPdfTemplates('nutrition');
      if (!templates || templates.length === 0) {
        if (typeof window !== 'undefined') window.alert('No nutrition PDF templates found. Create one in Workspace > PDF Templates.');
        return;
      }
      const templateId = templates[0].id; // latest first per API order
      const { pdfUrl } = await generatePdfFromTemplate({ templateId, planId: selectedPlanId });
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
        // optional toast elsewhere
      } else {
        if (typeof window !== 'undefined') window.alert('Failed to generate PDF');
      }
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'PDF generation failed');
    } finally {
      setGeneratingPdf(false);
    }
  }, [selectedPlanId]);

  // Helper function to find question title by ID
  const getQuestionTitle = (questionId: string, questions: any[]): string => {
    if (!Array.isArray(questions)) return questionId;
    
    const question = questions.find((q: any) => q.id === questionId);
    if (question) {
      return question.question || question.label || question.name || questionId;
    }
    return questionId;
  };

  // Pretty-print answers with proper question titles
  const renderAnswerValue = (value: any, questions?: any[], depth = 0): JSX.Element => {
    const paddingLeft = depth * 12;
    if (value === null || value === undefined) return <Typography component="span" color="text.secondary">—</Typography> as any;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <Typography component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{String(value)}</Typography> as any;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <Typography component="span" color="text.secondary">[]</Typography> as any;
      return (
        <List dense sx={{ pl: paddingLeft ? 0 : 0 }}>
          {value.map((v, i) => (
            <ListItem key={i} sx={{ alignItems: 'flex-start', py: 0.25 }}>
              <ListItemText
                primaryTypographyProps={{ variant: 'body2' }}
                primary={
                  <Box sx={{ width: '100%', pl: paddingLeft }}>
                    {renderAnswerValue(v, questions, depth + 1)}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      );
    }
    if (typeof value === 'object') {
      // Handle attachment objects
      if (value.originalName && value.url && value.size !== undefined) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachCircle fontSize="small" />
            <Button
              size="small"
              variant="outlined"
              href={value.url}
              target="_blank"
              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
            >
              {value.originalName} ({(value.size / 1024).toFixed(1)} KB)
            </Button>
          </Box>
        ) as any;
      }
      
      const entries = Object.entries(value);
      if (entries.length === 0) return <Typography component="span" color="text.secondary">{`{}`}</Typography> as any;
      return (
        <List dense sx={{ pl: paddingLeft ? 0 : 0 }}>
          {entries.map(([k, v]) => {
            const questionTitle = questions ? getQuestionTitle(k, questions) : k;
            return (
              <ListItem key={k} sx={{ alignItems: 'flex-start', py: 0.25 }}>
                <Box sx={{ width: '100%', pl: paddingLeft }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mr: 1, display: 'inline', color: 'primary.main' }}>{questionTitle}</Typography>
                  <Typography variant="body2" sx={{ display: 'inline', color: 'text.secondary', mx: 0.5 }}>:</Typography>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{renderAnswerValue(v, questions, depth + 1)}</Box>
                </Box>
              </ListItem>
            );
          })}
        </List>
      );
    }
    return <Typography component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{String(value)}</Typography> as any;
  };

  const reorderArray = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = arr.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  // Sensors for drag and drop (like workout page)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Smooth drag-and-drop (like workout maker) for food items
  const Sortable: React.FC<{ id: string; children: (args: { attributes: any; listeners: any; setNodeRef: any; style: any }) => React.ReactNode }> = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1
    } as any;
    return <>{children({ attributes, listeners, setNodeRef, style })}</>;
  };

  const handleFoodDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!selectedMealId || !selectedPlanId || !selectedCycleId) return;

    const meal = currentMeals.find((m) => m.id === selectedMealId);
    if (!meal) return;
    const items = meal.foodItems || [];
    const oldIndex = items.findIndex((fi: any) => fi.id === active.id);
    const newIndex = items.findIndex((fi: any) => fi.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
      ...p,
      cycles: (p.cycles || []).map((c: any) => c.id !== selectedCycleId ? c : ({
        ...c,
        meals: (c.meals || []).map((m: any) => m.id !== selectedMealId ? m : ({
          ...m,
          foodItems: reorderArray(m.foodItems || [], oldIndex, newIndex)
        }))
      }))
    })));

    setCurrentMeals((prev) => prev.map((m: any) => m.id !== selectedMealId ? m : ({
      ...m,
      foodItems: reorderArray(m.foodItems || [], oldIndex, newIndex)
    })));

    setIsPlanDirty(true);
  };

  // Handle meal drag end with mirror effect
  const handleMealDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedPlanId || !selectedCycleId) return;

    const oldIndex = currentMeals.findIndex((m) => m.id === active.id);
    const newIndex = currentMeals.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newMeals = arrayMove(currentMeals, oldIndex, newIndex);
    
    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
      ...p,
      cycles: (p.cycles || []).map((c: any) => c.id !== selectedCycleId ? c : ({
        ...c,
        meals: newMeals
      }))
    })));

    setCurrentMeals(newMeals);
    setIsPlanDirty(true);
  };

  // Sortable meal component for mirror drag effect
  const SortableMeal: React.FC<{ 
    meal: Meal; 
    isSelected: boolean;
    onSelect: () => void;
    onCopy: () => void;
    onDelete: () => void;
  }> = ({ meal, isSelected, onSelect, onCopy, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meal.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    } as React.CSSProperties;
    const totals = computeMealTotals(meal);

    return (
      <Card
        ref={setNodeRef}
        style={style}
        onClick={onSelect}
        sx={{
          cursor: 'pointer',
          border: '2px solid',
          borderColor: isSelected ? 'primary.main' : 'divider',
          bgcolor: isSelected 
            ? theme.palette.mode === 'dark' 
              ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
              : 'primary.lighter' 
            : 'background.paper',
          position: 'relative',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
          borderRadius: 2,
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          '&:hover .meal-actions': { opacity: 1 },
          '&:hover': {
            borderColor: isSelected ? 'primary.dark' : 'primary.main',
            boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
            transform: isDragging ? undefined : 'translateY(-2px)',
            bgcolor: isSelected 
              ? theme.palette.mode === 'dark'
                ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                : 'primary.lighter'
              : 'action.hover'
          },
        }}
      >
        <CardContent sx={{ py: 1.75, px: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 85 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box 
                sx={{ 
                  mr: 1.5, 
                  color: 'text.disabled', 
                  cursor: 'grab',
                  fontSize: 20, 
                  lineHeight: 1,
                  opacity: 0.6,
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 1 },
                  '&:active': { cursor: 'grabbing', opacity: 0.8 }
                }} 
                title="Drag to reorder"
                {...attributes}
                {...listeners}
              >
                ≡
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.95rem', transition: 'color 0.2s' }}>{meal.meal}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', color: 'text.secondary', mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500, color: 'text.primary' }}>{totals.calories} kcal</Typography>
              <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500 }}>P: {Math.round(totals.protein)}g</Typography>
              <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500 }}>C: {Math.round(totals.carbs)}g</Typography>
              <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500 }}>F: {Math.round(totals.fat)}g</Typography>
            </Box>
          </Box>
        </CardContent>
        <Box className="meal-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" title="Copy meal" onClick={onCopy}>
            <Copy size={16} />
          </IconButton>
          <IconButton size="small" color="error" title="Delete meal" onClick={onDelete}>
            <Trash size={16} />
          </IconButton>
        </Box>
      </Card>
    );
  };

  const handleFoodDrop = (toIndex: number) => {
    if (dragFoodIndex === null || toIndex === dragFoodIndex || !selectedMealId || !selectedPlanId || !selectedCycleId) return;
    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
      ...p,
      cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
        ...c,
        meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
          ...m,
          foodItems: reorderArray(m.foodItems || [], dragFoodIndex, toIndex)
        }))
      }))
    })));
    setDragFoodIndex(null);
    setIsPlanDirty(true);
  };

  const handleMealDrop = (toIndex: number) => {
    if (dragMealIndex === null || toIndex === dragMealIndex || !selectedPlanId || !selectedCycleId) return;
    // Update plans tree
    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
      ...p,
      cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
        ...c,
        meals: reorderArray(c.meals || [], dragMealIndex, toIndex)
      }))
    })));
    // Keep currentMeals in sync
    setCurrentMeals((prev) => reorderArray(prev || [], dragMealIndex, toIndex));
    setDragMealIndex(null);
    setIsPlanDirty(true);
  };

  // Load workspace food items
  useEffect(() => {
    const loadFood = async () => {
      try {
        setLoadingFood(true);
        const response = await api.get('/api/nutrition/food-items');
        setWorkspaceFood(response.data.foodItems || []);
      } catch (err: any) {
        openSnackbar({
          open: true,
          message: 'Failed to load food items',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoadingFood(false);
      }
    };
    loadFood();
  }, []);

  // Load client name
  useEffect(() => {
    const loadClient = async () => {
      if (!clientId) return;
      try {
        const res = await api.get(`/api/clients/${clientId}`);
        const name = res.data?.client?.fullName || res.data?.client?.name || res.data?.fullName || res.data?.name || '';
        if (name) setClientName(name);
      } catch {
        // ignore
      }
    };
    loadClient();
  }, [clientId]);

  // Load recipes
  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const res = await api.get('/api/nutrition/recipes');
      setRecipes(res.data.recipes || []);
    } catch {
      // ignore
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Helpers: totals
  const computeMealTotals = (meal: Meal) => {
    const totals = (meal.foodItems || []).reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const base = item.foodItem?.servingSize || 100;
        const factor = base ? qty / base : 0;
        // Match the calculation used in food items cards (no division by 100)
        acc.calories += Math.round((item.foodItem?.calories || 0) * factor);
        acc.protein += Math.round((item.foodItem?.protein || 0) * factor);
        acc.carbs += Math.round((item.foodItem?.carbs || 0) * factor);
        acc.fat += Math.round((item.foodItem?.fat || 0) * factor);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return totals;
  };

  const computeCycleTotals = (cycle: Cycle) => {
    const totals = (cycle.meals || []).reduce(
      (acc, m) => {
        const t = computeMealTotals(m);
        acc.calories += t.calories;
        acc.protein += t.protein;
        acc.carbs += t.carbs;
        acc.fat += t.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return totals;
  };

  const computePlanTotals = (plan: Plan) => {
    const totals = (plan.cycles || []).reduce(
      (acc, c) => {
        const t = computeCycleTotals(c);
        acc.calories += t.calories;
        acc.protein += t.protein;
        acc.carbs += t.carbs;
        acc.fat += t.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return totals;
  };

  // Tools: compute macro energy distribution for a cycle
  const computeCycleMacroEnergy = (cycle?: Cycle) => {
    if (!cycle) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 };
    const totals = computeCycleTotals(cycle);
    const proteinG = totals.protein;
    const carbsG = totals.carbs;
    const fatG = totals.fat;
    const proteinKcal = proteinG * 4;
    const carbsKcal = carbsG * 4;
    const fatKcal = fatG * 9;
    const calories = proteinKcal + carbsKcal + fatKcal;
    return { calories, proteinG, carbsG, fatG, proteinKcal, carbsKcal, fatKcal };
  };

  const MacroDonut: React.FC<{ cycle?: Cycle }> = ({ cycle }) => {
    const { calories, proteinKcal, carbsKcal, fatKcal, proteinG, carbsG, fatG } = computeCycleMacroEnergy(cycle);
    // Theme-aware colors for light and dark modes
    const isDark = theme.palette.mode === 'dark';
    const macroColors = {
      protein: isDark ? '#64b5f6' : '#1976d2',
      carbs: isDark ? '#81c784' : '#388e3c',
      fat: isDark ? '#ffb74d' : '#f57c00'
    };
    const data = [
      { key: 'Protein', kcal: proteinKcal, grams: proteinG, color: macroColors.protein },
      { key: 'Carbs', kcal: carbsKcal, grams: carbsG, color: macroColors.carbs },
      { key: 'Fat', kcal: fatKcal, grams: fatG, color: macroColors.fat }
    ];
    const total = data.reduce((acc, d) => acc + d.kcal, 0) || 1;
    // Donut SVG settings
    const size = 180;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const [hoverKey, setHoverKey] = useState<string | null>(null);
    return (
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <g transform={`translate(${size / 2}, ${size / 2})`}>
              <circle r={radius} fill="transparent" stroke="#e0e0e0" strokeWidth={16} />
              {data.map((d) => {
                const portion = d.kcal / total;
                const dash = portion * circumference;
                const dashArray = `${dash} ${circumference - dash}`;
                const rotation = (offset / circumference) * 360 - 90; // start at top
                offset += dash;
                return (
                  <g key={d.key} transform={`rotate(${rotation})`}>
                    <circle
                      r={radius}
                      fill="transparent"
                      stroke={d.color}
                      strokeWidth={hoverKey === d.key ? 20 : 16}
                      strokeDasharray={dashArray}
                      strokeLinecap="butt"
                      onMouseEnter={() => setHoverKey(d.key)}
                      onMouseLeave={() => setHoverKey(null)}
                      style={{ cursor: 'pointer', transition: 'stroke-width .15s ease' }}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', flexDirection: 'column' }}>
            <Typography variant="subtitle2" sx={{ lineHeight: 1 }}>Total</Typography>
            <Typography variant="h6" sx={{ lineHeight: 1 }}>{Math.round(calories)} kcal</Typography>
          </Box>
        </Box>
        <Box sx={{ minWidth: 220 }}>
          {data.map((d) => (
            <Box key={d.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }} onMouseEnter={() => setHoverKey(d.key)} onMouseLeave={() => setHoverKey(null)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: d.color, borderRadius: '50%' }} />
                <Typography variant="body2" sx={{ fontWeight: hoverKey === d.key ? 700 : 500 }}>{d.key}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {Math.round(d.kcal)} kcal • {Math.round(d.grams)} g
              </Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">Hover segments for details.</Typography>
        </Box>
      </Box>
    );
  };

  // Horizontal macro bar: kcal | P | F | C (colored segments in one line)
  const CycleMacroBar: React.FC<{ cycle?: Cycle; meals?: Meal[] }> = ({ cycle, meals }) => {
    if (!cycle) return null as any;
    const effectiveMeals = (meals && meals.length > 0) ? meals : (cycle.meals || []);
    const t = effectiveMeals.length > 0 ? effectiveMeals.reduce((acc, m) => {
      const mt = computeMealTotals(m);
      acc.calories += mt.calories; acc.protein += mt.protein; acc.carbs += mt.carbs; acc.fat += mt.fat; return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 }) : computeCycleTotals(cycle);
    const pG = Math.max(0, Number(t.protein) || 0);
    const fG = Math.max(0, Number(t.fat) || 0);
    const cG = Math.max(0, Number(t.carbs) || 0);
    const pKcal = Math.round(pG * 4);
    const fKcal = Math.round(fG * 9);
    const cKcal = Math.round(cG * 4);
    const totalG = Math.max(1, pG + fG + cG);
    const pctG = (g: number) => `${Math.round((g / totalG) * 1000) / 10}%`;
    
    // Theme-aware colors for light and dark modes
    const isDark = theme.palette.mode === 'dark';
    const colors = {
      p: isDark ? '#ffc107' : '#f57c00',      // Protein: yellow (lighter in dark, darker in light)
      c: isDark ? '#64b5f6' : '#1565c0',      // Carbs: blue (lighter in dark, darker in light)
      f: isDark ? '#ef5350' : '#c62828'       // Fat: red (lighter in dark, darker in light)
    };
    
    const tooltip = (label: string, grams: number) => `${label}: ${Math.round((grams / totalG) * 1000) / 10}% • ${Math.round(grams)} g`;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
        {/* Full width bar */}
        <Box sx={{ width: '100%' }}>
          <Box sx={{ height: 14, borderRadius: 8, overflow: 'hidden', display: 'flex', boxShadow: 0.5 }}>
            <Tooltip title={tooltip('P', pG)} arrow>
              <Box sx={{ width: pctG(pG), bgcolor: colors.p }} />
            </Tooltip>
            <Tooltip title={tooltip('F', fG)} arrow>
              <Box sx={{ width: pctG(fG), bgcolor: colors.f }} />
            </Tooltip>
            <Tooltip title={tooltip('C', cG)} arrow>
              <Box sx={{ width: pctG(cG), bgcolor: colors.c }} />
            </Tooltip>
          </Box>
        </Box>
        {/* Protein | Carbs | Fat layout */}
        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center' }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: colors.p, fontWeight: 600, mb: 0.5 }}>Protein</Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
              {Math.round(pG)}g
            </Typography>
          </Box>
          <Typography sx={{ color: 'text.primary', fontSize: '1rem', mx: 1, userSelect: 'none', opacity: 0.6 }}>|</Typography>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: colors.c, fontWeight: 600, mb: 0.5 }}>Carbs</Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
              {Math.round(cG)}g
            </Typography>
          </Box>
          <Typography sx={{ color: 'text.primary', fontSize: '1rem', mx: 1, userSelect: 'none', opacity: 0.6 }}>|</Typography>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: colors.f, fontWeight: 600, mb: 0.5 }}>Fat</Typography>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
              {Math.round(fG)}g
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  // Calculate macros and micronutrients for current cycle
  const calculateCurrentCycleMacros = () => {
    if (!currentCycle) {
      return {
        cycleName: 'Current Cycle',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        proteinKcal: 0,
        carbsKcal: 0,
        fatKcal: 0,
        micronutrients: {}
      };
    }
    
    // PRIORITY: Always calculate from currentMeals if available (real-time calculation)
    // This ensures the analysis updates immediately as user makes changes, not just after saving
    // Also fallback to cycle.meals if currentMeals is empty but cycle has meals
    const mealsToCalculate = (currentMeals && currentMeals.length > 0) ? currentMeals : (currentCycle.meals || []);
    
    if (mealsToCalculate && mealsToCalculate.length > 0) {
    // Calculate basic macros
      const totals = mealsToCalculate.reduce((acc, m) => {
      const mt = computeMealTotals(m);
      acc.calories += mt.calories;
      acc.protein += mt.protein;
      acc.carbs += mt.carbs;
      acc.fat += mt.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // Calculate micronutrients
    const micronutrients: Record<string, number> = {};
    const nutrientKeys = [
      "water", "ash", "fiber", "sodium", "potassium", "calcium", "phosphorous", 
      "magnesium", "iron", "zinc", "copper", "manganese", "fluoride", "selenium",
      "vitamin_a", "vitamin_c", "vitamin_b1", "vitamin_b2", "vitamin_b5", "vitamin_b6", 
      "vitamin_b12", "vitamin_d", "vitamin_e", "vitamin_k", "niacin", "folic_acid", 
      "choline", "betaine"
    ];
    
      mealsToCalculate.forEach(meal => {
      meal.foodItems?.forEach(fi => {
        const qty = Number(fi.quantity ?? 1);
        const foodItem = fi.foodItem;
        if (foodItem) {
          nutrientKeys.forEach(key => {
            const base = Number(foodItem[key] ?? 0);
            if (!isNaN(base) && base > 0) {
              // Micros stored per 100g → scale by grams/100
              micronutrients[key] = (micronutrients[key] || 0) + (base * qty / 100);
            }
          });
        }
      });
    });
    
    // Totals already computed using serving-size scaling; use as-is
    const calories = Math.round(totals.calories);
    const protein = Math.round(totals.protein);
    const carbs = Math.round(totals.carbs);
    const fat = Math.round(totals.fat);
    
    return {
      cycleName: currentCycle.label || currentCycle.title || 'Current Cycle',
      calories: calories,
      protein: protein,
      carbs: carbs,
      fat: fat,
      proteinKcal: Math.round(protein * 4),
      carbsKcal: Math.round(carbs * 4),
      fatKcal: Math.round(fat * 9),
      micronutrients
    };
    }
    
    // FALLBACK: Use microTotals from API if currentMeals not available (e.g., initial load)
    if (currentCycle.microTotals) {
      const microTotals = currentCycle.microTotals;
      // Server now returns correctly scaled totals; no UI normalization required
      const calories = Math.round(microTotals.calories || 0);
      const protein = Math.round(microTotals.protein || 0);
      const carbs = Math.round(microTotals.carbs || 0);
      const fat = Math.round(microTotals.fat || 0);
      
      return {
        cycleName: currentCycle.label || currentCycle.title || 'Current Cycle',
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        proteinKcal: Math.round(protein * 4),
        carbsKcal: Math.round(carbs * 4),
        fatKcal: Math.round(fat * 9),
        micronutrients: Object.fromEntries(
          Object.entries(microTotals).filter(([key]) => 
            !['calories', 'protein', 'carbs', 'fat'].includes(key)
          )
        )
      };
    }
    
    // Final fallback: return zeros if no data available
    return {
      cycleName: currentCycle.label || currentCycle.title || 'Current Cycle',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      proteinKcal: 0,
      carbsKcal: 0,
      fatKcal: 0,
      micronutrients: {}
    };
  };

  // Load plans
  // Load all nutrition plans with their cycles and meals
  const loadAllPlansData = async () => {
    try {
      setLoadingPlans(true);
      // Use client-specific endpoint to only load plans for this client
      const response = await api.get(`/api/clients/${clientId}/nutrition/plans`);
      const plansData = response.data.plans || [];
      
      // Load cycles and meals for each plan
      const plansWithData = await Promise.all(
        plansData.map(async (plan: Plan) => {
          try {
            // Load cycles for this plan using the endpoint that includes water data
            const cyclesResponse = await api.get(`/api/nutrition/plans/${plan.id}/cycles`);
            const cycles = cyclesResponse.data.cycles || [];
            const planData = cyclesResponse.data.plan || {};
            
            // Load meals for each cycle
            const cyclesWithMeals = await Promise.all(
              cycles.map(async (cycle: Cycle) => {
                try {
                  const mealsResponse = await api.get(`/api/clients/${clientId}/nutrition/cycles/${cycle.id}/meals`);
                    // Ensure meal objects carry food items if provided by API; otherwise default to empty array
                    const apiMeals = mealsResponse.data.meals || [];
                    const normalizedMeals = apiMeals.map((m: any) => ({
                      ...m,
                      foodItems: Array.isArray(m.foodItems) ? m.foodItems : []
                    }));
                    // Preserve microTotals from the first API call
                    return { ...cycle, meals: normalizedMeals, microTotals: cycle.microTotals };
                } catch (err) {
                  console.warn(`Failed to load meals for cycle ${cycle.id}:`, err);
                  return {
                    ...cycle,
                    meals: []
                  };
                }
              })
            );
            
            const updatedPlan = {
              ...plan,
              cycles: cyclesWithMeals,
              // Include water data from the plan response
              waterForDay: planData.waterForDay || 0,
              waterForTraining: planData.waterForTraining || 0
            };
            
            
            return updatedPlan;
          } catch (err) {
            console.warn(`Failed to load cycles for plan ${plan.id}:`, err);
            return {
              ...plan,
              cycles: [],
              waterForDay: 0,
              waterForTraining: 0
            };
          }
        })
      );
      
      setPlans(plansWithData);
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: 'Failed to load nutrition plans',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (clientId) loadAllPlansData();
  }, [clientId]);

  // Update current working data when plan data changes; preserve selected cycle if possible
  useEffect(() => {
    if (!selectedPlanId) {
      setCurrentCycles([]);
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setCurrentMeals([]);
      return;
    }

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    if (!selectedPlan) {
      setCurrentCycles([]);
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setCurrentMeals([]);
      return;
    }

    const cycles = selectedPlan.cycles || [];
    setCurrentCycles(cycles);

    if (cycles.length === 0) {
      setSelectedCycleId(null);
      setCurrentCycleIndex(0);
      setCurrentMeals([]);
      return;
    }

    // Try to keep the previously selected cycle
    const existingCycleId = selectedCycleId;
    const existingIndex = cycles.findIndex((c) => c.id === existingCycleId);

    if (existingCycleId && existingIndex !== -1) {
      setSelectedCycleId(existingCycleId);
      setCurrentCycleIndex(existingIndex);
      setCurrentMeals(cycles[existingIndex].meals || []);
    } else {
      // Fallback: keep current index if in range; else default to first
      const safeIndex = Math.min(currentCycleIndex, Math.max(0, cycles.length - 1));
      setCurrentCycleIndex(safeIndex);
      setSelectedCycleId(cycles[safeIndex].id);
      setCurrentMeals(cycles[safeIndex].meals || []);
    }
    // Do not clear selected meal here; the cycle effect below will validate it
  }, [selectedPlanId, plans]);

  // Update current meals when cycle is selected
  useEffect(() => {
    if (!selectedCycleId || !currentCycles.length) {
      setCurrentMeals([]);
      setSelectedMealId(null);
      return;
    }

    const selectedCycle = currentCycles.find(c => c.id === selectedCycleId);
    if (selectedCycle && selectedCycle.meals) {
      setCurrentMeals(selectedCycle.meals);
    } else {
      setCurrentMeals([]);
    }
    
    // Preserve selected meal if it still exists in this cycle; otherwise clear it
    if (selectedMealId) {
      const stillExists = !!selectedCycle?.meals?.some((m) => m.id === selectedMealId);
      if (!stillExists) setSelectedMealId(null);
    }
  }, [selectedCycleId, currentCycles]);

      // Update water values when plan is selected
  useEffect(() => {
    if (!selectedPlanId) {
      setWaterForDay(0);
      setWaterForTraining(0);
      return;
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (selectedPlan) {
      setWaterForDay(selectedPlan.waterForDay || 0);
      setWaterForTraining(selectedPlan.waterForTraining || 0);
    }
  }, [selectedPlanId, plans]);

  // When switching to a different plan explicitly, clear selected meal
  useEffect(() => {
    // If plan changes, the meal context is no longer valid
    setSelectedMealId(null);
  }, [selectedPlanId]);

  const filteredPlans = plans
    .filter(plan => plan.title.toLowerCase().includes(planQuery.toLowerCase()))
    .sort((a, b) => {
      // Active plans always at top
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      // Then sort by createdAt descending (newest first)
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

  const handleCopyPlanCard = async (planId: string) => {
    if (!clientId) return;
    try {
      setCopyingPlanId(planId);
      await api.post(`/api/nutrition/plans/${planId}/copy`, { targetClientId: clientId });
      await loadAllPlansData();
      openSnackbar({ open: true, message: 'Plan copied', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
    } catch {
      openSnackbar({ open: true, message: 'Failed to copy plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setCopyingPlanId(null);
    }
  };

  const handleDeletePlanCard = async (planId: string) => {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      setDeletingPlanId(planId);
      await api.delete(`/api/nutrition/plans/${planId}`);
      await loadAllPlansData();
      if (selectedPlanId === planId) {
        setSelectedPlanId(null);
      }
      openSnackbar({ open: true, message: 'Plan deleted', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
    } catch {
      openSnackbar({ open: true, message: 'Failed to delete plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim() || !clientId) return;
    try {
      setSaving(true);
      // Create on server immediately and get defaultCycle back
      // Prefer client-scoped endpoint for consistent permissions and defaults
      const res = await api.post(`/api/clients/${clientId}/nutrition/plans`, { title: newPlanTitle.trim() });
      const created = res.data?.plan;
      const defaultCycle = res.data?.defaultCycle;

      if (created?.id) {
        // Build plan object for UI with initial cycle (no meals yet)
        const planForUi: any = {
          id: created.id,
          title: created.title,
          createdAt: created.createdAt,
          cycles: defaultCycle ? [
            {
              id: defaultCycle.id,
              title: defaultCycle.label || `Cycle ${defaultCycle.dayIndex}`,
              label: defaultCycle.label,
              dayIndex: defaultCycle.dayIndex,
              meals: []
            }
          ] : []
        };

        setPlans((prev) => [planForUi, ...prev]);
        setSelectedPlanId(created.id);
        setNewPlanTitle('');
        setIsCreatePlanDialogOpen(false);
        setIsPlanDirty(false);
        openSnackbar({ open: true, message: 'Plan created', variant: 'alert', alert: { color: 'success', variant: 'filled' } } as any);
      }
    } catch (err) {
      openSnackbar({ open: true, message: 'Failed to create plan', variant: 'alert', alert: { color: 'error', variant: 'filled' } } as any);
    } finally {
      setSaving(false);
    }
  };


  const handleCreateMeal = () => {
    if (!newMealTitle.trim() || !selectedCycleId || !selectedPlanId) return;
    const tempId = `tmpm-${Date.now()}`;
    const newMeal: Meal = { id: tempId, dayId: selectedCycleId, meal: newMealTitle, notes: '', foodItems: [] };
    
    // Update the plan's cycle with the new meal
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.map(cycle =>
              cycle.id === selectedCycleId
                ? {
                    ...cycle,
                    meals: [...(cycle.meals || []), newMeal]
                  }
                : cycle
            ) || []
          }
        : plan
    ));
    
    setSelectedMealId(tempId);
    setNewMealTitle('');
    setIsCreateMealDialogOpen(false);
    setIsPlanDirty(true);
  };

  const handleAddFoodToMeal = () => {
    if (!selectedFoodItems.length || !selectedMealId) return;
    const baseMeal = currentMeals.find((m) => m.id === selectedMealId);
    if (!baseMeal) return;
    const added: MealFoodItem[] = selectedFoodItems
      .map((foodItemId) => {
        const food = workspaceFood.find((f) => f.id === foodItemId);
        if (!food) return null;
        return {
          id: `tmpfi-${baseMeal.id}-${foodItemId}-${Date.now()}`,
          mealId: baseMeal.id,
          foodItemId,
          quantity: food.servingSize || 100,
          foodItem: food
        } as MealFoodItem;
      })
      .filter(Boolean) as MealFoodItem[];
    
    // Update currentMeals immediately for real-time calculation
    setCurrentMeals((prev) => prev.map(meal =>
      meal.id === baseMeal.id
        ? { ...meal, foodItems: [...(meal.foodItems || []), ...added] }
        : meal
    ));
    
    // Update the plan's meal with the new food items
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.map(cycle =>
              cycle.id === baseMeal.dayId
                ? {
                    ...cycle,
                    meals: cycle.meals?.map(meal =>
                      meal.id === baseMeal.id
                        ? { ...meal, foodItems: [...(meal.foodItems || []), ...added] }
                        : meal
                    ) || []
                  }
                : cycle
            ) || []
          }
        : plan
    ));
    
    setSelectedFoodItems([]);
    setIsAddFoodDialogOpen(false);
    setIsPlanDirty(true);
  };

  const showSection2 = !!selectedPlanId;
  const showSection3 = !!selectedMealId;
  
  const handleSavePlan = async () => {
    if (!selectedPlanId) return;
    
    try {
      setSaving(true);
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (!selectedPlan) return;
      
      // Persist plan, cycles, meals, and food items
      // 1) Ensure plan exists on server
      let serverPlanId = selectedPlanId;
      if (selectedPlanId.startsWith('tmp-')) {
        const createPlanRes = await api.post(`/api/clients/${clientId}/nutrition/plans`, { title: selectedPlan.title });
        serverPlanId = createPlanRes.data.plan.id;
        // replace temp id
        setPlans((prev) => prev.map((p) => (p.id === selectedPlanId ? { ...p, id: serverPlanId } : p)));
        setSelectedPlanId(serverPlanId);
      }

      // 2) Sync cycles
      const cyclesToSync = selectedPlan.cycles || [];
      const createdCycleIdMap: Record<string, string> = {};

      // If the plan was just created, the backend may have already created initial cycles.
      // Fetch existing server cycles and map local temporary cycles to server ones by dayIndex to avoid duplicates.
      let existingServerCycles: Cycle[] = [] as any;
      try {
        const existingCyclesRes = await api.get(`/api/clients/${clientId}/nutrition/plans/${serverPlanId}/cycles`);
        existingServerCycles = (existingCyclesRes.data.cycles || []) as any;
      } catch {}

      for (const c of cyclesToSync) {
        let serverCycleId = c.id;
        if (c.id.startsWith('tmpc-')) {
          // Try to match an existing server cycle by dayIndex to prevent creating a duplicate
          const matched = existingServerCycles.find((sc: any) => Number(sc.dayIndex) === Number(c.dayIndex));
          if (matched) {
            createdCycleIdMap[c.id] = matched.id;
            continue;
          }

          const res = await api.post(`/api/clients/${clientId}/nutrition/plans/${serverPlanId}/cycles`, {
            title: c.title,
            label: c.label,
            dayIndex: c.dayIndex,
            notes: c.notes
          });
          serverCycleId = res.data.cycle.id;
          createdCycleIdMap[c.id] = serverCycleId;
        }
      }

      // 3) Sync meals
      const createdMealIdMap: Record<string, string> = {};
      for (const cycle of cyclesToSync) {
        const effectiveCycleId = createdCycleIdMap[cycle.id] || cycle.id;
        for (const meal of cycle.meals || []) {
          let serverMealId = meal.id;
          if (meal.id.startsWith('tmpm-')) {
          const res = await api.post(`/api/clients/${clientId}/nutrition/cycles/${effectiveCycleId}/meals`, {
              title: meal.meal,
              notes: meal.notes
            });
            serverMealId = res.data.meal.id;
            createdMealIdMap[meal.id] = serverMealId;
          }
          else {
            // Update existing meal metadata (e.g., notes)
            const effectiveMealId = createdMealIdMap[meal.id] || meal.id;
            await api.put(`/api/clients/${clientId}/nutrition/meals/${effectiveMealId}`, {
              title: meal.meal,
              notes: meal.notes
            });
          }
        }
      }

      // 4) Sync all plan data using bulk upsert (includes recipe data)
      // Use currentMeals as the source of truth for food items to ensure deletions are persisted
      const daysData = cyclesToSync.map((cycle) => ({
        dayIndex: cycle.dayIndex,
        label: cycle.label || '',
        items: (cycle.meals || []).flatMap((meal) => {
          // Find the corresponding meal in currentMeals to get the most up-to-date food items
          const currentMeal = currentMeals.find(m => m.id === meal.id);
          // Use currentMeal.foodItems if available (most up-to-date), otherwise fall back to meal.foodItems
          const foodItemsToSave = currentMeal?.foodItems || meal.foodItems || [];
          const mealItems = foodItemsToSave.map((item) => {
            const servingSize = (item as any)?.foodItem?.servingSize || 100;
            const override = (editingQuantities as any)?.[item.id];
            const candidate = override ?? (item as any)?.quantity ?? ((item as any)?.servings ? (Number((item as any).servings) * servingSize) : undefined);
            const quantity = typeof candidate === 'number' ? candidate : Number(candidate);
            return {
              foodItemId: item.foodItemId,
              quantity: Number.isFinite(quantity) ? quantity : 0,
              mealKey: meal.id,
              meal: meal.meal || '',
              notes: meal.notes || '',
              recipeName: (currentMeal as any)?.recipeName || '',
              recipeNameArabic: (currentMeal as any)?.recipeNameArabic || '',
              recipeImageUrl: (currentMeal as any)?.recipeImageUrl || ''
            };
          });
          
          // If meal has recipe but no food items, create a recipe-only item
          if (mealItems.length === 0 && (currentMeal as any)?.recipeName) {
            mealItems.push({
              foodItemId: null,
              servings: 1,
              mealKey: meal.id,
              meal: meal.meal || '',
              notes: meal.notes || '',
              recipeName: (currentMeal as any)?.recipeName || '',
              recipeNameArabic: (currentMeal as any)?.recipeNameArabic || '',
              recipeImageUrl: (currentMeal as any)?.recipeImageUrl || ''
            });
          }
          
          // Always include the meal, even if it's empty (no food items and no recipe)
          // This ensures empty meals are preserved when saving
          if (mealItems.length === 0) {
            mealItems.push({
              foodItemId: null,
              quantity: 0,
              mealKey: meal.id,
              meal: meal.meal || '',
              notes: meal.notes || '',
              recipeName: (currentMeal as any)?.recipeName || null,
              recipeNameArabic: (currentMeal as any)?.recipeNameArabic || null,
              recipeImageUrl: (currentMeal as any)?.recipeImageUrl || null
            });
          }
          
          return mealItems;
        })
      }));

      await api.put(`/api/nutrition/plans/${serverPlanId}/days`, {
        days: daysData
      });

      // 5) Update plan metadata including water data
      await api.put(`/api/nutrition/plans/${serverPlanId}`, {
        title: selectedPlan.title,
        waterForDay: selectedPlan.waterForDay || 0,
        waterForTraining: selectedPlan.waterForTraining || 0,
      });

      // Update local state immediately with the saved water data
      setPlans((prev) => prev.map((p) => 
        p.id === selectedPlanId 
          ? { ...p, waterForDay: selectedPlan.waterForDay || 0, waterForTraining: selectedPlan.waterForTraining || 0 }
          : p
      ));

      setIsPlanDirty(false);
      
      // Preserve the selected plan ID before reloading
      const preservedPlanId = serverPlanId;
      
      // Reload all plans data to get fresh server data
      await loadAllPlansData();
      
      // Ensure the saved plan remains selected
      setSelectedPlanId(preservedPlanId);
      
      openSnackbar({
        open: true,
        message: 'Plan saved and activated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to save plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleActivatePlan = async () => {
    if (!selectedPlanId) return;
    try {
      setActivating(true);
      // Ensure plan is saved to server and not dirty
      if (selectedPlanId.startsWith('tmp-') || isPlanDirty) {
        await handleSavePlan();
      }
      
      // Check for submitted nutrition forms
      try {
        const formsResponse = await api.get(`/api/forms/submitted-by-type?clientId=${clientId}&type=nutrition`);
        const forms = formsResponse.data?.submissions || [];
        
        if (forms.length > 0) {
          // Show dialog to let coach mark forms as done
          setSubmittedForms(forms);
          setSelectedFormsToArchive([]);
          setFormCompletionDialogOpen(true);
          setActivating(false);
          return; // Wait for dialog action
        }
      } catch (err) {
        console.error('Error checking forms:', err);
        // Continue with activation even if form check fails
      }
      
      const planIdToActivate = selectedPlanId;
      await api.post(`/api/nutrition/plans/${planIdToActivate}/activate`, {});
      // Reflect status locally (activate this plan, deactivate others)
      setPlans((prev) => prev.map((p) => ({ ...p, status: p.id === planIdToActivate ? 'active' : (p.clientId === (prev.find(pp => pp.id === planIdToActivate)?.clientId) ? 'inactive' : p.status) })));
      openSnackbar({
        open: true,
        message: 'Plan activated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      
      // Show form scheduling popup after successful activation
      setFormSchedulingPopupOpen(true);
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to activate plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActivating(false);
    }
  };
  
  const handleFormCompletionContinue = async () => {
    try {
      setArchivingForms(true);
      
      // Archive selected forms
      for (const formId of selectedFormsToArchive) {
        await api.post(`/api/forms/submissions/${formId}/archive`);
      }
      
      // Close dialog
      setFormCompletionDialogOpen(false);
      
      // Continue with plan activation
      const planIdToActivate = selectedPlanId;
      if (planIdToActivate) {
        await api.post(`/api/nutrition/plans/${planIdToActivate}/activate`, {});
        setPlans((prev) => prev.map((p) => ({ ...p, status: p.id === planIdToActivate ? 'active' : (p.clientId === (prev.find(pp => pp.id === planIdToActivate)?.clientId) ? 'inactive' : p.status) })));
        
        openSnackbar({
          open: true,
          message: `Plan activated successfully${selectedFormsToArchive.length > 0 ? ` and ${selectedFormsToArchive.length} form(s) marked as done` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Show form scheduling popup after successful activation
        setFormSchedulingPopupOpen(true);
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to complete activation',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setArchivingForms(false);
    }
  };
  
  const handleFormSchedule = async (formId: string, scheduleAt?: string) => {
    try {
      const requestData: any = {
        formId,
        clientId,
      };

      // Add scheduleAt if scheduling is selected
      if (scheduleAt) {
        requestData.scheduleAt = scheduleAt;
      }

      await api.post('/api/forms/send', requestData);
      
      const message = scheduleAt 
        ? `Form scheduled for ${new Date(scheduleAt).toLocaleDateString()} successfully!`
        : 'Form sent to client successfully!';
      
      openSnackbar({
        open: true,
        message,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err: any) {
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.response?.data?.error || 'Failed to schedule form',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };
  
  // Get current cycle for navigation
  const currentCycle = currentCycles[currentCycleIndex];
  const canGoPrevious = currentCycleIndex > 0;
  const canGoNext = currentCycleIndex < currentCycles.length - 1;
  
  const handlePreviousCycle = () => {
    if (canGoPrevious) {
      const newIndex = currentCycleIndex - 1;
      setCurrentCycleIndex(newIndex);
      const newCycle = currentCycles[newIndex];
      setSelectedCycleId(newCycle.id);
      const firstMealId = (newCycle.meals && newCycle.meals.length > 0) ? newCycle.meals[0].id : null;
      setSelectedMealId(firstMealId);
    }
  };
  
  const handleNextCycle = () => {
    if (canGoNext) {
      const newIndex = currentCycleIndex + 1;
      setCurrentCycleIndex(newIndex);
      const newCycle = currentCycles[newIndex];
      setSelectedCycleId(newCycle.id);
      const firstMealId = (newCycle.meals && newCycle.meals.length > 0) ? newCycle.meals[0].id : null;
      setSelectedMealId(firstMealId);
    }
  };
  
  const handleCopyCycle = async () => {
    if (!selectedCycleId || !selectedPlanId) return;
    const base = currentCycles[currentCycleIndex];
    if (!base) return;
    const newId = `tmpc-${Date.now()}`;
    const copy: Cycle = {
      id: newId,
      title: `${base.title} (Copy)`,
      label: `${base.label} (Copy)`,
      dayIndex: currentCycles.length + 1,
      meals: base.meals?.map(meal => {
        const newMealId = `tmpm-${Date.now()}-${Math.random()}`;
        const copiedFoodItems = (meal.foodItems || []).map((fi: any, idx: number) => ({
          ...fi,
          id: `tmpfi-${newMealId}-${fi.foodItemId || fi.foodItem?.id || idx}-${Date.now()}`,
          mealId: newMealId
        }));
        return { ...meal, id: newMealId, dayId: newId, foodItems: copiedFoodItems };
      }) || []
    };
    
    // Update the plan with the new cycle
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? { ...plan, cycles: [...(plan.cycles || []), copy] }
        : plan
    ));
    
    setCurrentCycleIndex(currentCycles.length);
    setSelectedCycleId(newId);
    setSelectedMealId(copy.meals && copy.meals.length > 0 ? copy.meals[0].id : null);
    setIsPlanDirty(true);
  };

  const handleAddCycle = () => {
    if (!selectedPlanId) return;
    const newId = `tmpc-${Date.now()}`;
    const newCycle: Cycle = {
      id: newId,
      title: `Day ${currentCycles.length + 1}`,
      label: `Day ${currentCycles.length + 1}`,
      dayIndex: currentCycles.length + 1,
      meals: []
    };
    
    // Update the plan with the new cycle
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? { ...plan, cycles: [...(plan.cycles || []), newCycle] }
        : plan
    ));
    
    setCurrentCycleIndex(currentCycles.length);
    setSelectedCycleId(newId);
    setSelectedMealId(null);
    setIsPlanDirty(true);
  };

  const handleDeleteCycle = () => {
    if (currentCycles.length <= 1 || !selectedCycleId || !selectedPlanId) return; // cannot delete last cycle
    
    // Update the plan by removing the cycle
    setPlans((prev) => prev.map(plan => 
      plan.id === selectedPlanId 
        ? {
            ...plan,
            cycles: plan.cycles?.filter((_, idx) => idx !== currentCycleIndex)
              .map((c, i) => ({ ...c, dayIndex: i + 1 })) || []
          }
        : plan
    ));
    
    const newIndex = Math.max(0, currentCycleIndex - 1);
    const targetCycle = currentCycles[newIndex];
    setCurrentCycleIndex(newIndex);
    if (targetCycle) {
      setSelectedCycleId(targetCycle.id);
      const firstMealId = (targetCycle.meals && targetCycle.meals.length > 0) ? targetCycle.meals[0].id : null;
      setSelectedMealId(firstMealId);
    } else {
      setSelectedCycleId(null);
      setSelectedMealId(null);
    }
    setIsPlanDirty(true);
  };

  const ensureClientThread = useCallback(async () => {
    if (!clientId) return null;
    try {
      setChatLoading(true);
      // Try to find an existing thread first
      const inbox = await api.get('/api/messenger/inbox');
      const existing = (inbox.data?.threads || []).find((t: any) => t.client?.id === clientId);
      if (existing) {
        setChatThreadId(existing.id);
        return existing.id as string;
      }
      // Create a new thread with this client
      const created = await api.post('/api/messenger/threads', { clientId });
      const id = created.data?.thread?.id || created.data?.id;
      setChatThreadId(id);
      return id as string;
    } catch (e: any) {
      setChatError('Failed to open chat');
      return null;
    } finally {
      setChatLoading(false);
    }
  }, [clientId]);

  const loadChatMessages = useCallback(async (threadIdParam?: string) => {
    const id = threadIdParam || chatThreadId;
    if (!id) return;
    try {
      const { data } = await api.get(`/api/messenger/threads/${id}/messages`);
      setChatMessages(data?.messages || []);
    } catch {}
  }, [chatThreadId]);

  const startChatPolling = useCallback((id: string) => {
    if (chatPollRef.current) window.clearInterval(chatPollRef.current);
    chatPollRef.current = window.setInterval(() => loadChatMessages(id), 4000) as unknown as number;
  }, [loadChatMessages]);

  useEffect(() => {
    if (plansTab === 3) {
      (async () => {
        const id = await ensureClientThread();
        if (id) {
          await loadChatMessages(id);
          startChatPolling(id);
        }
      })();
    } else if (chatPollRef.current) {
      window.clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }
    return () => {
      if (chatPollRef.current) {
        window.clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
  }, [plansTab, ensureClientThread, loadChatMessages, startChatPolling]);

  const handleSendChat = async () => {
    if (!chatThreadId || (!chatInput.trim() && attachments.length === 0)) return;
    
    setUploading(true);
    try {
      // Upload files first if any
      let uploadedFiles: any[] = [];
      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach((file) => {
          formData.append('files', file);
        });
        
        const { data } = await api.post('/api/messenger/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedFiles = data.files || [];
      }

      // Send message with attachments
      await api.post(`/api/messenger/threads/${chatThreadId}/messages`, { 
        body: chatInput.trim() || (uploadedFiles.length > 0 ? `📎 ${uploadedFiles.length} attachment${uploadedFiles.length > 1 ? 's' : ''}` : ''),
        attachments: uploadedFiles.length > 0 ? uploadedFiles : undefined
      });
      
      setChatInput('');
      setAttachments([]);
      await loadChatMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatError('Failed to send message');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachments([file]); // Only allow one file
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // auto-scroll to bottom when messages change
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const loadClientForms = useCallback(async () => {
    if (!clientId) return;
    try {
      setFormsLoading(true);
      setFormsError(null);
      // Prefer new submitted endpoint
      let submissions: any[] = [];
      try {
        const res = await api.get(`/api/forms/client/${clientId}/submitted`);
        const raw = res.data?.submissions;
        submissions = Array.isArray(raw) ? raw : [];
      } catch {
        // Fallback: queue items then filter
        const res2 = await api.get(`/api/forms/queue`);
        const items = Array.isArray(res2.data?.items) ? res2.data.items : [];
        submissions = items.filter((s: any) => s.clientId === clientId).map((s: any) => ({
          id: s.id,
          formId: s.formId,
          formTitle: s.formTitle,
          formType: s.formType,
          status: s.status,
          submittedAt: s.completedAt || s.sentAt || s.scheduledAt,
          answers: undefined,
        }));
      }
      setFormsSubmissions(submissions);
    } catch (e: any) {
      setFormsError(e.response?.data?.message || e.response?.data?.error || 'Failed to load forms');
    } finally {
      setFormsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (plansTab === 1) loadClientForms();
  }, [plansTab, loadClientForms]);

  // Optional: support deep-linking to Forms tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if ((url.searchParams.get('tab') || '').toLowerCase() === 'forms') setPlansTab(1);
    }
  }, []);

  const toggleExpandSubmission = async (submissionId: string) => {
    setExpandedSubmissionIds((prev) => ({ ...prev, [submissionId]: !prev[submissionId] }));
    // If answers not loaded yet, fetch detail
    const current = formsSubmissions.find((s) => s.id === submissionId);
    if (current && !current.answers) {
      try {
        const res = await api.get(`/api/forms/submissions/${submissionId}`);
        const detail = res.data;
        setFormsSubmissions((prev) => prev.map((s) => s.id !== submissionId ? s : ({ ...s, answers: detail?.answers || detail?.submission?.answers || {} })));
      } catch (e) {
        // ignore
      }
    }
  };

  const handleExportPDF = async () => {
    if (!selectedPlanId) {
      openSnackbar({
        open: true,
        message: 'Please select a plan first',
        variant: 'alert',
        alert: { color: 'warning' }
      } as any);
      return;
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan || !selectedPlan.cycles || selectedPlan.cycles.length === 0) {
      openSnackbar({
        open: true,
        message: 'Plan has no cycles to export',
        variant: 'alert',
        alert: { color: 'warning' }
      } as any);
      return;
    }

    try {
      setExportingPdf(true);
      
      // Try to get visual templates first
      const templatesRes = await api.get('/api/visual-pdf-templates', { params: { kind: 'nutrition' } });
      const visualTemplates = templatesRes.data?.templates || [];
      
      if (visualTemplates.length > 0) {
        // Use the first available visual template
        const templateId = visualTemplates[0].id;
        const res = await api.post(`/api/nutrition/plans/${selectedPlanId}/generate-visual-pdf`, { 
          templateId 
        });
        
        if (res.data?.pdfUrl) {
          window.open(res.data.pdfUrl, '_blank');
          openSnackbar({
            open: true,
            message: 'PDF generated successfully with visual template!',
            variant: 'alert',
            alert: { color: 'success' }
          } as any);
        }
      } else {
        // Fallback to old client-side PDF generation if no visual templates
        await exportNutritionPlanToPDF({
          workspaceName: workspaceName || 'Workspace',
          clientName: clientName || 'Client',
          planName: selectedPlan.title,
          cycles: selectedPlan.cycles.map(cycle => ({
            id: cycle.id,
            title: cycle.title,
            label: cycle.label,
            microTotals: cycle.microTotals,
            meals: cycle.meals || []
          }))
        }, selectedPlanId as string | undefined);
        
        openSnackbar({
          open: true,
          message: 'PDF exported successfully (using legacy template)',
          variant: 'alert',
          alert: { color: 'success' }
        } as any);
      }
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to export PDF',
        variant: 'alert',
        alert: { color: 'error' }
      } as any);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', maxWidth: '100vw', px: { xs: 0, md: 0 } }}>
    <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1, md: 0 } }}>
        <Typography variant="h5">{clientName || 'Client'}</Typography>
        <Stack direction="row" spacing={1} sx={{ gap: { xs: 0.5, md: 1 } }}>
          {selectedPlanId && (
            <Button 
              variant="outlined" 
              onClick={handleExportPDF} 
              disabled={exportingPdf} 
              size={isMobile ? 'small' : 'medium'}
              startIcon={<DocumentText size={16} />}
            >
              {exportingPdf ? 'Exporting...' : 'Export PDF'}
            </Button>
          )}
          <Button variant="outlined" onClick={handleSavePlan} disabled={saving} size={isMobile ? 'small' : 'medium'}>{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="contained" color="success" onClick={handleActivatePlan} disabled={!selectedPlanId || activating} size={isMobile ? 'small' : 'medium'}>
            {activating ? 'Activating…' : 'Activate'}
          </Button>
        </Stack>
      </Box>

      {/* Main Content */}
      {isMobile ? (
        <MobileSwipeableSections
          sections={[
            // Section 1: Plans
            <Card key="plans" elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
          <CardHeader
            title={
              <Box sx={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
                <Tabs 
                  value={plansTab} 
                  onChange={(_, v) => setPlansTab(v)} 
                  variant="scrollable" 
                  allowScrollButtonsMobile 
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      minWidth: 48
                    }
                  }}
                >
                  <Tab 
                    label=""
                    icon={<Category size={20} />}
                    iconPosition="top"
                  />
                  <Tab 
                    label=""
                    icon={<DocumentText size={20} />}
                    iconPosition="top"
                  />
                  <Tab 
                    label=""
                    icon={<Setting2 size={20} />}
                    iconPosition="top"
                  />
                  <Tab 
                    label=""
                    icon={<Messages2 size={20} />}
                    iconPosition="top"
                  />
                </Tabs>
              </Box>
            }
            subheader={plansTab === 0 ? (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button variant="contained" size="small" startIcon={<Add size={16} />} onClick={() => setIsCreatePlanDialogOpen(true)} sx={{ flex: 1 }}>
                    Create
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<Copy size={16} />} onClick={() => setLoadPlanDialogOpen(true)} sx={{ flex: 1 }}>
                    Load
                  </Button>
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search plans..."
                  value={planQuery}
                  onChange={(e) => setPlanQuery(e.target.value)}
                />
              </Box>
            ) : null}
          />
          <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {plansTab === 3 ? (
              <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', height: '60vh' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Chat</Typography>
                {chatError && <Alert severity="error" sx={{ mb: 1 }}>{chatError}</Alert>}
                <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }} ref={chatScrollRef}>
                    {chatLoading && chatMessages.length === 0 ? (
                      <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
                    ) : (
                      chatMessages.map((m: any) => {
                        const isClient = m.senderType === 'client';
                        return (
                        <Box key={m.id} sx={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', mb: 1 }}>
                          <Box sx={{ 
                            px: 2, 
                            py: 1.5, 
                            bgcolor: isClient ? 'primary.main' : 'background.paper',
                            color: isClient ? 'white' : 'text.primary',
                            borderRadius: 2,
                            borderBottomRightRadius: isClient ? 0 : 2,
                            borderBottomLeftRadius: isClient ? 2 : 0,
                            maxWidth: '75%',
                            boxShadow: 1
                          }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body || m.message || m.text || ''}</Typography>
                            {m.attachments && m.attachments.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                {m.attachments.map((attachment: any, index: number) => (
                                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <AttachCircle fontSize="small" />
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      href={attachment.url}
                                      target="_blank"
                                      sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                                    >
                                      {attachment.originalName || attachment.filename || `Attachment ${index + 1}`}
                                      {attachment.size && ` (${(attachment.size / 1024).toFixed(1)} KB)`}
                                    </Button>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            <Typography variant="caption" sx={{ 
                              display: 'block', 
                              mt: 0.5,
                              opacity: isClient ? 0.8 : 0.6,
                              fontSize: '0.7rem'
                            }}>
                              {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </Typography>
                          </Box>
                        </Box>
                        );
                      })
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                      fullWidth
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      sx={{ 
                        bgcolor: 'grey.100',
                        '&:hover': { bgcolor: 'grey.200' }
                      }}
                    >
                      <AttachCircle />
                    </IconButton>
                    <Button 
                      variant="contained" 
                      onClick={handleSendChat} 
                      disabled={(!chatInput.trim() && attachments.length === 0) || uploading}
                    >
                      {uploading ? 'Sending...' : 'Send'}
                    </Button>
                  </Box>
                  
                  {/* Attachment preview */}
                  {attachments.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {attachments.map((file, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </Typography>
                          <IconButton size="small" onClick={() => handleRemoveAttachment(index)}>
                            <CloseCircle />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : plansTab === 1 ? (
              <Box sx={{ py: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Forms</Typography>
                {formsError && <Alert severity="error" sx={{ mb: 2 }}>{formsError}</Alert>}
                {formsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : formsSubmissions.length === 0 ? (
                  <Typography color="text.secondary">No submissions found for this client.</Typography>
                ) : (
                  <List>
                    {formsSubmissions.map((s) => (
                      <ListItem key={s.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 1 }}>
                          <ListItemText
                            primary={s.formTitle || s.form?.title || 'Untitled form'}
                            secondary={
                              <>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {s.formType ? `${s.formType} • ` : ''}
                                  {s.submittedAt ? new Date(s.submittedAt as string).toLocaleString() : (s.createdAt ? new Date(s.createdAt as string).toLocaleString() : '')}
                                  {s.status ? ` • ${s.status}` : ''}
                                </Typography>
                              </>
                            }
                          />
                          <Button size="small" onClick={() => toggleExpandSubmission(s.id)}>
                            {expandedSubmissionIds[s.id] ? 'Hide Answers' : 'View Answers'}
                          </Button>
                        </Box>
                        {expandedSubmissionIds[s.id] && (
                          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mt: 1 }}>
                            {renderAnswerValue(s.answers || {}, s.form?.questions)}
                          </Box>
                        )}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            ) : plansTab === 2 ? (
              <Box sx={{ py: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Tools</Typography>
                <Card variant="outlined">
                  <CardHeader title="Calories / Protein / Carbs / Fat" subheader="Cycle macro distribution" />
                  <CardContent>
                    {selectedPlanId && currentCycles.length > 0 ? (
                      <>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Cycle: {currentCycles[currentCycleIndex]?.label || currentCycles[currentCycleIndex]?.title || `Day ${currentCycleIndex + 1}`}
                        </Typography>
                        <MacroDonut cycle={currentCycles[currentCycleIndex]} />
                      </>
                    ) : (
                      <Typography color="text.secondary">Select a plan and cycle to view the calculator.</Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            ) : plansTab !== 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No content for this tab yet.</Box>
            ) : loadingPlans ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2} direction="column">
                {filteredPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const createdDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : undefined;
                  return (
                    <Box key={plan.id}>
                      <Card
                        onClick={() => {
                          if (selectedPlanId !== plan.id) {
                            setSelectedPlanId(plan.id);
                            if (isMobile) setMobileSection(1);
                          }
                        }}
                        sx={{
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected 
                            ? theme.palette.mode === 'dark' 
                              ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
                              : 'primary.lighter' 
                            : 'background.paper',
                          position: 'relative',
                          boxShadow: 'none',
                          borderRadius: 2,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          overflow: 'hidden',
                          '&:hover': {
                            borderColor: isSelected ? 'primary.dark' : 'primary.main',
                            transform: 'translateY(-2px)',
                            boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
                            bgcolor: isSelected 
                              ? theme.palette.mode === 'dark'
                                ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                                : 'primary.lighter'
                              : 'action.hover'
                          },
                          '&:hover .plan-actions': { opacity: 1 }
                        }}
                      >
                        <CardContent sx={{ py: 2.5, px: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.95rem', transition: 'color 0.2s' }}>{plan.title}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                              {createdDate ? `Last Edited: ${createdDate}` : 'Last Edited: —'}{plan.createdBy ? `, By: ${plan.createdBy}` : ''}
                                  </Typography>
                            {plan.status && (
                              <Chip size="small" label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 500 }} />
                            )}
                          </Box>
                        </CardContent>
                        <Box className="plan-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: isMobile ? 1 : 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                          <IconButton size="small" onClick={() => handleCopyPlanCard(plan.id)} disabled={copyingPlanId === plan.id} title="Copy plan" sx={{ '&:hover': { bgcolor: 'action.selected' } }}>
                            <Copy size={16} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeletePlanCard(plan.id)} disabled={deletingPlanId === plan.id} title="Delete plan" sx={{ '&:hover': { bgcolor: 'error.lighter' } }}>
                            <Trash size={16} />
                          </IconButton>
                        </Box>
                      </Card>
                    </Box>
                  );
                })}
              </Grid>
            )}
          </CardContent>
        </Card>,
            
            // Section 2: Current Cycle & Meals
            <Card key="cycles" elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
            <CardHeader
              title={<Typography variant="h6">Current Cycle & Meals</Typography>}
              action={
                <Stack direction="row" spacing={0.5}>
                  {selectedCycleId && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Copy size={14} />}
                      onClick={handleCopyCycle}
                      disabled={saving}
                      sx={{ 
                        minWidth: 'auto', 
                        px: 1, 
                        fontSize: '0.7rem',
                        textTransform: 'none'
                      }}
                    >
                      Copy
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Trash size={14} />}
                    onClick={handleDeleteCycle}
                    disabled={saving || currentCycles.length <= 1}
                    sx={{ 
                      minWidth: 'auto', 
                      px: 1, 
                      fontSize: '0.7rem',
                      textTransform: 'none'
                    }}
                  >
                    Del
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<Add size={14} />}
                    onClick={() => setIsCreateMealDialogOpen(true)}
                    sx={{ 
                      minWidth: 'auto', 
                      px: 1, 
                      fontSize: '0.7rem',
                      textTransform: 'none'
                    }}
                  >
                    Meal
                  </Button>
                </Stack>
              }
            />
            <CardContent sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              position: 'relative',
              ...(selectedMealId && (currentMeals.find(m => m.id === selectedMealId)?.recipeImageUrl)
                ? {
                    backgroundImage: `url(${currentMeals.find(m => m.id === selectedMealId)?.recipeImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }
                : {})
            }}>
              {/* Main Plan Tabs */}
              <Box sx={{ mb: 2 }}>
                <Tabs value={planTab} onChange={(_, v) => setPlanTab(v)} variant="fullWidth">
                  <Tab label="Cycles & Meals" />
                </Tabs>
              </Box>

              {/* Content based on selected tab (Water tab removed) */}
              {planTab === 0 ? (
                <>
                  {currentCycle ? (
                    <Box>
                      {/* Calories Display - Left aligned, above macro bar */}
                      {currentCycle && (() => {
                        const cycleTotals = computeCycleTotals(currentCycle);
                        return (
                          <Box sx={{ 
                            mb: 2, 
                            display: 'flex', 
                            justifyContent: 'flex-start',
                            alignItems: 'center'
                          }}>
                            <Box>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  textTransform: 'uppercase',
                                  letterSpacing: 1,
                                  mb: 0.5,
                                  color: 'text.secondary'
                                }}
                              >
                                Total Calories
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                <Typography 
                                  variant="h4" 
                                  sx={{ 
                                    fontWeight: 700,
                                    fontSize: '1.75rem',
                                    lineHeight: 1.2
                                  }}
                                >
                                  {cycleTotals.calories.toLocaleString()}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontSize: '0.75rem',
                                    color: 'text.secondary'
                                  }}
                                >
                                  kcal
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })()}
                      
                      {/* Macros bar */}
                      <Box sx={{ mb: 2 }}>
                        <CycleMacroBar cycle={currentCycle} meals={currentMeals} />
                      </Box>
                      
                      {/* Cycle Navigator: (-) ( <     [cycle name]       >) (+) */}
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 1,
                        mb: 2,
                        px: 2
                      }}>
                        {/* Minus button */}
                        <IconButton
                          size="small"
                          onClick={handleDeleteCycle}
                          disabled={currentCycles.length <= 1 || saving}
                          color="error"
                          sx={{ minWidth: 32, height: 32 }}
                        >
                          <Typography variant="h6" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>−</Typography>
                        </IconButton>
                        
                        {/* Left arrow */}
                        <IconButton
                          size="small"
                          onClick={handlePreviousCycle}
                          disabled={!canGoPrevious}
                          sx={{ minWidth: 32, height: 32 }}
                        >
                          <ArrowLeft2 size={18} />
                        </IconButton>
                        
                        {/* Cycle name (editable) */}
                        <Box sx={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minWidth: 0,
                          px: 1
                        }}>
                          {editingCycleId === selectedCycleId ? (
                            <TextField
                              size="small"
                              value={editingCycleValue}
                              autoFocus
                              onChange={(e) => setEditingCycleValue(e.target.value)}
                              onBlur={() => {
                                if (!selectedCycleId || !selectedPlanId) { setEditingCycleId(null); return; }
                                setCurrentCycles((prev) => prev.map((c) => c.id !== selectedCycleId ? c : ({ ...c, label: editingCycleValue || c.label, title: editingCycleValue || c.title })));
                                setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                  ...p,
                                  cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({ ...c, label: editingCycleValue || c.label, title: editingCycleValue || c.title }))
                                })));
                                setEditingCycleId(null);
                                setIsPlanDirty(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditingCycleId(null);
                              }}
                              sx={{ 
                                width: '100%',
                                maxWidth: 200,
                                '& .MuiInputBase-input': { 
                                  textAlign: 'center',
                                  fontSize: '0.95rem',
                                  fontWeight: 500
                                }
                              }}
                            />
                          ) : (
                            <Typography 
                              variant="subtitle1" 
                              sx={{ 
                                textAlign: 'center', 
                                cursor: 'text',
                                fontWeight: 500,
                                fontSize: '0.95rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                maxWidth: 200
                              }} 
                              onClick={() => {
                                const t = currentCycle ? (currentCycle.label || currentCycle.title || '') : '';
                                setEditingCycleId(selectedCycleId || null);
                                setEditingCycleValue(t);
                              }}
                            >
                              {currentCycle ? (currentCycle.label || `Day ${currentCycle.dayIndex}`) : 'Cycle'}
                            </Typography>
                          )}
                        </Box>
                        
                        {/* Right arrow */}
                        <IconButton
                          size="small"
                          onClick={handleNextCycle}
                          disabled={!canGoNext}
                          sx={{ minWidth: 32, height: 32 }}
                        >
                          <ArrowRight2 size={18} />
                        </IconButton>
                        
                        {/* Plus button */}
                        <IconButton
                          size="small"
                          onClick={handleAddCycle}
                          disabled={saving}
                          color="primary"
                          sx={{ minWidth: 32, height: 32 }}
                        >
                          <Add size={18} />
                        </IconButton>
                      </Box>
                      
                      {/* Meals under current cycle stacked vertically */}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMealDragEnd}>
                        <SortableContext items={currentMeals.map(m => m.id)} strategy={verticalListSortingStrategy}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {currentMeals.map((meal) => (
                              <SortableMeal
                                key={meal.id}
                                meal={meal}
                                isSelected={selectedMealId === meal.id}
                                onSelect={() => {
                                  setSelectedMealId(meal.id);
                                  // On mobile, automatically move to section 3 (meal details) when meal is selected
                                  if (isMobile) {
                                    setMobileSection(2);
                                  }
                                }}
                                onCopy={() => {
                                  if (!selectedPlanId || !selectedCycleId) return;
                                  const newId = `tmpm-${Date.now()}-${Math.random()}`;
                                  const copiedFoodItems = (meal.foodItems || []).map((fi: any, idx: number) => ({
                                    ...fi,
                                    id: `tmpfi-${newId}-${fi.foodItemId || fi.foodItem?.id || idx}-${Date.now()}`,
                                    mealId: newId
                                  }));
                                  const copy = { ...meal, id: newId, foodItems: copiedFoodItems } as any;
                                  setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                    ...p,
                                    cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                      ...c,
                                      meals: [ ...(c.meals || []), copy ]
                                    }))
                                  })));
                                  setIsPlanDirty(true);
                                }}
                                onDelete={() => {
                                  if (!selectedPlanId || !selectedCycleId) return;
                                  setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                    ...p,
                                    cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                      ...c,
                                      meals: (c.meals || []).filter((m) => m.id !== meal.id)
                                    }))
                                  })));
                                  if (selectedMealId === meal.id) setSelectedMealId(null);
                                  setIsPlanDirty(true);
                                }}
                              />
                            ))}
                            <Box>
                              <Card
                                sx={{
                                  border: '1px dashed',
                                  borderColor: 'divider',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onClick={() => setIsCreateMealDialogOpen(true)}
                              >
                                <Button startIcon={<Add size={16} />}>Add Meal</Button>
                              </Card>
                            </Box>
                          </Box>
                        </SortableContext>
                      </DndContext>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No cycle selected</Typography>
                    </Box>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>,
            
            // Section 3: Food Items
            <Card key="food-items" elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {selectedMealId && currentMeals.find(m => m.id === selectedMealId) ? (
                <Box>
                  {/* Row 1: Meal name (editable) + close */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    {editingMealTitleId === selectedMealId ? (
                      <TextField
                        size="small"
                        value={editingMealTitleValue}
                        autoFocus
                        onChange={(e) => setEditingMealTitleValue(e.target.value)}
                        onBlur={() => {
                          const id = selectedMealId as string;
                          setCurrentMeals((prev) => prev.map((m) => m.id !== id ? m : ({ ...m, meal: editingMealTitleValue || m.meal })));
                          if (selectedPlanId && selectedCycleId) {
                            setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                              ...p,
                              cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                ...c,
                                meals: (c.meals || []).map((m) => m.id !== id ? m : ({ ...m, meal: editingMealTitleValue || m.meal }))
                              }))
                            })));
                          }
                          setEditingMealTitleId(null);
                          setIsPlanDirty(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingMealTitleId(null);
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="h6"
                        onClick={() => {
                          const t = currentMeals.find(m => m.id === selectedMealId)?.meal || '';
                          setEditingMealTitleId(selectedMealId);
                          setEditingMealTitleValue(t);
                        }}
                        sx={{ cursor: 'text' }}
                      >
                        {currentMeals.find(m => m.id === selectedMealId)?.meal}
                      </Typography>
                    )}
                    <IconButton size="medium" onClick={() => setSelectedMealId(null)} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                  </Box>
                  {/* Calories Display - Left aligned */}
                  {(() => { 
                    const m = currentMeals.find(me => me.id === selectedMealId)!; 
                    const t = computeMealTotals(m);
                    const isDark = theme.palette.mode === 'dark';
                    const colors = {
                      p: isDark ? '#ffc107' : '#f57c00',      // Protein: yellow (lighter in dark, darker in light)
                      c: isDark ? '#64b5f6' : '#1565c0',      // Carbs: blue (lighter in dark, darker in light)
                      f: isDark ? '#ef5350' : '#c62828'       // Fat: red (lighter in dark, darker in light)
                    };
                    return (
                      <>
                        <Box sx={{ 
                          mb: 2, 
                          display: 'flex', 
                          justifyContent: 'flex-start',
                          alignItems: 'center'
                        }}>
                          <Box>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                mb: 0.5,
                                color: 'text.secondary'
                              }}
                            >
                              Total Calories
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                              <Typography 
                                variant="h4" 
                                sx={{ 
                                  fontWeight: 700,
                                  fontSize: '1.75rem',
                                  lineHeight: 1.2
                                }}
                              >
                                {t.calories.toLocaleString()}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontSize: '0.75rem',
                                  color: 'text.secondary'
                                }}
                              >
                                kcal
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        
                        {/* Protein | Carbs | Fat layout (without bar) */}
                        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ color: colors.p, fontWeight: 600, mb: 0.5 }}>Protein</Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                              {Math.round(t.protein)}g
                            </Typography>
                          </Box>
                          <Typography sx={{ color: 'text.secondary', fontSize: '1.2rem', mx: 1, userSelect: 'none' }}>|</Typography>
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ color: colors.c, fontWeight: 600, mb: 0.5 }}>Carbs</Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                              {Math.round(t.carbs)}g
                            </Typography>
                          </Box>
                          <Typography sx={{ color: 'text.secondary', fontSize: '1.2rem', mx: 1, userSelect: 'none' }}>|</Typography>
                          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ color: colors.f, fontWeight: 600, mb: 0.5 }}>Fat</Typography>
                            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                              {Math.round(t.fat)}g
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Divider sx={{ mb: 2 }} />
                      </>
                    );
                  })()}
                  {currentMeals.find(m => m.id === selectedMealId)?.foodItems && currentMeals.find(m => m.id === selectedMealId)?.foodItems.length > 0 ? (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2">
                          {currentMeals.find(m => m.id === selectedMealId)?.foodItems.length} food item(s)
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="contained" 
                            size="small" 
                            startIcon={<Add size={16} />} 
                            onClick={() => setIsAddFoodDialogOpen(true)}
                          >
                            Add Food
                          </Button>
                          {selectedFoodItems.length > 0 && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<Trash size={16} />}
                              onClick={() => {
                                const ids = new Set(selectedFoodItems);
                                // Update currentMeals immediately for real-time calculation
                                setCurrentMeals(prev => prev.map(m => m.id !== (selectedMealId as string) ? m : {
                                  ...m,
                                  foodItems: m.foodItems.filter(fi => !ids.has(fi.foodItem.id))
                                }));
                                // Also update plans state to keep everything in sync
                                if (selectedPlanId && selectedCycleId) {
                                  setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                    ...p,
                                    cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                      ...c,
                                      meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
                                        ...m,
                                        foodItems: (m.foodItems || []).filter((fi) => !ids.has(fi.foodItem.id))
                                      }))
                                    }))
                                  })));
                                }
                                setSelectedFoodItems([]);
                                setIsPlanDirty(true);
                              }}
                            >
                              Delete Selected ({selectedFoodItems.length})
                            </Button>
                          )}
                        </Box>
                      </Box>
                <List>
                  <DndContext collisionDetection={closestCenter} onDragEnd={handleFoodDragEnd}>
                    <SortableContext
                      items={(currentMeals.find(m => m.id === selectedMealId)?.foodItems || []).map((fi) => fi.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {(currentMeals.find(m => m.id === selectedMealId)?.foodItems || []).map((item) => (
                        <Sortable id={item.id} key={item.id}>
                          {({ attributes, listeners, setNodeRef, style }) => (
                            <ListItem
                              ref={setNodeRef}
                              style={style}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                mb: 1,
                                cursor: 'pointer',
                                position: 'relative',
                                '&:hover .food-actions': { opacity: 1 },
                                '&:hover': { borderColor: 'primary.light' },
                                '&:focus-within': { borderColor: 'primary.main', bgcolor: 'primary.lighter' }
                              }}
                            >
                              <Box 
                                sx={{ mr: 1, color: 'text.disabled', cursor: 'grab', fontSize: 18, lineHeight: 1 }} 
                                title="Drag to reorder"
                                {...attributes}
                                {...listeners}
                              >
                                ≡
                              </Box>
                              <ListItemText
                                primary={item.foodItem.name}
                                secondaryTypographyProps={{ component: 'span' }}
                                secondary={(() => {
                                const quantity = editingQuantities[item.id] ?? item.quantity;
                                const factor = quantity / (item.foodItem.servingSize || 100);
                                const calories = Math.round(item.foodItem.calories * factor);
                                const protein = Math.round(item.foodItem.protein * factor);
                                const carbs = Math.round(item.foodItem.carbs * factor);
                                const fat = Math.round(item.foodItem.fat * factor);
                                return (
                                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>{calories} kcal</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>P: {protein}g</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>C: {carbs}g</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12, mr: 1 }}>F: {fat}g</Typography>
                                    <Typography component="span" variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                                      (per {quantity}g)
                                    </Typography>
                                    <Box sx={{ flexGrow: 1 }} />
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={editingQuantities[item.id] ?? item.quantity}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setEditingQuantities(prev => ({ ...prev, [item.id]: val }));
                                        setCurrentMeals((prev: Meal[]) => prev.map((m: Meal) => m.id !== (selectedMealId as string) ? m : {
                                          ...m,
                                          foodItems: m.foodItems.map((fi: MealFoodItem) => fi.id === item.id ? { ...fi, quantity: val } : fi)
                                        }));
                                        // Keep plans tree in sync so cycle totals and charts update
                                        if (selectedPlanId && selectedCycleId && selectedMealId) {
                                          setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                            ...p,
                                            cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                              ...c,
                                              meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
                                                ...m,
                                                foodItems: (m.foodItems || []).map((fi) => fi.id !== item.id ? fi : ({ ...fi, quantity: val }))
                                              }))
                                            }))
                                          })));
                                        }
                                        setIsPlanDirty(true);
                                      }}
                                      sx={{ width: 110, ml: 'auto' }}
                                      InputProps={{ endAdornment: <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>{item.foodItem.unit}</Typography> as any }}
                                    />
                                  </Box>
                                );
                                })()}
                              />
                              <Box className="food-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity .2s', display: 'flex', gap: 0.5, bgcolor: 'background.paper', borderRadius: 1, p: 0.25 }} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" title="Copy" onClick={() => {
                          if (!selectedPlanId || !selectedCycleId || !selectedMealId) return;
                          const newId = `tmpfi-${selectedMealId}-${item.foodItemId}-${Date.now()}`;
                          const copy = { ...item, id: newId } as any;
                          setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                            ...p,
                            cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                              ...c,
                              meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
                                ...m,
                                foodItems: [ ...(m.foodItems || []), copy ]
                              }))
                            }))
                          })));
                          setIsPlanDirty(true);
                        }}><Copy size={16} /></IconButton>
                        <IconButton size="small" color="error" title="Delete" onClick={() => {
                          // Update currentMeals immediately for real-time calculation
                          setCurrentMeals(prev => prev.map(m => m.id !== (selectedMealId as string) ? m : {
                            ...m,
                            foodItems: m.foodItems.filter(fi => fi.id !== item.id)
                          }));
                          // Also update plans state to keep everything in sync
                          if (selectedPlanId && selectedCycleId) {
                            setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                              ...p,
                              cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                ...c,
                                meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
                                  ...m,
                                  foodItems: (m.foodItems || []).filter((fi) => fi.id !== item.id)
                                }))
                              }))
                            })));
                          }
                          setIsPlanDirty(true);
                        }}><Trash size={16} /></IconButton>
                      </Box>
                            </ListItem>
                          )}
                        </Sortable>
                      ))}
                    </SortableContext>
                  </DndContext>
                </List>
                      {/* Inline editing saves in-memory on change; no bulk actions needed */}
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography color="text.secondary" sx={{ mb: 2 }}>
                        No food items in this meal
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Add size={16} />}
                        onClick={() => setIsAddFoodDialogOpen(true)}
                      >
                        Add Food
                      </Button>
                    </Box>
                  )}
                  
                  {/* Animated Notes Section */}
                  <Box
                    sx={{
                      overflow: 'hidden',
                      transition: 'all 0.3s ease-in-out',
                      maxHeight: showMealNotesSection ? '200px' : '0px',
                      opacity: showMealNotesSection ? 1 : 0,
                      transform: showMealNotesSection ? 'translateY(0)' : 'translateY(-10px)',
                      mt: showMealNotesSection ? 2 : 0,
                      mb: showMealNotesSection ? 2 : 0
                    }}
                  >
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'background.paper', 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 2,
                      boxShadow: 1
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Meal Notes
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => setShowMealNotesSection(false)}
                          sx={{ fontSize: 16 }}
                        >
                          ✕
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={6}
                        value={(() => {
                          const selectedMeal = currentMeals.find(m => m.id === selectedMealId);
                          return selectedMeal?.notes || '';
                        })()}
                        onChange={(e) => {
                          const notes = e.target.value;
                          // Update current meals
                          setCurrentMeals((prev) => prev.map((m) => m.id !== (selectedMealId as string) ? m : ({ ...m, notes })));
                          // Update plans tree
                          if (selectedPlanId && selectedCycleId) {
                            setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                              ...p,
                              cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                ...c,
                                meals: (c.meals || []).map((m) => m.id !== (selectedMealId as string) ? m : ({ ...m, notes }))
                              }))
                            })));
                          }
                          setIsPlanDirty(true);
                        }}
                        placeholder="Add notes about this meal..."
                        variant="outlined"
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                    </Box>
                  </Box>
                  
                  {/* Notes Button - At the end */}
                  {selectedMealId && currentMeals.find(m => m.id === selectedMealId) && (
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={<DocumentText size={18} />}
                        onClick={() => {
                          setShowMealNotesSection(!showMealNotesSection);
                        }}
                        sx={{
                          borderRadius: 2,
                          boxShadow: 2,
                          textTransform: 'none',
                          px: 2,
                          py: 1,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        Notes
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">Select a meal to view food items</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
          ]}
          activeSection={mobileSection}
          onSectionChange={setMobileSection}
        />
      ) : (
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {/* Section 1: Plans */}
          <Card elevation={0} sx={{ flex: showSection2 ? '1 1 0' : '1 1 0', minWidth: 0, width: showSection2 ? '50%' : '100%', height: '75vh', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
            <CardHeader
              title={
                <Box sx={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
                  <Tabs 
                    value={plansTab} 
                    onChange={(_, v) => setPlansTab(v)} 
                    variant="scrollable" 
                    allowScrollButtonsMobile 
                    scrollButtons="auto"
                    sx={{
                      '& .MuiTab-root': {
                        minWidth: { xs: 48, md: 'auto' }
                      }
                    }}
                  >
                    {isMobile
                      ? [
                          <Tab key="plans-icon" label="" icon={<Category size={20} />} iconPosition="top" />,
                          <Tab key="forms-icon" label="" icon={<DocumentText size={20} />} iconPosition="top" />,
                          <Tab key="tools-icon" label="" icon={<Setting2 size={20} />} iconPosition="top" />,
                          <Tab key="chat-icon" label="" icon={<Messages2 size={20} />} iconPosition="top" />,
                        ]
                      : [
                          <Tab key="plans" label="Plans" />,
                          <Tab key="forms" label="Forms" />,
                          <Tab key="tools" label="Tools" />,
                          <Tab key="chat" label="Chat" />,
                        ]}
                  </Tabs>
                </Box>
              }
              subheader={plansTab === 0 ? (
                <Box sx={{ mt: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                    <Button variant="contained" size="small" startIcon={<Add size={16} />} onClick={() => setIsCreatePlanDialogOpen(true)} sx={{ flex: 1 }}>
                      Create
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<Copy size={16} />} onClick={() => setLoadPlanDialogOpen(true)} sx={{ flex: 1 }}>
                      Load
                    </Button>
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search plans..."
                    value={planQuery}
                    onChange={(e) => setPlanQuery(e.target.value)}
                  />
                </Box>
              ) : null}
            />
            <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {plansTab === 3 ? (
                <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', height: '60vh' }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Chat</Typography>
                  {chatError && <Alert severity="error" sx={{ mb: 1 }}>{chatError}</Alert>}
                  <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }} ref={chatScrollRef}>
                      {chatLoading && chatMessages.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
                      ) : (
                        chatMessages.map((m: any) => {
                          const isClient = m.senderType === 'client';
                          return (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start', mb: 1 }}>
                            <Box sx={{ 
                              px: 2, 
                              py: 1.5, 
                              bgcolor: isClient ? 'primary.main' : 'background.paper',
                              color: isClient ? 'white' : 'text.primary',
                              borderRadius: 2,
                              borderBottomRightRadius: isClient ? 0 : 2,
                              borderBottomLeftRadius: isClient ? 2 : 0,
                              maxWidth: '75%',
                              boxShadow: 1
                            }}>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body || m.message || m.text || ''}</Typography>
                              {m.attachments && m.attachments.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  {m.attachments.map((attachment: any, index: number) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                      <AttachCircle fontSize="small" />
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        href={attachment.url}
                                        target="_blank"
                                        sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                                      >
                                        {attachment.originalName || attachment.filename || `Attachment ${index + 1}`}
                                        {attachment.size && ` (${(attachment.size / 1024).toFixed(1)} KB)`}
                                      </Button>
                                    </Box>
                                  ))}
                                </Box>
                              )}
                              <Typography variant="caption" sx={{ 
                                display: 'block', 
                                mt: 0.5,
                                opacity: isClient ? 0.8 : 0.6,
                                fontSize: '0.7rem'
                              }}>
                                {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                              </Typography>
                            </Box>
                          </Box>
                          );
                        })
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Type a message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                        fullWidth
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <IconButton
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        sx={{ 
                          bgcolor: 'grey.100',
                          '&:hover': { bgcolor: 'grey.200' }
                        }}
                      >
                        <AttachCircle />
                      </IconButton>
                      <Button 
                        variant="contained" 
                        onClick={handleSendChat} 
                        disabled={(!chatInput.trim() && attachments.length === 0) || uploading}
                      >
                        {uploading ? 'Sending...' : 'Send'}
                      </Button>
                    </Box>
                    
                    {/* Attachment preview */}
                    {attachments.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        {attachments.map((file, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </Typography>
                            <IconButton size="small" onClick={() => handleRemoveAttachment(index)}>
                              <CloseCircle />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : plansTab === 1 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Forms</Typography>
                  {formsError && <Alert severity="error" sx={{ mb: 2 }}>{formsError}</Alert>}
                  {formsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : formsSubmissions.length === 0 ? (
                    <Typography color="text.secondary">No submissions found for this client.</Typography>
                  ) : (
                    <List>
                      {formsSubmissions.map((s) => (
                        <ListItem key={s.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 1 }}>
                            <ListItemText
                              primary={s.formTitle || s.form?.title || 'Untitled form'}
                              secondary={
                                <>
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    {s.formType ? `${s.formType} • ` : ''}
                                    {s.submittedAt ? new Date(s.submittedAt as string).toLocaleString() : (s.createdAt ? new Date(s.createdAt as string).toLocaleString() : '')}
                                    {s.status ? ` • ${s.status}` : ''}
                                  </Typography>
                                </>
                              }
                            />
                            <Button size="small" onClick={() => toggleExpandSubmission(s.id)}>
                              {expandedSubmissionIds[s.id] ? 'Hide Answers' : 'View Answers'}
                            </Button>
                          </Box>
                          {expandedSubmissionIds[s.id] && (
                            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mt: 1 }}>
                              {renderAnswerValue(s.answers || {}, s.form?.questions)}
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              ) : plansTab === 2 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>Tools</Typography>
                  <Card variant="outlined">
                    <CardHeader title="Calories / Protein / Carbs / Fat" subheader="Cycle macro distribution" />
                    <CardContent>
                      {selectedPlanId && currentCycles.length > 0 ? (
                        <>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Cycle: {currentCycles[currentCycleIndex]?.label || currentCycles[currentCycleIndex]?.title || `Day ${currentCycleIndex + 1}`}
                          </Typography>
                          <MacroDonut cycle={currentCycles[currentCycleIndex]} />
                        </>
                      ) : (
                        <Typography color="text.secondary">Select a plan and cycle to view the calculator.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              ) : plansTab !== 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No content for this tab yet.</Box>
              ) : loadingPlans ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={2} direction="column">
                  {filteredPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const createdDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : undefined;
                    return (
                      <Box key={plan.id}>
                        <Card
                          onClick={() => {
                            if (selectedPlanId !== plan.id) {
                              setSelectedPlanId(plan.id);
                            }
                          }}
                          sx={{
                            cursor: 'pointer',
                            border: '2px solid',
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected 
                              ? theme.palette.mode === 'dark' 
                                ? 'rgba(25, 118, 210, 0.08)'  // Subtle blue tint in dark mode
                                : 'primary.lighter' 
                              : 'background.paper',
                            position: 'relative',
                            boxShadow: 'none',
                            borderRadius: 2,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            overflow: 'hidden',
                            '&:hover': {
                              borderColor: isSelected ? 'primary.dark' : 'primary.main',
                              transform: 'translateY(-2px)',
                              boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 2px 8px rgba(0,0,0,0.06)',
                              bgcolor: isSelected 
                                ? theme.palette.mode === 'dark'
                                  ? 'rgba(25, 118, 210, 0.12)'  // Slightly more visible on hover in dark mode
                                  : 'primary.lighter'
                                : 'action.hover'
                            },
                            '&:hover .plan-actions': { opacity: 1 }
                          }}
                        >
                          <CardContent sx={{ py: 2.5, px: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 90 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, color: isSelected ? 'primary.main' : 'text.primary', fontSize: '0.95rem', transition: 'color 0.2s' }}>{plan.title}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                {createdDate ? `Last Edited: ${createdDate}` : 'Last Edited: —'}{plan.createdBy ? `, By: ${plan.createdBy}` : ''}
                                  </Typography>
                              {plan.status && (
                                <Chip size="small" label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 500 }} />
                              )}
                            </Box>
                          </CardContent>
                          <Box className="plan-actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.3s ease', display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                            <IconButton size="small" onClick={() => handleCopyPlanCard(plan.id)} disabled={copyingPlanId === plan.id} title="Copy plan" sx={{ '&:hover': { bgcolor: 'action.selected' } }}>
                              <Copy size={16} />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeletePlanCard(plan.id)} disabled={deletingPlanId === plan.id} title="Delete plan" sx={{ '&:hover': { bgcolor: 'error.lighter' } }}>
                              <Trash size={16} />
                            </IconButton>
                          </Box>
                        </Card>
                      </Box>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Current Cycle & Meals */}
          {showSection2 && (
            <Card elevation={0} sx={{ flex: showSection3 ? '1 1 0' : '1 1 0', minWidth: 0, width: showSection3 ? '50%' : '100%', height: '75vh', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {/* Row 1: Plan name with close */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {editingPlanTitleId === selectedPlanId ? (
                      <TextField
                          size="small"
                        value={editingPlanTitleValue}
                        autoFocus
                        onChange={(e) => setEditingPlanTitleValue(e.target.value)}
                        onBlur={() => {
                          if (!selectedPlanId) { setEditingPlanTitleId(null); return; }
                          setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({ ...p, title: editingPlanTitleValue || p.title })));
                          setEditingPlanTitleId(null);
                          setIsPlanDirty(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingPlanTitleId(null);
                        }}
                      />
                    ) : (
                      <Typography variant="h6" onClick={() => {
                        const t = plans.find((p) => p.id === selectedPlanId)?.title || '';
                        setEditingPlanTitleId(selectedPlanId);
                        setEditingPlanTitleValue(t);
                      }} sx={{ cursor: 'text' }}>
                        {plans.find((p) => p.id === selectedPlanId)?.title || 'Plan'}
                        </Typography>
                    )}
                  </Box>
                  <IconButton size="medium" onClick={() => { setSelectedPlanId(null); setSelectedMealId(null); }} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                </Box>

                {/* Main Plan Tabs */}
                <Box sx={{ mb: 2 }}>
                  <Tabs value={planTab} onChange={(_, v) => setPlanTab(v)} variant="fullWidth">
                    <Tab label="Cycles & Meals" />
                  </Tabs>
                </Box>

                {/* Content based on selected tab (Water tab removed) */}
                {planTab === 0 ? (
                  <>
                {/* Row 2a: Calories Display - Left aligned, above macro bar */}
                {currentCycle && (() => {
                  const cycleTotals = computeCycleTotals(currentCycle);
                  return (
                    <Box sx={{ 
                      mb: 2, 
                      display: 'flex', 
                      justifyContent: 'flex-start',
                      alignItems: 'center'
                    }}>
                      <Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            mb: 0.5,
                            color: 'text.secondary'
                          }}
                        >
                          Total Calories
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography 
                            variant="h4" 
                            sx={{ 
                              fontWeight: 700,
                              fontSize: { xs: '1.5rem', sm: '1.75rem' },
                              lineHeight: 1.2
                            }}
                          >
                            {cycleTotals.calories.toLocaleString()}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              fontSize: '0.75rem',
                              color: 'text.secondary'
                            }}
                          >
                            kcal
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })()}
                    
                {/* Row 2b: Macros horizontal bar */}
                <Box sx={{ mb: 1, textAlign: 'center', position: 'relative' }}>
                  {currentCycle ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CycleMacroBar cycle={currentCycle} meals={currentMeals} />
                      <Tooltip title="View nutritional analysis for current cycle" arrow>
                        <IconButton 
                          size="small" 
                          onClick={() => setIsMacrosDialogOpen(true)}
                          sx={{ ml: 1 }}
                        >
                          <Information size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  )}
                </Box>
                
                {/* Cycle Navigator: (-) ( <     [cycle name]       >) (+) */}
                {currentCycle && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 1,
                    mb: 2,
                    px: 2
                  }}>
                    {/* Minus button */}
                    <IconButton
                      size="small"
                      onClick={handleDeleteCycle}
                      disabled={currentCycles.length <= 1 || saving}
                      color="error"
                      sx={{ minWidth: 32, height: 32 }}
                    >
                      <Typography variant="h6" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>−</Typography>
                    </IconButton>
                    
                    {/* Left arrow */}
                    <IconButton
                      size="small"
                      onClick={handlePreviousCycle}
                      disabled={!canGoPrevious}
                      sx={{ minWidth: 32, height: 32 }}
                    >
                      <ArrowLeft2 size={18} />
                    </IconButton>
                    
                    {/* Cycle name (editable) */}
                    <Box sx={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      minWidth: 0,
                      px: 1
                    }}>
                      {editingCycleId === selectedCycleId ? (
                        <TextField
                          size="small"
                          value={editingCycleValue}
                          autoFocus
                          onChange={(e) => setEditingCycleValue(e.target.value)}
                          onBlur={() => {
                            if (!selectedCycleId || !selectedPlanId) { setEditingCycleId(null); return; }
                            setCurrentCycles((prev) => prev.map((c) => c.id !== selectedCycleId ? c : ({ ...c, label: editingCycleValue || c.label, title: editingCycleValue || c.title })));
                            setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                              ...p,
                              cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({ ...c, label: editingCycleValue || c.label, title: editingCycleValue || c.title }))
                            })));
                            setEditingCycleId(null);
                            setIsPlanDirty(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingCycleId(null);
                          }}
                          sx={{ 
                            width: '100%',
                            maxWidth: 200,
                            '& .MuiInputBase-input': { 
                              textAlign: 'center',
                              fontSize: '0.95rem',
                              fontWeight: 500
                            }
                          }}
                        />
                      ) : (
                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            textAlign: 'center', 
                            cursor: 'text',
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                            maxWidth: 200
                          }} 
                          onClick={() => {
                            const t = currentCycle ? (currentCycle.label || currentCycle.title || '') : '';
                            setEditingCycleId(selectedCycleId || null);
                            setEditingCycleValue(t);
                          }}
                        >
                          {currentCycle ? (currentCycle.label || `Day ${currentCycle.dayIndex}`) : 'Cycle'}
                        </Typography>
                      )}
                    </Box>
                    
                    {/* Right arrow */}
                    <IconButton
                      size="small"
                      onClick={handleNextCycle}
                      disabled={!canGoNext}
                      sx={{ minWidth: 32, height: 32 }}
                    >
                      <ArrowRight2 size={18} />
                    </IconButton>
                    
                    {/* Plus button */}
                    <IconButton
                      size="small"
                      onClick={handleAddCycle}
                      disabled={saving}
                      color="primary"
                      sx={{ minWidth: 32, height: 32 }}
                    >
                      <Add size={18} />
                    </IconButton>
                  </Box>
                )}
                <Divider sx={{ mb: 1 }} />

                    {/* Meals header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2">Meals</Typography>
                      <Button variant="contained" size="small" startIcon={<Add size={16} />} onClick={() => setIsCreateMealDialogOpen(true)}>New Meal</Button>
                    </Box>

                    {/* Meals list */}
                    {currentCycle ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMealDragEnd}>
                          <SortableContext items={currentMeals.map(m => m.id)} strategy={verticalListSortingStrategy}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {currentMeals.map((meal) => (
                                <SortableMeal
                                  key={meal.id}
                                  meal={meal}
                                  isSelected={selectedMealId === meal.id}
                                  onSelect={() => setSelectedMealId(meal.id)}
                                  onCopy={() => {
                                    if (!selectedPlanId || !selectedCycleId) return;
                                    const newId = `tmpm-${Date.now()}-${Math.random()}`;
                                    const copiedFoodItems = (meal.foodItems || []).map((fi: any, idx: number) => ({
                                      ...fi,
                                      id: `tmpfi-${newId}-${fi.foodItemId || fi.foodItem?.id || idx}-${Date.now()}`,
                                      mealId: newId
                                    }));
                                    const copy = { ...meal, id: newId, foodItems: copiedFoodItems } as any;
                                    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                      ...p,
                                      cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                        ...c,
                                        meals: [ ...(c.meals || []), copy ]
                                      }))
                                    })));
                                    setIsPlanDirty(true);
                                  }}
                                  onDelete={() => {
                                    if (!selectedPlanId || !selectedCycleId) return;
                                    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                      ...p,
                                      cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                        ...c,
                                        meals: (c.meals || []).filter((m) => m.id !== meal.id)
                                      }))
                                    })));
                                    if (selectedMealId === meal.id) setSelectedMealId(null);
                                    setIsPlanDirty(true);
                                  }}
                                />
                              ))}
                            </Box>
                          </SortableContext>
                        </DndContext>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}><Typography color="text.secondary">No cycle selected</Typography></Box>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Section 3: Food Items */}
          {showSection3 && (
            <Card elevation={0} sx={{ flex: '1 1 0', minWidth: 0, width: '50%', height: '75vh', display: 'flex', flexDirection: 'column', boxShadow: 'none' }}>
              <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {selectedMealId && currentMeals.find(m => m.id === selectedMealId) ? (
                  <Box>
                    {/* Row 1: Meal name + close */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      {editingMealTitleId === selectedMealId ? (
                        <TextField
                          size="small"
                          value={editingMealTitleValue}
                          autoFocus
                          onChange={(e) => setEditingMealTitleValue(e.target.value)}
                          onBlur={() => {
                            const id = selectedMealId as string;
                            setCurrentMeals((prev) => prev.map((m) => m.id !== id ? m : ({ ...m, meal: editingMealTitleValue || m.meal })));
                            // Also persist into plans tree
                            if (selectedPlanId && selectedCycleId) {
                              setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                ...p,
                                cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                  ...c,
                                  meals: (c.meals || []).map((m) => m.id !== id ? m : ({ ...m, meal: editingMealTitleValue || m.meal }))
                                }))
                              })));
                            }
                            setEditingMealTitleId(null);
                            setIsPlanDirty(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingMealTitleId(null);
                          }}
                        />
                      ) : (
                        <Typography variant="h6" onClick={() => {
                          const t = currentMeals.find(m => m.id === selectedMealId)?.meal || '';
                          setEditingMealTitleId(selectedMealId);
                          setEditingMealTitleValue(t);
                        }} sx={{ cursor: 'text' }}>
                      {currentMeals.find(m => m.id === selectedMealId)?.meal}
                    </Typography>
                      )}
                      <IconButton size="medium" onClick={() => setSelectedMealId(null)} title="Close" sx={{ fontSize: 18, lineHeight: 1 }}>✕</IconButton>
                    </Box>
                    {/* Row 2: Recipe display (if attached) */}
                    {(() => {
                      const selectedMeal = currentMeals.find(m => m.id === selectedMealId);
                      const recipe = selectedMeal as any;
                      if (recipe?.recipeName) {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: 'primary.lighter', borderRadius: 1 }}>
                            {recipe.recipeImageUrl && (
                              <Box
                                component="img"
                                src={recipe.recipeImageUrl}
                                sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover' }}
                              />
                            )}
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" fontWeight="medium">
                                Recipe: {recipe.recipeName}
                              </Typography>
                              {recipe.recipeNameArabic && (
                                <Typography variant="caption" color="text.secondary">
                                  {recipe.recipeNameArabic}
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setCurrentMeals((prev: Meal[]) => prev.map((m: Meal) => m.id !== (selectedMealId as string) ? m : ({
                                  ...m,
                                  recipeName: undefined,
                                  recipeNameArabic: undefined,
                                  recipeImageUrl: undefined
                                } as any)));
                                setIsPlanDirty(true);
                              }}
                              title="Remove recipe"
                            >
                              ✕
                            </IconButton>
                          </Box>
                        );
                      }
                      return null;
                    })()}
                    {/* Calories Display - Left aligned */}
                    {(() => { 
                      const m = currentMeals.find(me => me.id === selectedMealId)!; 
                      const t = computeMealTotals(m);
                      const isDark = theme.palette.mode === 'dark';
                      const colors = {
                        p: isDark ? '#64b5f6' : '#1976d2',
                        c: isDark ? '#81c784' : '#388e3c',
                        f: isDark ? '#ffb74d' : '#f57c00'
                      };
                      return (
                        <>
                          <Box sx={{ 
                            mb: 2, 
                            display: 'flex', 
                            justifyContent: 'flex-start',
                            alignItems: 'center'
                          }}>
                            <Box>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  textTransform: 'uppercase',
                                  letterSpacing: 1,
                                  mb: 0.5,
                                  color: 'text.secondary'
                                }}
                              >
                                Total Calories
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                <Typography 
                                  variant="h4" 
                                  sx={{ 
                                    fontWeight: 700,
                                    fontSize: { xs: '1.5rem', sm: '1.75rem' },
                                    lineHeight: 1.2
                                  }}
                                >
                                  {t.calories.toLocaleString()}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontSize: '0.75rem',
                                    color: 'text.secondary'
                                  }}
                                >
                                  kcal
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          
                          {/* Protein | Carbs | Fat layout (without bar) */}
                          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: colors.p, fontWeight: 600, mb: 0.5 }}>Protein</Typography>
                              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                {Math.round(t.protein)}g
                              </Typography>
                            </Box>
                            <Typography sx={{ color: 'text.primary', fontSize: '1rem', mx: 1, userSelect: 'none', opacity: 0.6 }}>|</Typography>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: colors.c, fontWeight: 600, mb: 0.5 }}>Carbs</Typography>
                              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                {Math.round(t.carbs)}g
                              </Typography>
                            </Box>
                            <Typography sx={{ color: 'text.primary', fontSize: '1rem', mx: 1, userSelect: 'none', opacity: 0.6 }}>|</Typography>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ color: colors.f, fontWeight: 600, mb: 0.5 }}>Fat</Typography>
                              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                {Math.round(t.fat)}g
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Divider sx={{ mb: 2 }} />
                        </>
                      );
                    })()}
                    {(() => {
                      const selectedMeal = currentMeals.find(m => m.id === selectedMealId)!;
                      const items = selectedMeal?.foodItems || [];
                      return (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
                            <Typography variant="subtitle2">{items.length} food item(s)</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button variant="contained" size="small" startIcon={<Add size={16} />} onClick={() => setIsAddFoodDialogOpen(true)}>Add Food</Button>
                            </Box>
                          </Box>
                          {items.length > 0 ? (
                            <List>
                              {items.map((item) => (
                            <ListItem
                              key={item.id}
                              draggable
                              onDragStart={() => setDragFoodIndex(items.findIndex(fi => fi.id === item.id))}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleFoodDrop(items.findIndex(fi => fi.id === item.id))}
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                mb: 1,
                                position: 'relative',
                                '&:hover .food-actions': { opacity: 1 },
                                '&:hover': { borderColor: 'primary.light' },
                                '&:focus-within': { borderColor: 'primary.main', bgcolor: 'primary.lighter' }
                              }}
                            >
                              <Box sx={{ mr: 1, color: 'text.disabled', cursor: 'grab', fontSize: 18, lineHeight: 1 }} title="Drag to reorder">≡</Box>
                        <ListItemText
                          primary={item.foodItem.name}
                          secondaryTypographyProps={{ component: 'span' }}
                              secondary={(() => {
                                  const quantity = editingQuantities[item.id] ?? item.quantity;
                                  const factor = quantity / (item.foodItem.servingSize || 100);
                                  const calories = Math.round(item.foodItem.calories * factor);
                                  const protein = Math.round(item.foodItem.protein * factor);
                                  const carbs = Math.round(item.foodItem.carbs * factor);
                                  const fat = Math.round(item.foodItem.fat * factor);
                                  return (
                                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>{calories} kcal</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>P: {protein}g</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>C: {carbs}g</Typography>
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 12, mr: 1 }}>F: {fat}g</Typography>
                                    <Box sx={{ flexGrow: 1 }} />
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={editingQuantities[item.id] ?? item.quantity}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setEditingQuantities(prev => ({ ...prev, [item.id]: val }));
                                          // Update live in-memory state on change
                                          setCurrentMeals((prev) => prev.map((m) => m.id !== (selectedMealId as string) ? m : {
                                            ...m,
                                            foodItems: m.foodItems.map((fi) => fi.id === item.id ? { ...fi, quantity: val } : fi)
                                          }));
                                          setIsPlanDirty(true);
                                        }}
                                      sx={{ width: 110, ml: 'auto' }}
                                      InputProps={{ endAdornment: <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>{item.foodItem.unit}</Typography> as any }}
                                      />
                                  </Box>
                                  );
                                })()}
                              />
                              <Box className="food-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity .2s', display: 'flex', gap: 0.5, bgcolor: 'background.paper', borderRadius: 1, p: 0.25 }} onClick={(e) => e.stopPropagation()}>
                                <IconButton size="small" title="Copy" onClick={() => {
                                  if (!selectedPlanId || !selectedCycleId || !selectedMealId) return;
                                  const newId = `tmpfi-${selectedMealId}-${item.foodItemId}-${Date.now()}`;
                                  const copy = { ...item, id: newId } as any;
                                  setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                    ...p,
                                    cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                      ...c,
                                      meals: (c.meals || []).map((m) => m.id !== selectedMealId ? m : ({
                                        ...m,
                                        foodItems: [ ...(m.foodItems || []), copy ]
                                      }))
                                    }))
                                  })));
                                  setIsPlanDirty(true);
                                }}><Copy size={16} /></IconButton>
                                <IconButton size="small" color="error" title="Delete" onClick={() => {
                                  setCurrentMeals(prev => prev.map(m => m.id !== (selectedMealId as string) ? m : {
                                    ...m,
                                    foodItems: m.foodItems.filter(fi => fi.id !== item.id)
                                  }));
                                  setIsPlanDirty(true);
                                }}><Trash size={16} /></IconButton>
                              </Box>
                            </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                              <Typography color="text.secondary">No food items added yet</Typography>
                            </Box>
                          )}
                          
                          {/* Animated Notes Section */}
                          <Box
                            sx={{
                              overflow: 'hidden',
                              transition: 'all 0.3s ease-in-out',
                              maxHeight: showMealNotesSection ? '200px' : '0px',
                              opacity: showMealNotesSection ? 1 : 0,
                              transform: showMealNotesSection ? 'translateY(0)' : 'translateY(-10px)',
                              mt: showMealNotesSection ? 2 : 0,
                              mb: showMealNotesSection ? 2 : 0
                            }}
                          >
                            <Box sx={{ 
                              p: 2, 
                              backgroundColor: 'background.paper', 
                              border: '1px solid', 
                              borderColor: 'divider', 
                              borderRadius: 2,
                              boxShadow: 1
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                  Meal Notes
                                </Typography>
                                <IconButton 
                                  size="small" 
                                  onClick={() => setShowMealNotesSection(false)}
                                  sx={{ fontSize: 16 }}
                                >
                                  ✕
                                </IconButton>
                              </Box>
                              <TextField
                                fullWidth
                                multiline
                                minRows={3}
                                maxRows={6}
                                value={(() => {
                                  const selectedMeal = currentMeals.find(m => m.id === selectedMealId);
                                  return selectedMeal?.notes || '';
                                })()}
                                onChange={(e) => {
                                  const notes = e.target.value;
                                  // Update current meals
                                  setCurrentMeals((prev) => prev.map((m) => m.id !== (selectedMealId as string) ? m : ({ ...m, notes })));
                                  // Update plans tree
                                  if (selectedPlanId && selectedCycleId) {
                                    setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                                      ...p,
                                      cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({
                                        ...c,
                                        meals: (c.meals || []).map((m) => m.id !== (selectedMealId as string) ? m : ({ ...m, notes }))
                                      }))
                                    })));
                                  }
                                  setIsPlanDirty(true);
                                }}
                                placeholder="Add notes about this meal..."
                                variant="outlined"
                                size="small"
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    fontSize: '0.875rem'
                                  }
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      );
                    })()}
                  
                  {/* Notes Button - At the end */}
                  {selectedMealId && currentMeals.find(m => m.id === selectedMealId) && (
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                      <Button
                        variant="contained"
                        size="medium"
                        startIcon={<DocumentText size={18} />}
                        onClick={() => {
                          setShowMealNotesSection(!showMealNotesSection);
                        }}
                        sx={{
                          borderRadius: 2,
                          boxShadow: 2,
                          textTransform: 'none',
                          px: 2,
                          py: 1,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        Notes
                      </Button>
                    </Box>
                  )}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">Select a meal to view food items</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={isCreatePlanDialogOpen} onClose={() => setIsCreatePlanDialogOpen(false)}>
        <DialogTitle>Create Nutrition Plan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Plan Title"
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreatePlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} disabled={saving || !newPlanTitle.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cycle Notes Dialog */}
      <Dialog open={cycleNotesDialogOpen} onClose={() => setCycleNotesDialogOpen(false)}>
        <DialogTitle>Edit Cycle Notes</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={cycleNotesDraft}
            onChange={(e) => setCycleNotesDraft(e.target.value)}
            placeholder="Add notes about this cycle..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCycleNotesDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              // persist notes in current selected cycle
              if (!selectedCycleId || !selectedPlanId) { setCycleNotesDialogOpen(false); return; }
              setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                ...p,
                cycles: (p.cycles || []).map((c) => c.id !== selectedCycleId ? c : ({ ...c, notes: cycleNotesDraft }))
              })));
              setCycleNotesDialogOpen(false);
              setIsPlanDirty(true);
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meal Notes Dialog */}
      <Dialog open={mealNotesDialogOpen} onClose={() => setMealNotesDialogOpen(false)}>
        <DialogTitle>Edit Meal Notes</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={mealNotesDraft}
            onChange={(e) => setMealNotesDraft(e.target.value)}
            placeholder="Add notes about this meal..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMealNotesDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!mealNotesMealId || !selectedPlanId) { setMealNotesDialogOpen(false); return; }
              setPlans((prev) => prev.map((p) => p.id !== selectedPlanId ? p : ({
                ...p,
                cycles: (p.cycles || []).map((c) => ({
                  ...c,
                  meals: (c.meals || []).map((m) => m.id !== mealNotesMealId ? m : ({ ...m, notes: mealNotesDraft }))
                }))
              })));
              setIsPlanDirty(true);
              setMealNotesDialogOpen(false);
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Meal Dialog */}
      <Dialog open={isCreateMealDialogOpen} onClose={() => setIsCreateMealDialogOpen(false)}>
        <DialogTitle>Create Meal</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Meal Title"
            value={newMealTitle}
            onChange={(e) => setNewMealTitle(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateMealDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateMeal} disabled={saving || !newMealTitle.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Food Dialog */}
      <Dialog open={isAddFoodDialogOpen} onClose={() => {
        setIsAddFoodDialogOpen(false);
        setFoodSearchTerm('');
        setFoodPage(1);
      }} maxWidth="md" fullWidth>
        <DialogTitle>Add Food Items to Meal</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              placeholder="Search food items..."
              value={foodSearchTerm}
              onChange={(e) => {
                setFoodSearchTerm(e.target.value);
                setFoodPage(1);
              }}
              sx={{ mb: 2 }}
              autoFocus
            />
            {(() => {
              const filteredFood = workspaceFood.filter((food) => 
                food.name.toLowerCase().includes(foodSearchTerm.toLowerCase())
              );
              const totalPages = Math.ceil(filteredFood.length / foodItemsPerPage);
              const startIndex = (foodPage - 1) * foodItemsPerPage;
              const endIndex = startIndex + foodItemsPerPage;
              const paginatedFood = filteredFood.slice(startIndex, endIndex);
              
              return (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {filteredFood.length} item(s) found
                  </Typography>
                  <List>
                    {paginatedFood.map((food) => {
                const isSelected = selectedFoodItems.includes(food.id);
                
                return (
                  <ListItem
                    key={food.id}
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFoodItems(prev => prev.filter(id => id !== food.id));
                      } else {
                        setSelectedFoodItems(prev => [...prev, food.id]);
                      }
                    }}
                  >
                    <ListItemText
                      primary={food.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {food.calories} cal per {food.servingSize}{food.unit} • {food.protein}g protein • {food.carbs}g carbs • {food.fat}g fat
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
                    })}
                  </List>
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
                      <Pagination
                        count={totalPages}
                        page={foodPage}
                        onChange={(_, page) => setFoodPage(page)}
                        color="primary"
                        size="large"
                      />
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddFoodDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddFoodToMeal} disabled={saving || !selectedFoodItems.length}>
            {saving ? <CircularProgress size={20} /> : `Add ${selectedFoodItems.length} item(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Plan Dialog */}
      <LoadPlanDialog
        open={loadPlanDialogOpen}
        onClose={() => setLoadPlanDialogOpen(false)}
        planType="nutrition"
        currentClientId={clientId}
        onPlanLoaded={() => {
          loadAllPlansData();
          openSnackbar({
            open: true,
            message: 'Nutrition plan copied successfully!',
            variant: 'alert',
            alert: { color: 'success', variant: 'filled' }
          } as any);
        }}
      />
      
      {/* Form Completion Dialog */}
      <Dialog
        open={formCompletionDialogOpen}
        onClose={() => !archivingForms && setFormCompletionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5">Submitted Nutrition Forms Found</Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This client has submitted {submittedForms.length} nutrition form{submittedForms.length !== 1 ? 's' : ''}. 
            Would you like to mark any of them as done before activating the plan?
          </Alert>
          
          {submittedForms.length > 0 && (
            <Stack spacing={1}>
              {submittedForms.map((form) => (
                <FormControlLabel
                  key={form.id}
                  control={
                    <Checkbox
                      checked={selectedFormsToArchive.includes(form.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFormsToArchive([...selectedFormsToArchive, form.id]);
                        } else {
                          setSelectedFormsToArchive(selectedFormsToArchive.filter(id => id !== form.id));
                        }
                      }}
                      disabled={archivingForms}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{form.formTitle}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Submitted: {new Date(form.submittedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setFormCompletionDialogOpen(false)}
            disabled={archivingForms}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFormCompletionContinue}
            variant="contained"
            disabled={archivingForms}
          >
            {archivingForms ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              `Continue${selectedFormsToArchive.length > 0 ? ` & Mark ${selectedFormsToArchive.length} as Done` : ''}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Form Scheduling Popup */}
      <FormSchedulingPopup
        open={formSchedulingPopupOpen}
        onClose={() => setFormSchedulingPopupOpen(false)}
        onSchedule={handleFormSchedule}
        clientId={clientId}
        formType="nutrition"
        clientName={clientName}
        onlyScheduled={true}
      />

      {/* Macros Overview Dialog */}
      <Dialog 
        open={isMacrosDialogOpen} 
        onClose={() => setIsMacrosDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Information size={20} />
            <Typography variant="h6">Nutritional Analysis - {calculateCurrentCycleMacros().cycleName}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentCycle ? (
            <Box sx={{ mt: 2 }}>
              {(() => {
                const cycleMacros = calculateCurrentCycleMacros();
                // Theme-aware colors for light and dark modes
                const isDark = theme.palette.mode === 'dark';
                const macroColors = {
                  protein: isDark ? '#64b5f6' : '#1976d2',
                  carbs: isDark ? '#81c784' : '#388e3c',
                  fat: isDark ? '#ffb74d' : '#f57c00'
                };
                return (
                  <Card sx={{ p: 2 }}>
                    {/* Total Calories */}
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {cycleMacros.calories} kcal
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Total Calories</Typography>
                    </Box>

                    {/* Macro Breakdown */}
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Macronutrients</Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center', p: 1, bgcolor: macroColors.protein, borderRadius: 1, color: 'white' }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {cycleMacros.protein}g
                          </Typography>
                          <Typography variant="body2">Protein</Typography>
                          <Typography variant="caption">
                            {cycleMacros.proteinKcal} kcal
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center', p: 1, bgcolor: macroColors.carbs, borderRadius: 1, color: 'white' }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {cycleMacros.carbs}g
                          </Typography>
                          <Typography variant="body2">Carbs</Typography>
                          <Typography variant="caption">
                            {cycleMacros.carbsKcal} kcal
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center', p: 1, bgcolor: macroColors.fat, borderRadius: 1, color: 'white' }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {cycleMacros.fat}g
                          </Typography>
                          <Typography variant="body2">Fat</Typography>
                          <Typography variant="caption">
                            {cycleMacros.fatKcal} kcal
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Macro Percentages */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Macro Distribution</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={`Protein: ${cycleMacros.calories > 0 ? Math.round((cycleMacros.proteinKcal / cycleMacros.calories) * 100) : 0}%`}
                          size="small"
                          sx={{ bgcolor: macroColors.protein, color: 'white' }}
                        />
                        <Chip 
                          label={`Carbs: ${cycleMacros.calories > 0 ? Math.round((cycleMacros.carbsKcal / cycleMacros.calories) * 100) : 0}%`}
                          size="small"
                          sx={{ bgcolor: macroColors.carbs, color: 'white' }}
                        />
                        <Chip 
                          label={`Fat: ${cycleMacros.calories > 0 ? Math.round((cycleMacros.fatKcal / cycleMacros.calories) * 100) : 0}%`}
                          size="small"
                          sx={{ bgcolor: macroColors.fat, color: 'white' }}
                        />
                      </Box>
                    </Box>

                    {/* Micronutrients */}
                    <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>Micronutrients & Vitamins</Typography>
                    <Grid container spacing={1}>
                      {Object.entries(cycleMacros.micronutrients)
                        .filter(([key, value]) => value > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => {
                          const displayName = key
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                          // Unit map aligned with seed/import conventions
                          const unitMap: Record<string, string> = {
                            water: 'g', ash: 'g', fiber: 'g',
                            sodium: 'mg', potassium: 'mg', calcium: 'mg', phosphorous: 'mg', magnesium: 'mg', iron: 'mg', zinc: 'mg', copper: 'mg', manganese: 'mg', fluoride: 'mg', selenium: 'mg',
                            vitamin_a: 'μg', vitamin_b12: 'μg', vitamin_k: 'μg', folic_acid: 'μg', vitamin_d: 'IU',
                            vitamin_c: 'mg', vitamin_e: 'mg', niacin: 'mg', choline: 'mg', betaine: 'mg', vitamin_b1: 'mg', vitamin_b2: 'mg', vitamin_b5: 'mg', vitamin_b6: 'mg',
                          };
                          const unit = unitMap[key] || 'mg';
                          
                          return (
                            <Grid item xs={6} sm={4} key={key}>
                              <Box sx={{ 
                                p: 1, 
                                border: '1px solid', 
                                borderColor: 'divider', 
                                borderRadius: 1,
                                textAlign: 'center',
                                bgcolor: 'background.paper'
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                  {Math.round(value * 100) / 100} {unit}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {displayName}
                                </Typography>
                              </Box>
                            </Grid>
                          );
                        })}
                    </Grid>
                    
                    {Object.keys(cycleMacros.micronutrients).length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No micronutrient data available for this cycle
                        </Typography>
                      </Box>
                    )}
                  </Card>
                );
              })()}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No cycle selected to display nutritional analysis
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsMacrosDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
    </Box>
  );
}
