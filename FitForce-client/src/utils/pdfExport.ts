import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generatePdfFromTemplate } from '@/api/pdf-templates';
import api from '@/utils/axios';

interface NutritionPlanData {
  workspaceName: string;
  clientName: string;
  planName: string;
  cycles: Array<{
    id: string;
    title: string;
    label: string;
    microTotals?: Record<string, number>;
    meals: Array<{
      id: string;
      meal: string;
      notes?: string;
      recipeName?: string;
      recipeNameArabic?: string;
      recipeImageUrl?: string;
      foodItems: Array<{
        id: string;
        quantity: number;
        foodItem: {
          id: string;
          name: string;
          servingSize: number;
          unit: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
        };
      }>;
    }>;
  }>;
}

interface WorkoutPlanData {
  workspaceName: string;
  clientName: string;
  planName: string;
  days: Array<{
    id: string;
    title: string;
    exercises: Array<{
      id: string;
      exercise: {
        id: string;
        name: string;
        muscleGroup: string;
        description?: string;
        gifImage?: string;
      };
      sets: number;
      reps: string;
      restSeconds: number;
      tempo: string;
      rir: number;
      notes?: string;
      individualSets?: Array<{
        id: string;
        reps: string;
        restSeconds: number;
        tempo: string;
        rir: number;
        notes?: string;
      }>;
    }>;
  }>;
}

// Helper to convert image to canvas (handles GIFs and other formats)
function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0);
  }
  return canvas;
}

// Helper to add image to PDF (with timeout and error handling)
async function addImageToPdf(
  doc: jsPDF,
  imageUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
  timeout: number = 3000
): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`Image load timeout: ${imageUrl}`);
      resolve(); // Continue without image
    }, timeout);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        clearTimeout(timeoutId);
        try {
          // Convert to canvas first (handles GIFs better)
          const canvas = imageToCanvas(img);
          
          // Calculate aspect ratio to maintain proportions
          const aspectRatio = img.width / img.height;
          let pdfWidth = width;
          let pdfHeight = width / aspectRatio;
          
          if (pdfHeight > height) {
            pdfHeight = height;
            pdfWidth = height * aspectRatio;
          }
          
          // Convert canvas to data URL and add to PDF
          const imgData = canvas.toDataURL('image/png', 0.8); // Use PNG format, 80% quality
          doc.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
          resolve();
        } catch (e) {
          console.warn('Failed to add image to PDF:', e);
          resolve();
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('Failed to load image:', imageUrl);
        resolve();
      };
      
      img.src = imageUrl;
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn('Error adding image:', e);
      resolve();
    }
  });
}

// Preload images in parallel with timeout and convert to canvas
async function preloadImages(imageUrls: string[], timeout: number = 5000): Promise<Map<string, HTMLCanvasElement>> {
  const imageMap = new Map<string, HTMLCanvasElement>();
  
  if (imageUrls.length === 0) return imageMap;
  
  const loadPromises = imageUrls.map((url) => {
    return new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`Image preload timeout: ${url}`);
        resolve();
      }, timeout);

      // Try loading without CORS first (most common case)
      const tryLoad = (useCors: boolean) => {
        const img = new Image();
        if (useCors) {
          img.crossOrigin = 'anonymous';
        }
        
        img.onload = () => {
          clearTimeout(timeoutId);
          try {
            // Convert to canvas immediately for better PDF compatibility
            const canvas = imageToCanvas(img);
            if (canvas.width > 0 && canvas.height > 0) {
              imageMap.set(url, canvas);
            } else {
              console.warn('Canvas has zero dimensions:', url);
            }
          } catch (e) {
            console.warn('Failed to convert image to canvas:', e, url);
          }
          resolve();
        };
        
        img.onerror = () => {
          if (!useCors) {
            // Already tried without CORS, give up
            console.warn('Failed to preload image:', url);
            resolve();
          } else {
            // Try without CORS
            tryLoad(false);
          }
        };
        
        img.src = url;
      };
      
      // Start with CORS
      try {
        tryLoad(true);
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn('Error preloading image:', e, url);
        resolve();
      }
    });
  });

  await Promise.all(loadPromises);
  return imageMap;
}

// Helper to safely open a PDF URL in a new tab, reusing a pending window if provided.
// This avoids popup blockers by ensuring the tab is created synchronously on click,
// and later navigated once the URL is ready.
function openPdfInNewTab(pdfUrl: string, pendingWindow?: Window | null) {
  try {
    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.location.href = pdfUrl;
      return;
    }

    const popup = window.open(pdfUrl, '_blank');
    if (!popup) {
      // Popup blocked – at least log the URL so it can be recovered from console if needed
      console.warn('Popup blocked while opening PDF. URL:', pdfUrl);
    }
  } catch (e) {
    console.warn('Failed to open PDF in new tab:', e, pdfUrl);
  }
}

// Helper to calculate meal totals
function calculateMealTotals(meal: NutritionPlanData['cycles'][0]['meals'][0]) {
  return meal.foodItems.reduce(
    (acc, item) => {
      const qty = Number(item.quantity) || 0;
      const base = item.foodItem?.servingSize || 100;
      const factor = base ? qty / base : 0;
      acc.calories += Math.round((item.foodItem?.calories || 0) * factor);
      acc.protein += Math.round((item.foodItem?.protein || 0) * factor);
      acc.carbs += Math.round((item.foodItem?.carbs || 0) * factor);
      acc.fat += Math.round((item.foodItem?.fat || 0) * factor);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export async function exportNutritionPlanToPDF(
  data: NutritionPlanData,
  planId?: string,
  pendingWindow?: Window | null
): Promise<void> {
  // Try template-based generation first if planId is provided
  if (planId) {
    try {
      const { pdfUrl } = await generatePdfFromTemplate(planId, 'nutrition');
      // Open PDF in new tab (or reuse pending window)
      openPdfInNewTab(pdfUrl, pendingWindow);
      return;
    } catch (error: any) {
      // If template generation fails (no template assigned), fall back to client-side generation
      console.log('Template-based generation not available, using client-side generation:', error.message);
      // Continue to fallback - don't throw, just use client-side generation
    }
  }

  // If we had opened a pending window for server-side generation,
  // close it before falling back to client-side download to avoid a blank tab.
  if (pendingWindow && !pendingWindow.closed) {
    try {
      pendingWindow.close();
    } catch (e) {
      console.warn('Failed to close pending nutrition PDF window:', e);
    }
  }
  
  // Fall back to client-side PDF generation
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Cover Page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.workspaceName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Nutrition Plan', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;

  doc.setFontSize(14);
  doc.text(`Client: ${data.clientName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text(`Plan: ${data.planName}`, pageWidth / 2, yPos, { align: 'center' });

  // Add new page for cycles
  doc.addPage();

  // Process each cycle
  for (let cycleIndex = 0; cycleIndex < data.cycles.length; cycleIndex++) {
    const cycle = data.cycles[cycleIndex];
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin;
    }

    // Cycle Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Cycle ${cycleIndex + 1}: ${cycle.label || cycle.title || `Day ${cycleIndex + 1}`}`,
      margin,
      yPos
    );
    yPos += 15;

    // Macros and Micros Section
    if (cycle.microTotals) {
      const macros = {
        calories: Math.round(cycle.microTotals.calories || 0),
        protein: Math.round(cycle.microTotals.protein || 0),
        carbs: Math.round(cycle.microTotals.carbs || 0),
        fat: Math.round(cycle.microTotals.fat || 0),
      };

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Macronutrients:', margin, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.text(`Calories: ${macros.calories} kcal`, margin + 10, yPos);
      yPos += 6;
      doc.text(`Protein: ${macros.protein} g (${Math.round(macros.protein * 4)} kcal)`, margin + 10, yPos);
      yPos += 6;
      doc.text(`Carbs: ${macros.carbs} g (${Math.round(macros.carbs * 4)} kcal)`, margin + 10, yPos);
      yPos += 6;
      doc.text(`Fat: ${macros.fat} g (${Math.round(macros.fat * 9)} kcal)`, margin + 10, yPos);
      yPos += 10;

      // Micronutrients
      const microKeys = Object.keys(cycle.microTotals).filter(
        (key) => !['calories', 'protein', 'carbs', 'fat'].includes(key)
      );

      if (microKeys.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Micronutrients:', margin, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const microsPerColumn = Math.ceil(microKeys.length / 2);
        let col1Y = yPos;
        let col2Y = yPos;

        microKeys.forEach((key, idx) => {
          const value = Math.round(cycle.microTotals![key] || 0);
          const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          
          if (idx < microsPerColumn) {
            doc.text(`${displayKey}: ${value}`, margin + 10, col1Y);
            col1Y += 5;
          } else {
            doc.text(`${displayKey}: ${value}`, pageWidth / 2 + 10, col2Y);
            col2Y += 5;
          }
        });

        yPos = Math.max(col1Y, col2Y) + 10;
      }
    }

    yPos += 5;

    // Meals Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Meals:', margin, yPos);
    yPos += 10;

    for (const meal of cycle.meals) {
      // Check if we need a new page
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(meal.meal, margin, yPos);
      yPos += 7;

      if (meal.recipeName || meal.recipeNameArabic) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.text(
          `Recipe: ${meal.recipeName || meal.recipeNameArabic || ''}`,
          margin + 5,
          yPos
        );
        yPos += 6;
      }

      if (meal.recipeImageUrl) {
        try {
          await addImageToPdf(doc, meal.recipeImageUrl, margin, yPos, 60, 40, 2000);
          yPos += 45;
        } catch (e) {
          console.warn('Failed to add recipe image:', e);
        }
      }

      // Meal totals
      const mealTotals = calculateMealTotals(meal);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        `Totals: ${mealTotals.calories} kcal | P: ${mealTotals.protein}g | C: ${mealTotals.carbs}g | F: ${mealTotals.fat}g`,
        margin + 5,
        yPos
      );
      yPos += 8;

      // Food items table
      if (meal.foodItems.length > 0) {
        const tableData = meal.foodItems.map((item) => {
          const qty = Number(item.quantity) || 0;
          const base = item.foodItem?.servingSize || 100;
          const factor = base ? qty / base : 0;
          return [
            item.foodItem?.name || 'Unknown',
            `${qty} ${item.foodItem?.unit || 'g'}`,
            `${Math.round((item.foodItem?.calories || 0) * factor)}`,
            `${Math.round((item.foodItem?.protein || 0) * factor)}g`,
            `${Math.round((item.foodItem?.carbs || 0) * factor)}g`,
            `${Math.round((item.foodItem?.fat || 0) * factor)}g`,
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Food Item', 'Quantity', 'Calories', 'Protein', 'Carbs', 'Fat']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [66, 165, 245], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (meal.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(`Notes: ${meal.notes}`, margin + 5, yPos);
        yPos += 8;
      }

      yPos += 5;
    }

    // Add spacing before next cycle
    yPos += 10;
  }

  // Save PDF
  doc.save(`${data.planName}_Nutrition_Plan.pdf`);
}

export async function exportWorkoutPlanToPDF(
  data: WorkoutPlanData,
  onProgress?: (message: string) => void,
  planId?: string,
  pendingWindow?: Window | null
): Promise<void> {
  // Try template-based generation first if planId is provided
  if (planId) {
    try {
      const { pdfUrl } = await generatePdfFromTemplate(planId, 'workout');
      // Open PDF in new tab (or reuse pending window)
      openPdfInNewTab(pdfUrl, pendingWindow);
      return;
    } catch (error: any) {
      // If template generation fails (no template assigned), fall back to client-side generation
      console.log('Template-based generation not available, using client-side generation:', error.message);
      // Continue to fallback - don't throw, just use client-side generation
    }
  }

  // If we had opened a pending window for server-side generation,
  // close it before falling back to client-side download to avoid a blank tab.
  if (pendingWindow && !pendingWindow.closed) {
    try {
      pendingWindow.close();
    } catch (e) {
      console.warn('Failed to close pending workout PDF window:', e);
    }
  }
  
  // Fall back to client-side PDF generation
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Collect all GIF URLs first
  const gifUrls: string[] = [];
  data.days.forEach(day => {
    day.exercises.forEach(ex => {
      if (ex.exercise.gifImage) {
        gifUrls.push(ex.exercise.gifImage);
      }
    });
  });

  // Preload all images in parallel (with shorter timeout for GIFs)
  if (onProgress) onProgress(`Preloading ${gifUrls.length} exercise images...`);
  console.log(`Preloading ${gifUrls.length} exercise images...`);
  const imageMap = await preloadImages(gifUrls, 3000); // 3 second timeout - skip slow images
  console.log(`Successfully preloaded ${imageMap.size} out of ${gifUrls.length} images`);
  if (onProgress) onProgress(`Loaded ${imageMap.size}/${gifUrls.length} images. Generating PDF...`);

  // Cover Page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.workspaceName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.text('Workout Plan', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;

  doc.setFontSize(14);
  doc.text(`Client: ${data.clientName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text(`Plan: ${data.planName}`, pageWidth / 2, yPos, { align: 'center' });

  // Add new page for days
  doc.addPage();

  // Process each day
  for (let dayIndex = 0; dayIndex < data.days.length; dayIndex++) {
    const day = data.days[dayIndex];
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin;
    }

    // Day Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Day ${dayIndex + 1}: ${day.title}`, margin, yPos);
    yPos += 15;

    // Exercises
    for (const exerciseItem of day.exercises) {
      // Check if we need a new page
      if (yPos > pageHeight - 120) {
        doc.addPage();
        yPos = margin;
      }

      const exercise = exerciseItem.exercise;

      // Exercise name
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(exercise.name, margin, yPos);
      yPos += 8;

      // Muscle group
      if (exercise.muscleGroup) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Muscle Group: ${exercise.muscleGroup}`, margin + 5, yPos);
        yPos += 6;
      }

      // Exercise GIF - use preloaded image if available
      if (exercise.gifImage) {
        const preloadedCanvas = imageMap.get(exercise.gifImage);
        if (preloadedCanvas && preloadedCanvas.width > 0 && preloadedCanvas.height > 0) {
          try {
            // Calculate aspect ratio
            const aspectRatio = preloadedCanvas.width / preloadedCanvas.height;
            let pdfWidth = 80;
            let pdfHeight = 80 / aspectRatio;
            
            if (pdfHeight > 60) {
              pdfHeight = 60;
              pdfWidth = 60 * aspectRatio;
            }
            
            // Convert canvas to data URL with error handling
            let imgData: string;
            try {
              imgData = preloadedCanvas.toDataURL('image/png', 0.8);
              if (imgData && imgData.length > 100) { // Ensure we have actual image data
                doc.addImage(imgData, 'PNG', margin, yPos, pdfWidth, pdfHeight);
                yPos += Math.max(pdfHeight, 60) + 5;
              } else {
                console.warn('Invalid image data for:', exercise.gifImage);
                yPos += 5;
              }
            } catch (canvasError) {
              console.warn('Failed to convert canvas to data URL:', canvasError, exercise.gifImage);
              yPos += 5;
            }
          } catch (e) {
            console.warn('Failed to add preloaded exercise GIF:', e, exercise.gifImage);
            yPos += 5;
          }
        } else {
          // Image not preloaded or invalid - skip it to save time
          console.warn('Skipping image (not preloaded or invalid):', exercise.gifImage);
          yPos += 5;
        }
      }

      // Exercise details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      // Check if we have individual sets
      if (exerciseItem.individualSets && exerciseItem.individualSets.length > 0) {
        // Table for individual sets
        const tableData = exerciseItem.individualSets.map((set, idx) => [
          `Set ${idx + 1}`,
          set.reps || exerciseItem.reps,
          set.tempo || exerciseItem.tempo || '-',
          `${set.rir !== undefined ? set.rir : exerciseItem.rir}`,
          `${set.restSeconds || exerciseItem.restSeconds}s`,
          set.notes || exerciseItem.notes || '-',
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Set', 'Reps', 'Tempo', 'RIR', 'Rest', 'Notes']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [66, 165, 245], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      } else {
        // Simple format for exercises without individual sets
        doc.text(`Sets: ${exerciseItem.sets}`, margin + 5, yPos);
        yPos += 6;
        doc.text(`Reps: ${exerciseItem.reps}`, margin + 5, yPos);
        yPos += 6;
        if (exerciseItem.tempo) {
          doc.text(`Tempo: ${exerciseItem.tempo}`, margin + 5, yPos);
          yPos += 6;
        }
        doc.text(`RIR: ${exerciseItem.rir}`, margin + 5, yPos);
        yPos += 6;
        doc.text(`Rest: ${exerciseItem.restSeconds}s`, margin + 5, yPos);
        yPos += 6;
        if (exerciseItem.notes) {
          doc.text(`Notes: ${exerciseItem.notes}`, margin + 5, yPos);
          yPos += 6;
        }
      }

      // Description if available
      if (exercise.description) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        const splitDesc = doc.splitTextToSize(exercise.description, pageWidth - 2 * margin - 10);
        doc.text(splitDesc, margin + 5, yPos);
        yPos += splitDesc.length * 4 + 5;
      }

      yPos += 10;
    }

    // Add spacing before next day
    yPos += 10;
  }

  // Save PDF
  doc.save(`${data.planName}_Workout_Plan.pdf`);
}

