'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Tooltip,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add,
  Delete,
  DragIndicator,
  Image as ImageIcon,
  TextFields,
  Restaurant,
  CheckCircle,
  Edit,
  ZoomIn,
  ZoomOut,
  Refresh,
  PictureAsPdf,
  Visibility,
  VisibilityOff,
  Settings,
  ExpandMore,
  Palette,
  FormatSize,
  Image,
  Article,
  ViewDay,
  CloudUpload,
} from '@mui/icons-material';
import { previewVisualPdfFromConfig } from '@/api/visual-pdf-templates';
// Removed dnd-kit imports - using native mouse events instead

// Page types
export type PageType = 'intro' | 'content' | 'custom' | 'end';

export interface FoodItemElement {
  id: string;
  name: string;
  quantity?: number;
  x: number;
  y: number;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  position?: 'left' | 'right' | 'center';
}

export interface MealElement {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  foodItems: FoodItemElement[];
  showMacros?: boolean;
  showCalories?: boolean;
}

export interface PageElement {
  id: string;
  type: 'meal' | 'mealItem' | 'foodItem' | 'image' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  imageUrl?: string;
  // Styling properties
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  backgroundColor?: string;
  // Meal-specific
  mealData?: MealElement;
  mealsCount?: number; // For meal placeholders
  // Food item specific
  foodItemData?: FoodItemElement;
  parentMealId?: string; // If this is a food item, which meal it belongs to
}

export interface VisualPage {
  id: string;
  type: PageType;
  isContentPage: boolean;
  backgroundImage?: string;
  elements: PageElement[];
  order: number;
}

interface VisualPageEditorProps {
  kind: 'workout' | 'nutrition';
  pages: VisualPage[];
  onPagesChange: (pages: VisualPage[]) => void;
  onSave: (config: any) => void;
  workspaceName?: string;
  existingConfig?: any; // Existing config to preserve styling
}

// Draggable element component
function DraggableElement({
  element,
  pageId,
  onUpdate,
  onDelete,
  onEdit,
  scale = 1,
}: {
  element: PageElement;
  pageId: string;
  onUpdate: (elementId: string, updates: Partial<PageElement>) => void;
  onDelete: (elementId: string) => void;
  onEdit: (element: PageElement) => void;
  scale?: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    const pageElement = elementRef.current?.closest('[data-page-id]') as HTMLElement;
    if (pageElement) {
      const pageRect = pageElement.getBoundingClientRect();
      // Calculate mouse position in page coordinates
      const mouseXInPage = (e.clientX - pageRect.left) / scale;
      const mouseYInPage = (e.clientY - pageRect.top) / scale;
      
      // Use the stored element position directly (already in page coordinates)
      const elementXInPage = element.x || 0;
      const elementYInPage = element.y || 0;
      
      // Calculate offset from mouse to element's top-left corner
      setDragStart({
        x: mouseXInPage - elementXInPage,
        y: mouseYInPage - elementYInPage,
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !elementRef.current) return;

    const pageElement = elementRef.current.closest('[data-page-id]') as HTMLElement;
    if (!pageElement) return;

    const pageRect = pageElement.getBoundingClientRect();
    // Calculate new position: mouse position in page coordinates minus the drag offset
    const mouseXInPage = (e.clientX - pageRect.left) / scale;
    const mouseYInPage = (e.clientY - pageRect.top) / scale;
    
    const newX = mouseXInPage - dragStart.x;
    const newY = mouseYInPage - dragStart.y;

    // Constrain to page bounds
    const elementWidth = element.width || 200;
    const elementHeight = element.height || 100;
    const constrainedX = Math.max(0, Math.min(newX, 595 - elementWidth));
    const constrainedY = Math.max(0, Math.min(newY, 842 - elementHeight));

    onUpdate(element.id, {
      x: constrainedX,
      y: constrainedY,
    });
  }, [isDragging, dragStart, scale, element, onUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const renderElement = () => {
    switch (element.type) {
      case 'meal':
        // Individual meal element
        if (element.mealData) {
          return (
            <Box
              sx={{
                border: '2px solid #1976d2',
                borderRadius: 1,
                p: 2,
                bgcolor: element.backgroundColor || 'rgba(25, 118, 210, 0.1)',
                minWidth: element.width || 250,
                minHeight: element.height || 150,
              }}
            >
              <Typography
                variant="body2"
                fontWeight={element.fontWeight || 'bold'}
                fontSize={element.fontSize || 14}
                color={element.color || '#1976d2'}
                sx={{ mb: 1 }}
              >
                {element.mealData.name || 'Meal'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {element.mealData.foodItems.map((foodItem) => (
                  <Box
                    key={foodItem.id}
                    sx={{
                      border: '1px solid #ccc',
                      borderRadius: 0.5,
                      p: 0.5,
                      fontSize: foodItem.fontSize || 10,
                      fontWeight: foodItem.fontWeight || 'normal',
                      color: foodItem.color || 'inherit',
                      bgcolor: 'white',
                    }}
                  >
                    • {foodItem.name} {foodItem.quantity ? `(${foodItem.quantity})` : ''}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        }
        // Meal placeholder (legacy)
        return (
          <Box
            sx={{
              border: '2px dashed #1976d2',
              borderRadius: 1,
              p: 2,
              bgcolor: 'rgba(25, 118, 210, 0.1)',
              minWidth: 200,
              minHeight: 100,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Restaurant fontSize="small" />
              <Typography variant="caption" fontWeight="bold">
                Meal Placeholder
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {element.mealsCount || 3} meals will be rendered here
            </Typography>
          </Box>
        );
      case 'mealItem':
        // Individual meal item (single meal)
        return (
          <Box
            sx={{
              border: '2px solid #1976d2',
              borderRadius: 1,
              p: 1.5,
              bgcolor: element.backgroundColor || 'rgba(25, 118, 210, 0.1)',
              minWidth: element.width || 200,
              minHeight: element.height || 80,
            }}
          >
            <Typography
              variant="body2"
              fontWeight={element.fontWeight || 'bold'}
              fontSize={element.fontSize || 14}
              color={element.color || '#1976d2'}
            >
              {element.content || 'Meal Name'}
            </Typography>
          </Box>
        );
      case 'foodItem':
        // Individual food item
        return (
          <Box
            sx={{
              border: '1px solid #4caf50',
              borderRadius: 0.5,
              p: 1,
              bgcolor: element.backgroundColor || 'rgba(76, 175, 80, 0.1)',
              minWidth: element.width || 150,
            }}
          >
            <Typography
              variant="caption"
              fontWeight={element.fontWeight || 'normal'}
              fontSize={element.fontSize || 12}
              color={element.color || '#4caf50'}
            >
              • {element.content || 'Food Item'}
            </Typography>
          </Box>
        );
      case 'image':
        return (
          <Box
            sx={{
              border: '2px solid #4caf50',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: '#f5f5f5',
              width: element.width || 200,
              height: element.height || 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {element.imageUrl ? (
              <img
                src={element.imageUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <ImageIcon sx={{ fontSize: 40, color: '#4caf50' }} />
                <Typography variant="caption" display="block" mt={1}>
                  Image
                </Typography>
              </Box>
            )}
          </Box>
        );
      case 'text':
        return (
          <Box
            sx={{
              border: '2px solid #ff9800',
              borderRadius: 1,
              p: 1,
              bgcolor: 'rgba(255, 152, 0, 0.1)',
              minWidth: 150,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <TextFields fontSize="small" />
              <Typography variant="caption" fontWeight="bold">
                Text
              </Typography>
            </Box>
            <Typography variant="body2">{element.content || 'Text content'}</Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box
      ref={elementRef}
      style={style}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'absolute',
        left: element.x * scale,
        top: element.y * scale,
        zIndex: isDragging ? 1000 : 1,
        userSelect: 'none',
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {renderElement()}
        <Box sx={{ position: 'absolute', top: -8, right: -8, display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            sx={{
              bgcolor: 'white',
              boxShadow: 1,
              '&:hover': { bgcolor: 'grey.100' },
            }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(element);
            }}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              bgcolor: 'white',
              boxShadow: 1,
              '&:hover': { bgcolor: 'error.light' },
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

// Page component
function PageCanvas({
  page,
  onElementUpdate,
  onElementAdd,
  onElementDelete,
  onElementEdit,
  scale = 1,
}: {
  page: VisualPage;
  onElementUpdate: (elementId: string, updates: Partial<PageElement>) => void;
  onElementAdd: (type: PageElement['type']) => void;
  onElementDelete: (elementId: string) => void;
  onElementEdit: (element: PageElement) => void;
  scale?: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);

  const A4_WIDTH = 595;
  const A4_HEIGHT = 842;
  const displayWidth = A4_WIDTH * scale;
  const displayHeight = A4_HEIGHT * scale;

  const handlePageClick = (e: React.MouseEvent) => {
    // If clicking directly on the page background (not on an element), could add element here
    if (e.target === pageRef.current || (e.target as HTMLElement).classList.contains('page-background')) {
      // Could trigger add element dialog
    }
  };

  return (
    <Paper
      ref={pageRef}
      data-page-id={page.id}
      className="page-background"
      onClick={handlePageClick}
      sx={{
        width: displayWidth,
        height: displayHeight,
        position: 'relative',
        bgcolor: 'white',
        boxShadow: 3,
        overflow: 'hidden',
        backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {page.elements.map((element) => (
        <DraggableElement
          key={element.id}
          element={element}
          pageId={page.id}
          onUpdate={onElementUpdate}
          onDelete={onElementDelete}
          onEdit={onElementEdit}
          scale={scale}
        />
      ))}
      {page.elements.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">Click to add elements</Typography>
        </Box>
      )}
    </Paper>
  );
}

export default function VisualPageEditor({ kind, pages, onPagesChange, onSave, workspaceName, existingConfig }: VisualPageEditorProps) {
  const [selectedPage, setSelectedPage] = useState<VisualPage | null>(null);
  const [scale, setScale] = useState(0.5);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [pendingElementType, setPendingElementType] = useState<PageElement['type'] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [editingElement, setEditingElement] = useState<PageElement | null>(null);
  const [newElementType, setNewElementType] = useState<PageElement['type']>('meal');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortControllerRef = useRef<AbortController | null>(null);
  const [propertyTab, setPropertyTab] = useState(0); // 0: Page, 1: General, 2: Content

  // Update selectedPage when pages change
  React.useEffect(() => {
    if (pages.length > 0 && (!selectedPage || !pages.find(p => p.id === selectedPage.id))) {
      setSelectedPage(pages[0]);
    } else if (pages.length === 0) {
      setSelectedPage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Removed handleDragEnd - using mouse events in DraggableElement instead

  const handleAddPage = () => {
    const newPage: VisualPage = {
      id: `page-${Date.now()}`,
      type: 'custom',
      isContentPage: false,
      elements: [],
      order: pages.length,
    };
    onPagesChange([...pages, newPage]);
    setSelectedPage(newPage);
  };

  const handleDeletePage = (pageId: string) => {
    const updatedPages = pages.filter((p) => p.id !== pageId);
    onPagesChange(updatedPages);
    if (selectedPage?.id === pageId) {
      setSelectedPage(updatedPages[0] || null);
    }
  };

  const handleAddElement = (type: PageElement['type']) => {
    if (!selectedPage) return;

    // If it's mealItem or foodItem, show quantity dialog
    if (type === 'mealItem' || type === 'foodItem') {
      setPendingElementType(type);
      setQuantity(1);
      setShowAddElementDialog(false);
      setShowQuantityDialog(true);
      return;
    }

    // For other types, add directly
    addElementToPage(type, 1);
  };

  const addElementToPage = (type: PageElement['type'], count: number) => {
    if (!selectedPage) return;

    const newElements: PageElement[] = [];
    const baseY = 50;
    const spacing = 120; // Vertical spacing between elements

    for (let i = 0; i < count; i++) {
      let newElement: PageElement;
      const timestamp = Date.now() + i; // Unique ID for each element
      
      if (type === 'meal') {
        // Meal placeholder (legacy)
        newElement = {
          id: `element-${timestamp}`,
          type: 'meal',
          x: 50,
          y: baseY + (i * spacing),
          mealsCount: 3,
          width: 250,
          height: 200,
        };
      } else if (type === 'mealItem') {
        // Individual meal name element - each gets a unique meal index
        newElement = {
          id: `element-${timestamp}`,
          type: 'mealItem',
          x: 50,
          y: baseY + (i * spacing),
          content: `Meal ${i + 1}`,
          width: 200,
          height: 50,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#1976d2',
          dayIndex: 0, // Default to first day
          mealIndex: i, // Each meal item gets a unique meal index
          mealData: {
            id: `meal-${timestamp}`,
            name: `Meal ${i + 1}`,
            x: 50,
            y: baseY + (i * spacing),
            foodItems: [],
          },
        };
      } else if (type === 'foodItem') {
        // Food items element - shows all food items of a meal
        newElement = {
          id: `element-${timestamp}`,
          type: 'foodItem',
          x: 50,
          y: baseY + (i * spacing),
          content: `Food Items`,
          width: 300,
          height: 200,
          fontSize: 12,
          fontWeight: 'normal',
          color: '#4caf50',
          dayIndex: 0, // Default to first day
          mealIndex: i, // Each food item element references a different meal
          foodItemData: {
            id: `food-${timestamp}`,
            name: `Food Items`,
            x: 50,
            y: baseY + (i * spacing),
          },
        };
      } else if (type === 'image') {
        newElement = {
          id: `element-${timestamp}`,
          type: 'image',
          x: 50,
          y: baseY + (i * spacing),
          width: 200,
          height: 150,
        };
      } else {
        // text
        newElement = {
          id: `element-${timestamp}`,
          type: 'text',
          x: 50,
          y: baseY + (i * spacing),
          content: 'Text content',
          fontSize: 12,
          fontWeight: 'normal',
          color: '#000000',
        };
      }
      newElements.push(newElement);
    }

    const updatedPages = pages.map((p) =>
      p.id === selectedPage.id
        ? { ...p, elements: [...p.elements, ...newElements] }
        : p
    );

    onPagesChange(updatedPages);
    // Update selectedPage to reflect the new elements
    const updatedSelectedPage = updatedPages.find(p => p.id === selectedPage.id);
    if (updatedSelectedPage) {
      setSelectedPage(updatedSelectedPage);
    }
    setShowQuantityDialog(false);
    setPendingElementType(null);
    // Auto-select the last new element for editing
    if (newElements.length > 0) {
      setEditingElement(newElements[newElements.length - 1]);
    }
  };

  const handleConfirmQuantity = () => {
    if (pendingElementType && quantity > 0) {
      addElementToPage(pendingElementType, quantity);
    }
  };

  const handleElementUpdate = (elementId: string, updates: Partial<PageElement>) => {
    if (!selectedPage) return;

    const updatedPages = pages.map((p) =>
      p.id === selectedPage.id
        ? {
            ...p,
            elements: p.elements.map((el) =>
              el.id === elementId ? { ...el, ...updates } : el
            ),
          }
        : p
    );

    onPagesChange(updatedPages);
    // Update selectedPage to reflect changes
    const updatedSelectedPage = updatedPages.find(p => p.id === selectedPage.id);
    if (updatedSelectedPage) {
      setSelectedPage(updatedSelectedPage);
    }
  };

  const handleDeleteElement = (elementId: string) => {
    if (!selectedPage) return;

    const updatedPages = pages.map((p) =>
      p.id === selectedPage.id
        ? {
            ...p,
            elements: p.elements.filter((el) => el.id !== elementId),
          }
        : p
    );

    onPagesChange(updatedPages);
    const updatedSelectedPage = updatedPages.find(p => p.id === selectedPage.id);
    if (updatedSelectedPage) {
      setSelectedPage(updatedSelectedPage);
    }
  };

  const handleToggleContentPage = (pageId: string) => {
    const updatedPages = pages.map((p) =>
      p.id === pageId ? { ...p, isContentPage: !p.isContentPage } : p
    );
    onPagesChange(updatedPages);
  };

  // Generate PDF preview
  const generatePreview = useCallback(async () => {
    // Cancel any ongoing preview generation
    if (previewAbortControllerRef.current) {
      previewAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    previewAbortControllerRef.current = abortController;

    try {
      setGeneratingPreview(true);
      setPreviewError(null);
      
      // Convert visual pages to config, preserving existing config
      const config = convertVisualPagesToConfig(pages, existingConfig);
      
      // Generate preview
      const { previewUrl: url } = await previewVisualPdfFromConfig(
        config,
        kind,
        workspaceName,
        abortController.signal
      );
      
      // Only update if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setPreviewUrl(url);
      }
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (!abortController.signal.aborted && error.name !== 'AbortError') {
        console.error('Preview generation error:', error);
        setPreviewError(error.message || 'Failed to generate preview');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setGeneratingPreview(false);
      }
    }
  }, [pages, kind, workspaceName]);

  // Auto-generate preview when pages change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pages.length > 0 && showPreview) {
        generatePreview();
      }
    }, 1000); // Wait 1 second after last change

    return () => {
      clearTimeout(timeoutId);
      if (previewAbortControllerRef.current) {
        previewAbortControllerRef.current.abort();
      }
    };
  }, [pages, showPreview, generatePreview]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: 2 }}>
      {/* Main Editor Section */}
      <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 0 }}>
      {/* Left sidebar - Pages list */}
      <Paper sx={{ width: 250, p: 2, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Pages</Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={handleAddPage}
            variant="contained"
          >
            Add Page
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pages.map((page) => (
            <Paper
              key={page.id}
              sx={{
                p: 1.5,
                cursor: 'pointer',
                border: selectedPage?.id === page.id ? 2 : 1,
                borderColor: selectedPage?.id === page.id ? 'primary.main' : 'divider',
                bgcolor: selectedPage?.id === page.id ? 'action.selected' : 'background.paper',
              }}
              onClick={() => setSelectedPage(page)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" fontWeight="medium">
                  {page.type === 'intro' ? 'Intro' : page.type === 'end' ? 'End' : page.type === 'content' ? 'Content' : 'Custom'} Page
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePage(page.id);
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={page.isContentPage ? 'Content' : 'Static'}
                  size="small"
                  color={page.isContentPage ? 'primary' : 'default'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleContentPage(page.id);
                  }}
                />
                <Chip label={`${page.elements.length} elements`} size="small" variant="outlined" />
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>

      {/* Center - Canvas */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {selectedPage
              ? `${selectedPage.type === 'intro' ? 'Intro' : selectedPage.type === 'end' ? 'End' : selectedPage.type === 'content' ? 'Content' : 'Custom'} Page`
              : 'No page selected'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={() => setScale(Math.min(scale + 0.1, 1))}>
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={() => setScale(Math.max(scale - 0.1, 0.2))}>
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowAddElementDialog(true)}
              disabled={!selectedPage}
            >
              Add Element
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            p: 2,
            bgcolor: 'grey.200',
          }}
        >
          {selectedPage ? (
            <PageCanvas
              page={selectedPage}
              onElementUpdate={handleElementUpdate}
              onElementAdd={handleAddElement}
              onElementDelete={handleDeleteElement}
              onElementEdit={(element) => setEditingElement(element)}
              scale={scale}
            />
          ) : (
            <Typography>Select a page to edit</Typography>
          )}
        </Box>
      </Box>

      {/* Right sidebar - Element properties */}
      <Paper sx={{ width: 350, p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {editingElement ? 'Edit Element' : 'Properties'}
          </Typography>
          {!editingElement && (
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                // Convert visual pages to config and save, preserving existing config
                const config = convertVisualPagesToConfig(pages, existingConfig);
                onSave(config);
              }}
            >
              Save
            </Button>
          )}
        </Box>

        {/* Tabs for different property sections */}
        {!editingElement && (
          <Tabs
            value={propertyTab}
            onChange={(e, newValue) => setPropertyTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Page" />
            <Tab label="General" />
            <Tab label="Content" />
          </Tabs>
        )}
        {editingElement ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="X Position"
              type="number"
              value={editingElement.x}
              onChange={(e) => {
                const updated = { ...editingElement, x: Number(e.target.value) };
                setEditingElement(updated);
                handleElementUpdate(editingElement.id, { x: Number(e.target.value) });
              }}
              size="small"
              fullWidth
            />
            <TextField
              label="Y Position"
              type="number"
              value={editingElement.y}
              onChange={(e) => {
                const updated = { ...editingElement, y: Number(e.target.value) };
                setEditingElement(updated);
                handleElementUpdate(editingElement.id, { y: Number(e.target.value) });
              }}
              size="small"
              fullWidth
            />
            {/* Common properties */}
            {(editingElement.type === 'text' || editingElement.type === 'meal' || editingElement.type === 'mealItem' || editingElement.type === 'foodItem') && (
              <>
                <TextField
                  label="Font Size"
                  type="number"
                  value={editingElement.fontSize || 12}
                  onChange={(e) => {
                    const updated = { ...editingElement, fontSize: Number(e.target.value) };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { fontSize: Number(e.target.value) });
                  }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Font Weight"
                  select
                  value={editingElement.fontWeight || 'normal'}
                  onChange={(e) => {
                    const updated = { ...editingElement, fontWeight: e.target.value };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { fontWeight: e.target.value });
                  }}
                  size="small"
                  fullWidth
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                  <MenuItem value="100">100</MenuItem>
                  <MenuItem value="200">200</MenuItem>
                  <MenuItem value="300">300</MenuItem>
                  <MenuItem value="400">400</MenuItem>
                  <MenuItem value="500">500</MenuItem>
                  <MenuItem value="600">600</MenuItem>
                  <MenuItem value="700">700</MenuItem>
                  <MenuItem value="800">800</MenuItem>
                  <MenuItem value="900">900</MenuItem>
                </TextField>
                <TextField
                  label="Text Color"
                  type="color"
                  value={editingElement.color || '#000000'}
                  onChange={(e) => {
                    const updated = { ...editingElement, color: e.target.value };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { color: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Background Color"
                  type="color"
                  value={editingElement.backgroundColor || '#ffffff'}
                  onChange={(e) => {
                    const updated = { ...editingElement, backgroundColor: e.target.value };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { backgroundColor: e.target.value });
                  }}
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}
            {(editingElement.type === 'image' || editingElement.type === 'meal' || editingElement.type === 'mealItem') && (
              <>
                <TextField
                  label="Width"
                  type="number"
                  value={editingElement.width || 200}
                  onChange={(e) => {
                    const updated = { ...editingElement, width: Number(e.target.value) };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { width: Number(e.target.value) });
                  }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Height"
                  type="number"
                  value={editingElement.height || 150}
                  onChange={(e) => {
                    const updated = { ...editingElement, height: Number(e.target.value) };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { height: Number(e.target.value) });
                  }}
                  size="small"
                  fullWidth
                />
              </>
            )}
            {editingElement.type === 'text' && (
              <TextField
                label="Text Content"
                value={editingElement.content || ''}
                onChange={(e) => {
                  const updated = { ...editingElement, content: e.target.value };
                  setEditingElement(updated);
                  handleElementUpdate(editingElement.id, { content: e.target.value });
                }}
                size="small"
                fullWidth
                multiline
                rows={3}
              />
            )}
            {editingElement.type === 'image' && (
              <>
                <TextField
                  label="Image URL"
                  value={editingElement.imageUrl || ''}
                  onChange={(e) => {
                    const updated = { ...editingElement, imageUrl: e.target.value };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { imageUrl: e.target.value });
                  }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Width"
                  type="number"
                  value={editingElement.width || 200}
                  onChange={(e) => {
                    const updated = { ...editingElement, width: Number(e.target.value) };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { width: Number(e.target.value) });
                  }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Height"
                  type="number"
                  value={editingElement.height || 150}
                  onChange={(e) => {
                    const updated = { ...editingElement, height: Number(e.target.value) };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, { height: Number(e.target.value) });
                  }}
                  size="small"
                  fullWidth
                />
              </>
            )}
            {editingElement.type === 'mealItem' && (
              <>
                <TextField
                  label="Meal Name"
                  value={editingElement.content || editingElement.mealData?.name || ''}
                  onChange={(e) => {
                    const updated = {
                      ...editingElement,
                      content: e.target.value,
                      mealData: {
                        ...editingElement.mealData!,
                        name: e.target.value,
                      },
                    };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, {
                      content: e.target.value,
                      mealData: {
                        ...editingElement.mealData!,
                        name: e.target.value,
                      },
                    });
                  }}
                  size="small"
                  fullWidth
                />
              </>
            )}
            {editingElement.type === 'foodItem' && (
              <>
                <TextField
                  label="Food Item Name"
                  value={editingElement.content || editingElement.foodItemData?.name || ''}
                  onChange={(e) => {
                    const updated = {
                      ...editingElement,
                      content: e.target.value,
                      foodItemData: {
                        ...editingElement.foodItemData!,
                        name: e.target.value,
                      },
                    };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, {
                      content: e.target.value,
                      foodItemData: {
                        ...editingElement.foodItemData!,
                        name: e.target.value,
                      },
                    });
                  }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Quantity"
                  type="number"
                  value={editingElement.foodItemData?.quantity || 1}
                  onChange={(e) => {
                    const updated = {
                      ...editingElement,
                      foodItemData: {
                        ...editingElement.foodItemData!,
                        quantity: Number(e.target.value),
                      },
                    };
                    setEditingElement(updated);
                    handleElementUpdate(editingElement.id, {
                      foodItemData: {
                        ...editingElement.foodItemData!,
                        quantity: Number(e.target.value),
                      },
                    });
                  }}
                  size="small"
                  fullWidth
                />
              </>
            )}
            {editingElement.type === 'meal' && (
              <TextField
                label="Number of Meals"
                type="number"
                value={editingElement.mealsCount || 3}
                onChange={(e) => {
                  const updated = { ...editingElement, mealsCount: Number(e.target.value) };
                  setEditingElement(updated);
                  handleElementUpdate(editingElement.id, { mealsCount: Number(e.target.value) });
                }}
                size="small"
                fullWidth
              />
            )}
            <Button
              variant="outlined"
              onClick={() => setEditingElement(null)}
              fullWidth
            >
              Close
            </Button>
          </Box>
        ) : propertyTab === 0 && selectedPage ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Page Type: {selectedPage.type === 'intro' ? 'Intro' : selectedPage.type === 'end' ? 'End' : selectedPage.type === 'content' ? 'Content' : 'Custom'}
            </Typography>
            <TextField
              label="Background Image URL"
              value={selectedPage.backgroundImage || ''}
              onChange={(e) => {
                const updatedPages = pages.map((p) =>
                  p.id === selectedPage.id ? { ...p, backgroundImage: e.target.value } : p
                );
                onPagesChange(updatedPages);
                const updated = updatedPages.find(p => p.id === selectedPage.id);
                if (updated) setSelectedPage(updated);
              }}
              size="small"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedPage.isContentPage}
                  onChange={() => handleToggleContentPage(selectedPage.id)}
                />
              }
              label="Content Page (meals will render here)"
            />
            
            {/* Page-specific settings based on type */}
            {selectedPage.type === 'intro' && existingConfig?.introPage && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Intro Page Settings
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={existingConfig.introPage.showPlanTitle || false}
                      onChange={(e) => {
                        const newConfig = {
                          ...existingConfig,
                          introPage: {
                            ...existingConfig.introPage,
                            showPlanTitle: e.target.checked,
                          },
                        };
                        onSave(newConfig);
                      }}
                    />
                  }
                  label="Show Plan Title"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={existingConfig.introPage.showWorkspaceName || false}
                      onChange={(e) => {
                        const newConfig = {
                          ...existingConfig,
                          introPage: {
                            ...existingConfig.introPage,
                            showWorkspaceName: e.target.checked,
                          },
                        };
                        onSave(newConfig);
                      }}
                    />
                  }
                  label="Show Workspace Name"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={existingConfig.introPage.showClientName || false}
                      onChange={(e) => {
                        const newConfig = {
                          ...existingConfig,
                          introPage: {
                            ...existingConfig.introPage,
                            showClientName: e.target.checked,
                          },
                        };
                        onSave(newConfig);
                      }}
                    />
                  }
                  label="Show Client Name"
                />
                <TextField
                  label="Title Color"
                  type="color"
                  value={existingConfig.introPage.titleColor || '#000000'}
                  onChange={(e) => {
                    const newConfig = {
                      ...existingConfig,
                      introPage: {
                        ...existingConfig.introPage,
                        titleColor: e.target.value,
                      },
                    };
                    onSave(newConfig);
                  }}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Title Size"
                  type="number"
                  value={existingConfig.introPage.titleSize || 32}
                  onChange={(e) => {
                    const newConfig = {
                      ...existingConfig,
                      introPage: {
                        ...existingConfig.introPage,
                        titleSize: parseInt(e.target.value) || 32,
                      },
                    };
                    onSave(newConfig);
                  }}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                />
              </Box>
            )}
            
            {selectedPage.type === 'end' && existingConfig?.endPage && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  End Page Settings
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={existingConfig.endPage.showThankYouMessage || false}
                      onChange={(e) => {
                        const newConfig = {
                          ...existingConfig,
                          endPage: {
                            ...existingConfig.endPage,
                            showThankYouMessage: e.target.checked,
                          },
                        };
                        onSave(newConfig);
                      }}
                    />
                  }
                  label="Show Thank You Message"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={existingConfig.endPage.showContactInfo || false}
                      onChange={(e) => {
                        const newConfig = {
                          ...existingConfig,
                          endPage: {
                            ...existingConfig.endPage,
                            showContactInfo: e.target.checked,
                          },
                        };
                        onSave(newConfig);
                      }}
                    />
                  }
                  label="Show Contact Info"
                />
                <TextField
                  label="Text Color"
                  type="color"
                  value={existingConfig.endPage.textColor || '#000000'}
                  onChange={(e) => {
                    const newConfig = {
                      ...existingConfig,
                      endPage: {
                        ...existingConfig.endPage,
                        textColor: e.target.value,
                      },
                    };
                    onSave(newConfig);
                  }}
                  size="small"
                  fullWidth
                  sx={{ mt: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            )}
          </Box>
        ) : propertyTab === 1 ? (
          <GeneralSettingsPanel config={existingConfig} onConfigChange={onSave} />
        ) : propertyTab === 2 && existingConfig?.dayPages ? (
          <ContentPageSettingsPanel config={existingConfig} onConfigChange={onSave} kind={kind} />
        ) : null}
      </Paper>

      {/* Add Element Dialog */}
      <Dialog open={showAddElementDialog} onClose={() => setShowAddElementDialog(false)}>
        <DialogTitle>Add Element</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
            <Button
              variant="outlined"
              startIcon={<Restaurant />}
              onClick={() => handleAddElement('mealItem')}
              fullWidth
            >
              Individual Meal
            </Button>
            <Button
              variant="outlined"
              startIcon={<Restaurant />}
              onClick={() => handleAddElement('foodItem')}
              fullWidth
            >
              Food Item
            </Button>
            <Button
              variant="outlined"
              startIcon={<Restaurant />}
              onClick={() => handleAddElement('meal')}
              fullWidth
            >
              Meal Placeholder (Legacy)
            </Button>
            <Divider />
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={() => handleAddElement('image')}
              fullWidth
            >
              Image
            </Button>
            <Button
              variant="outlined"
              startIcon={<TextFields />}
              onClick={() => handleAddElement('text')}
              fullWidth
            >
              Text
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddElementDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Quantity Dialog */}
      <Dialog open={showQuantityDialog} onClose={() => setShowQuantityDialog(false)}>
        <DialogTitle>
          Add {pendingElementType === 'mealItem' ? 'Meals' : 'Food Items'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300, pt: 2 }}>
            <TextField
              label={`How many ${pendingElementType === 'mealItem' ? 'meals' : 'food items'}?`}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: 20 }}
              fullWidth
              autoFocus
            />
            <Typography variant="caption" color="text.secondary">
              {pendingElementType === 'mealItem' 
                ? 'Each meal will be added as a separate draggable element that you can position individually.'
                : 'Each food item will be added as a separate draggable element that you can position individually.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuantityDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmQuantity}>
            Add {quantity} {pendingElementType === 'mealItem' ? 'Meal(s)' : 'Food Item(s)'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>

      {/* PDF Preview Section */}
      <Paper sx={{ p: 2, maxHeight: '40vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdf />
            <Typography variant="h6">PDF Preview</Typography>
            {generatingPreview && <CircularProgress size={20} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={showPreview ? 'Hide Preview' : 'Show Preview'}>
              <IconButton size="small" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Preview">
              <IconButton size="small" onClick={generatePreview} disabled={generatingPreview}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Collapse in={showPreview}>
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {previewError && (
              <Alert severity="error" onClose={() => setPreviewError(null)}>
                {previewError}
              </Alert>
            )}
            
            {previewUrl ? (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  minHeight: '300px',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'auto',
                  bgcolor: 'grey.100',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  p: 2,
                }}
              >
                <iframe
                  src={previewUrl}
                  style={{
                    width: '100%',
                    height: '600px',
                    border: 'none',
                  }}
                  title="PDF Preview"
                />
              </Box>
            ) : generatingPreview ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Generating PDF preview...
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PictureAsPdf sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Click "Refresh Preview" to generate PDF preview
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={generatePreview}
                    sx={{ mt: 2 }}
                  >
                    Generate Preview
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
}

// Convert visual pages to config format, preserving existing config
export function convertVisualPagesToConfig(pages: VisualPage[], existingConfig?: any): any {
  // Start with existing config or defaults
  const config: any = existingConfig ? {
    ...existingConfig,
    // Ensure these exist
    introPage: {
      enabled: false,
      showPlanTitle: false,
      showWorkspaceName: false,
      showClientName: false,
      backgroundColor: '#ffffff',
      ...existingConfig.introPage,
    },
    endPage: {
      enabled: false,
      showThankYouMessage: false,
      showContactInfo: false,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      ...existingConfig.endPage,
    },
    customPages: existingConfig.customPages || [],
    dayPages: {
      layout: 'vertical',
      daysPerPage: 1,
      mealsPerPage: 3,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontSize: {
        dayTitle: 18,
        exerciseName: 14,
        details: 12,
      },
      options: {
        showMealNames: true,
        showFoodItems: true,
        showQuantities: true,
        showMacros: true,
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFat: true,
        showMealTotalCalories: true,
        showMealNotes: true,
        mealSpacing: 20,
        foodItemSpacing: 8,
        mealNameSpacing: 10,
        mealNotesSpacing: 10,
        foodItemsLayout: 'vertical',
        contentPaddingTop: 20,
      },
      ...existingConfig.dayPages,
      // Preserve options from existing config
      options: {
        ...(existingConfig.dayPages?.options || {}),
        showMealNames: existingConfig.dayPages?.options?.showMealNames ?? true,
        showFoodItems: existingConfig.dayPages?.options?.showFoodItems ?? true,
        showQuantities: existingConfig.dayPages?.options?.showQuantities ?? true,
        showMacros: existingConfig.dayPages?.options?.showMacros ?? true,
        showCalories: existingConfig.dayPages?.options?.showCalories ?? true,
        showProtein: existingConfig.dayPages?.options?.showProtein ?? true,
        showCarbs: existingConfig.dayPages?.options?.showCarbs ?? true,
        showFat: existingConfig.dayPages?.options?.showFat ?? true,
        showMealTotalCalories: existingConfig.dayPages?.options?.showMealTotalCalories ?? true,
        showMealNotes: existingConfig.dayPages?.options?.showMealNotes ?? true,
        mealSpacing: existingConfig.dayPages?.options?.mealSpacing ?? 20,
        foodItemSpacing: existingConfig.dayPages?.options?.foodItemSpacing ?? 8,
        mealNameSpacing: existingConfig.dayPages?.options?.mealNameSpacing ?? 10,
        mealNotesSpacing: existingConfig.dayPages?.options?.mealNotesSpacing ?? 10,
        foodItemsLayout: existingConfig.dayPages?.options?.foodItemsLayout ?? 'vertical',
        contentPaddingTop: existingConfig.dayPages?.options?.contentPaddingTop ?? 20,
      },
    },
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      fontFamily: 'Alexandria',
      primaryColor: '#000000',
      secondaryColor: '#333333',
      textDirection: 'ltr',
      textAlignment: 'left',
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      ...existingConfig.options,
    },
  } : {
    introPage: {
      enabled: false,
      showPlanTitle: false,
      showWorkspaceName: false,
      showClientName: false,
      backgroundColor: '#ffffff',
    },
    endPage: {
      enabled: false,
      showThankYouMessage: false,
      showContactInfo: false,
      backgroundColor: '#ffffff',
      textColor: '#000000',
    },
    customPages: [],
    dayPages: {
      layout: 'vertical',
      daysPerPage: 1,
      mealsPerPage: 3,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontSize: {
        dayTitle: 18,
        exerciseName: 14,
        details: 12,
      },
      options: {
        showMealNames: true,
        showFoodItems: true,
        showQuantities: true,
        showMacros: true,
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFat: true,
        showMealTotalCalories: true,
        showMealNotes: true,
        mealSpacing: 20,
        foodItemSpacing: 8,
        mealNameSpacing: 10,
        mealNotesSpacing: 10,
        foodItemsLayout: 'vertical',
        contentPaddingTop: 20,
      },
    },
    options: {
      pageSize: 'A4',
      orientation: 'portrait',
      fontFamily: 'Alexandria',
      primaryColor: '#000000',
      secondaryColor: '#333333',
      textDirection: 'ltr',
      textAlignment: 'left',
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    },
  };

  // Store visual pages
  config.visualPages = pages;

  // Process pages and update config
  pages.forEach((page) => {
    if (page.type === 'intro') {
      config.introPage.enabled = true;
      if (page.backgroundImage) {
        config.introPage.backgroundImage = page.backgroundImage;
      }
    } else if (page.type === 'end') {
      config.endPage.enabled = true;
      if (page.backgroundImage) {
        config.endPage.backgroundImage = page.backgroundImage;
      }
    } else if (page.type === 'content') {
      // Content page - update dayPages background image and ensure it's enabled
      if (page.backgroundImage) {
        config.dayPages.backgroundImage = page.backgroundImage;
      }
      // dayPages is always enabled for content pages
    } else if (page.type === 'custom') {
      // Check if custom page already exists
      const existingCustomPage = config.customPages.find((cp: any) => cp.id === page.id);
      if (existingCustomPage) {
        // Update existing custom page
        existingCustomPage.enabled = true;
        if (page.backgroundImage) {
          existingCustomPage.backgroundImage = page.backgroundImage;
        }
      } else {
        // Add new custom page
        config.customPages.push({
          id: page.id,
          type: 'custom',
          title: `Custom Page ${page.order}`,
          enabled: true,
          position: page.order === 0 ? 'beforeContent' : 'afterContent',
          order: page.order,
          backgroundImage: page.backgroundImage,
          backgroundColor: '#ffffff',
          config: {
            content: '',
            allowImages: true,
            allowLinks: false,
          },
        });
      }
    }
  });

  // Sort custom pages by order
  config.customPages.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  return config;
}

// General Settings Panel Component
function GeneralSettingsPanel({ config, onConfigChange }: { config?: any; onConfigChange: (config: any) => void }) {
  if (!config) return <Typography>No config available</Typography>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Page Settings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Page Size</InputLabel>
              <Select
                value={config.options?.pageSize || 'A4'}
                label="Page Size"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      pageSize: e.target.value,
                    },
                  })
                }
              >
                <MenuItem value="A4">A4 (210 × 297mm)</MenuItem>
                <MenuItem value="Letter">Letter (8.5 × 11in)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Orientation</InputLabel>
              <Select
                value={config.options?.orientation || 'portrait'}
                label="Orientation"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      orientation: e.target.value,
                    },
                  })
                }
              >
                <MenuItem value="portrait">Portrait</MenuItem>
                <MenuItem value="landscape">Landscape</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Font Family</InputLabel>
              <Select
                value={config.options?.fontFamily || 'Alexandria'}
                label="Font Family"
                onChange={(e) =>
                  onConfigChange({
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
            </FormControl>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Text Direction & Alignment
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Text Direction</InputLabel>
              <Select
                value={config.options?.textDirection || 'ltr'}
                label="Text Direction"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      textDirection: e.target.value,
                    },
                  })
                }
              >
                <MenuItem value="ltr">Left-to-Right (LTR)</MenuItem>
                <MenuItem value="rtl">Right-to-Left (RTL)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Text Alignment</InputLabel>
              <Select
                value={config.options?.textAlignment || 'left'}
                label="Text Alignment"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      textAlignment: e.target.value,
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
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Margins
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Top"
              type="number"
              size="small"
              value={config.options?.margins?.top || 50}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    margins: {
                      ...config.options?.margins,
                      top: parseInt(e.target.value) || 0,
                    },
                  },
                })
              }
            />
            <TextField
              label="Bottom"
              type="number"
              size="small"
              value={config.options?.margins?.bottom || 50}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    margins: {
                      ...config.options?.margins,
                      bottom: parseInt(e.target.value) || 0,
                    },
                  },
                })
              }
            />
            <TextField
              label="Left"
              type="number"
              size="small"
              value={config.options?.margins?.left || 50}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    margins: {
                      ...config.options?.margins,
                      left: parseInt(e.target.value) || 0,
                    },
                  },
                })
              }
            />
            <TextField
              label="Right"
              type="number"
              size="small"
              value={config.options?.margins?.right || 50}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    margins: {
                      ...config.options?.margins,
                      right: parseInt(e.target.value) || 0,
                    },
                  },
                })
              }
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Typography
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Line Height"
              type="number"
              size="small"
              value={config.options?.typography?.lineHeight || 1.5}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    typography: {
                      ...config.options?.typography,
                      lineHeight: parseFloat(e.target.value) || 1.5,
                    },
                  },
                })
              }
              inputProps={{ min: 0.5, max: 3, step: 0.1 }}
            />
            <TextField
              label="Letter Spacing (pt)"
              type="number"
              size="small"
              value={config.options?.typography?.letterSpacing || 0}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    typography: {
                      ...config.options?.typography,
                      letterSpacing: parseFloat(e.target.value) || 0,
                    },
                  },
                })
              }
            />
            <TextField
              label="Word Spacing (pt)"
              type="number"
              size="small"
              value={config.options?.typography?.wordSpacing || 0}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    typography: {
                      ...config.options?.typography,
                      wordSpacing: parseFloat(e.target.value) || 0,
                    },
                  },
                })
              }
            />
            <Divider />
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.options?.typography?.textShadow?.enabled || false}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow,
                            enabled: e.target.checked,
                            offsetX: config.options?.typography?.textShadow?.offsetX || 2,
                            offsetY: config.options?.typography?.textShadow?.offsetY || 2,
                            blur: config.options?.typography?.textShadow?.blur || 3,
                            color: config.options?.typography?.textShadow?.color || '#000000',
                            opacity: config.options?.typography?.textShadow?.opacity ?? 0.5,
                          },
                        },
                      },
                    })
                  }
                />
              }
              label="Enable Text Shadow"
            />
            {config.options?.typography?.textShadow?.enabled && (
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Shadow Offset X (pt)"
                  type="number"
                  size="small"
                  value={config.options?.typography?.textShadow?.offsetX || 2}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow!,
                            offsetX: parseFloat(e.target.value) || 0,
                          },
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Shadow Offset Y (pt)"
                  type="number"
                  size="small"
                  value={config.options?.typography?.textShadow?.offsetY || 2}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow!,
                            offsetY: parseFloat(e.target.value) || 0,
                          },
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Shadow Blur (pt)"
                  type="number"
                  size="small"
                  value={config.options?.typography?.textShadow?.blur || 3}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow!,
                            blur: parseFloat(e.target.value) || 0,
                          },
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Shadow Color"
                  type="color"
                  size="small"
                  value={config.options?.typography?.textShadow?.color || '#000000'}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow!,
                            color: e.target.value,
                          },
                        },
                      },
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Shadow Opacity (%)"
                  type="number"
                  size="small"
                  value={(config.options?.typography?.textShadow?.opacity ?? 0.5) * 100}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        typography: {
                          ...config.options?.typography,
                          textShadow: {
                            ...config.options?.typography?.textShadow!,
                            opacity: (parseFloat(e.target.value) || 50) / 100,
                          },
                        },
                      },
                    })
                  }
                  inputProps={{ min: 0, max: 100, step: 5 }}
                />
              </Box>
            )}
            <Divider />
            <FormControl fullWidth size="small">
              <InputLabel>Normal Text Weight</InputLabel>
              <Select
                value={config.options?.typography?.fontWeights?.normal || 'regular'}
                label="Normal Text Weight"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      typography: {
                        ...config.options?.typography,
                        fontWeights: {
                          ...config.options?.typography?.fontWeights,
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
            <FormControl fullWidth size="small">
              <InputLabel>Bold Text Weight</InputLabel>
              <Select
                value={config.options?.typography?.fontWeights?.bold || 'bold'}
                label="Bold Text Weight"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    options: {
                      ...config.options,
                      typography: {
                        ...config.options?.typography,
                        fontWeights: {
                          ...config.options?.typography?.fontWeights,
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
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Color Scheme
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Primary Color"
              type="color"
              size="small"
              value={config.options?.primaryColor || '#3366cc'}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    primaryColor: e.target.value,
                  },
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Secondary Color"
              type="color"
              size="small"
              value={config.options?.secondaryColor || '#333333'}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  options: {
                    ...config.options,
                    secondaryColor: e.target.value,
                  },
                })
              }
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Logo Settings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.options?.logo?.enabled || false}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        logo: {
                          ...config.options?.logo,
                          enabled: e.target.checked,
                          position: config.options?.logo?.position || 'top-left',
                          size: config.options?.logo?.size || 'medium',
                          opacity: config.options?.logo?.opacity ?? 1,
                          margin: config.options?.logo?.margin || 20,
                        },
                      },
                    })
                  }
                />
              }
              label="Enable Logo on All Pages"
            />
            {config.options?.logo?.enabled && (
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Logo URL"
                  size="small"
                  value={config.options?.logo?.url || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        logo: {
                          ...config.options?.logo!,
                          url: e.target.value,
                        },
                      },
                    })
                  }
                  fullWidth
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={config.options?.logo?.position || 'top-left'}
                    label="Position"
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        options: {
                          ...config.options,
                          logo: {
                            ...config.options?.logo!,
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
                <FormControl fullWidth size="small">
                  <InputLabel>Size</InputLabel>
                  <Select
                    value={config.options?.logo?.size || 'medium'}
                    label="Size"
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        options: {
                          ...config.options,
                          logo: {
                            ...config.options?.logo!,
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
                {config.options?.logo?.size === 'custom' && (
                  <>
                    <TextField
                      label="Width (points)"
                      type="number"
                      size="small"
                      value={config.options?.logo?.customWidth || 100}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          options: {
                            ...config.options,
                            logo: {
                              ...config.options?.logo!,
                              customWidth: parseInt(e.target.value) || 100,
                            },
                          },
                        })
                      }
                    />
                    <TextField
                      label="Height (points)"
                      type="number"
                      size="small"
                      value={config.options?.logo?.customHeight || 100}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          options: {
                            ...config.options,
                            logo: {
                              ...config.options?.logo!,
                              customHeight: parseInt(e.target.value) || 100,
                            },
                          },
                        })
                      }
                    />
                  </>
                )}
                <TextField
                  label="Opacity"
                  type="number"
                  size="small"
                  value={config.options?.logo?.opacity ?? 1}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        logo: {
                          ...config.options?.logo!,
                          opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 1)),
                        },
                      },
                    })
                  }
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                />
                <TextField
                  label="Margin (points)"
                  type="number"
                  size="small"
                  value={config.options?.logo?.margin || 20}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        logo: {
                          ...config.options?.logo!,
                          margin: parseInt(e.target.value) || 20,
                        },
                      },
                    })
                  }
                />
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Watermark Settings
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.options?.watermark?.enabled || false}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark,
                          enabled: e.target.checked,
                          text: config.options?.watermark?.text || '',
                          opacity: config.options?.watermark?.opacity ?? 0.1,
                          fontSize: config.options?.watermark?.fontSize || 48,
                          color: config.options?.watermark?.color || '#000000',
                          angle: config.options?.watermark?.angle || -45,
                          position: config.options?.watermark?.position || 'diagonal',
                        },
                      },
                    })
                  }
                />
              }
              label="Enable Watermark"
            />
            {config.options?.watermark?.enabled && (
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Watermark Text"
                  size="small"
                  value={config.options?.watermark?.text || ''}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark!,
                          text: e.target.value,
                        },
                      },
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="Font Size"
                  type="number"
                  size="small"
                  value={config.options?.watermark?.fontSize || 48}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark!,
                          fontSize: parseInt(e.target.value) || 48,
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Color"
                  type="color"
                  size="small"
                  value={config.options?.watermark?.color || '#000000'}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark!,
                          color: e.target.value,
                        },
                      },
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Opacity"
                  type="number"
                  size="small"
                  value={(config.options?.watermark?.opacity ?? 0.1) * 100}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark!,
                          opacity: (parseFloat(e.target.value) || 10) / 100,
                        },
                      },
                    })
                  }
                  inputProps={{ min: 0, max: 100, step: 5 }}
                />
                <TextField
                  label="Angle (degrees)"
                  type="number"
                  size="small"
                  value={config.options?.watermark?.angle || -45}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        watermark: {
                          ...config.options?.watermark!,
                          angle: parseInt(e.target.value) || -45,
                        },
                      },
                    })
                  }
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={config.options?.watermark?.position || 'diagonal'}
                    label="Position"
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        options: {
                          ...config.options,
                          watermark: {
                            ...config.options?.watermark!,
                            position: e.target.value as any,
                          },
                        },
                      })
                    }
                  >
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="diagonal">Diagonal</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Page Numbering
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.options?.pageNumbering?.enabled || false}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        pageNumbering: {
                          ...config.options?.pageNumbering,
                          enabled: e.target.checked,
                          position: config.options?.pageNumbering?.position || 'bottom-center',
                          format: config.options?.pageNumbering?.format || 'Page {page} of {total}',
                          startFrom: config.options?.pageNumbering?.startFrom || 1,
                          excludeFirstPage: config.options?.pageNumbering?.excludeFirstPage || false,
                        },
                      },
                    })
                  }
                />
              }
              label="Enable Page Numbering"
            />
            {config.options?.pageNumbering?.enabled && (
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={config.options?.pageNumbering?.position || 'bottom-center'}
                    label="Position"
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        options: {
                          ...config.options,
                          pageNumbering: {
                            ...config.options?.pageNumbering!,
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
                <TextField
                  label="Format"
                  size="small"
                  value={config.options?.pageNumbering?.format || 'Page {page} of {total}'}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        pageNumbering: {
                          ...config.options?.pageNumbering!,
                          format: e.target.value,
                        },
                      },
                    })
                  }
                  helperText="Use {page} for current page, {total} for total pages"
                  fullWidth
                />
                <TextField
                  label="Start From"
                  type="number"
                  size="small"
                  value={config.options?.pageNumbering?.startFrom || 1}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      options: {
                        ...config.options,
                        pageNumbering: {
                          ...config.options?.pageNumbering!,
                          startFrom: parseInt(e.target.value) || 1,
                        },
                      },
                    })
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.options?.pageNumbering?.excludeFirstPage || false}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          options: {
                            ...config.options,
                            pageNumbering: {
                              ...config.options?.pageNumbering!,
                              excludeFirstPage: e.target.checked,
                            },
                          },
                        })
                      }
                    />
                  }
                  label="Exclude First Page"
                />
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// Content Page Settings Panel Component
function ContentPageSettingsPanel({ config, onConfigChange, kind }: { config?: any; onConfigChange: (config: any) => void; kind: 'workout' | 'nutrition' }) {
  if (!config?.dayPages) return <Typography>No content page config available</Typography>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Layout
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Layout</InputLabel>
              <Select
                value={config.dayPages.layout || 'vertical'}
                label="Layout"
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    dayPages: {
                      ...config.dayPages,
                      layout: e.target.value,
                    },
                  })
                }
              >
                <MenuItem value="vertical">Vertical</MenuItem>
                <MenuItem value="horizontal">Horizontal</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Days Per Page"
              type="number"
              size="small"
              value={config.dayPages.daysPerPage || 1}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  dayPages: {
                    ...config.dayPages,
                    daysPerPage: parseInt(e.target.value) || 1,
                  },
                })
              }
            />
            {kind === 'nutrition' && (
              <TextField
                label="Meals Per Page"
                type="number"
                size="small"
                value={config.dayPages.mealsPerPage || 3}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    dayPages: {
                      ...config.dayPages,
                      mealsPerPage: parseInt(e.target.value) || 3,
                    },
                  })
                }
              />
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Colors & Styling
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Background Color"
              type="color"
              size="small"
              value={config.dayPages.backgroundColor || '#ffffff'}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  dayPages: {
                    ...config.dayPages,
                    backgroundColor: e.target.value,
                  },
                })
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Text Color"
              type="color"
              size="small"
              value={config.dayPages.textColor || '#000000'}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  dayPages: {
                    ...config.dayPages,
                    textColor: e.target.value,
                  },
                })
              }
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {kind === 'nutrition' && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Nutrition Options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.dayPages.options?.showMealNames !== false}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          options: {
                            ...config.dayPages.options,
                            showMealNames: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Show Meal Names"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.dayPages.options?.showFoodItems !== false}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          options: {
                            ...config.dayPages.options,
                            showFoodItems: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Show Food Items"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.dayPages.options?.showQuantities !== false}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          options: {
                            ...config.dayPages.options,
                            showQuantities: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Show Quantities"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.dayPages.options?.showMacros !== false}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          options: {
                            ...config.dayPages.options,
                            showMacros: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Show Macros"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.dayPages.options?.showCalories !== false}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        dayPages: {
                          ...config.dayPages,
                          options: {
                            ...config.dayPages.options,
                            showCalories: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
                label="Show Calories"
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Spacing
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {kind === 'nutrition' && (
              <>
                <TextField
                  label="Meal Spacing"
                  type="number"
                  size="small"
                  value={config.dayPages.options?.mealSpacing || 20}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      dayPages: {
                        ...config.dayPages,
                        options: {
                          ...config.dayPages.options,
                          mealSpacing: parseInt(e.target.value) || 20,
                        },
                      },
                    })
                  }
                />
                <TextField
                  label="Food Item Spacing"
                  type="number"
                  size="small"
                  value={config.dayPages.options?.foodItemSpacing || 8}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      dayPages: {
                        ...config.dayPages,
                        options: {
                          ...config.dayPages.options,
                          foodItemSpacing: parseInt(e.target.value) || 8,
                        },
                      },
                    })
                  }
                />
              </>
            )}
            <TextField
              label="Content Padding Top"
              type="number"
              size="small"
              value={config.dayPages.options?.contentPaddingTop || 20}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  dayPages: {
                    ...config.dayPages,
                    options: {
                      ...config.dayPages.options,
                      contentPaddingTop: parseInt(e.target.value) || 20,
                    },
                  },
                })
              }
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

