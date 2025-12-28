import api from '@/utils/axios';

export interface FoodItem {
  id: string;
  name: string;
  nameArabic?: string;
  category?: string;
  categoryArabic?: string;
  servingSize?: number;
  unit?: string;
  unitArabic?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dietaryRestrictions?: string[];
  allergens?: string[];
}

export interface FoodReplacement {
  id: string;
  replacement: FoodItem;
  priority: number;
  notes?: string;
  createdAt: string;
}

export interface FoodItemReplacementsResponse {
  foodItem: FoodItem;
  replacements: FoodReplacement[];
}

export interface ReplaceFoodRequest {
  mealId: string;
  originalFoodId: string;
  replacementFoodId: string;
  quantity?: number;
  autoMatchMacros?: boolean;
}

export interface ReplaceFoodResponse {
  mealFoodItem: {
    id: string;
    foodItem: FoodItem;
    quantity: number;
  };
  originalMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  newMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Get all replacements for a food item
 */
export async function getFoodItemReplacements(foodItemId: string, useClientEndpoint = false): Promise<FoodItemReplacementsResponse> {
  const endpoint = useClientEndpoint 
    ? `/api/nutrition/client/food-items/${foodItemId}/replacements`
    : `/api/nutrition/food-items/${foodItemId}/replacements`;
  const res = await api.get(endpoint);
  return res.data;
}

/**
 * Add a replacement for a food item
 */
export async function addFoodItemReplacement(
  foodItemId: string,
  data: { replacementId: string; priority?: number; notes?: string }
): Promise<{ replacement: FoodReplacement }> {
  const res = await api.post(`/api/nutrition/food-items/${foodItemId}/replacements`, data);
  return res.data;
}

/**
 * Update a food item replacement
 */
export async function updateFoodItemReplacement(
  foodItemId: string,
  replacementId: string,
  data: { priority?: number; notes?: string }
): Promise<{ replacement: FoodReplacement }> {
  const res = await api.put(`/api/nutrition/food-items/${foodItemId}/replacements/${replacementId}`, data);
  return res.data;
}

/**
 * Delete a food item replacement
 */
export async function deleteFoodItemReplacement(
  foodItemId: string,
  replacementId: string
): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/nutrition/food-items/${foodItemId}/replacements/${replacementId}`);
  return res.data;
}

/**
 * Replace food in a meal
 */
export async function replaceFoodInMeal(data: ReplaceFoodRequest, useClientEndpoint = false): Promise<ReplaceFoodResponse> {
  const endpoint = useClientEndpoint 
    ? '/api/nutrition/client/replace-food'
    : '/api/nutrition/replace-food';
  const res = await api.post(endpoint, data);
  return res.data;
}

export interface SmartSuggestion {
  foodItem: FoodItem;
  matchScore: number;
  macroDifference: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface SmartSuggestionsResponse {
  suggestions: SmartSuggestion[];
  originalFood: {
    id: string;
    name: string;
    macros: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
}

export interface CategoryAlternativesResponse {
  alternatives: FoodItem[];
  category: string;
}

/**
 * Get smart suggestions for a food item
 */
export async function getSmartSuggestions(
  foodItemId: string,
  options?: { 
    tolerance?: number; 
    limit?: number;
    dietaryRestrictions?: string[];
    excludeAllergens?: string[];
  }
): Promise<SmartSuggestionsResponse> {
  const params = new URLSearchParams();
  if (options?.tolerance) params.append('tolerance', options.tolerance.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
    params.append('dietaryRestrictions', options.dietaryRestrictions.join(','));
  }
  if (options?.excludeAllergens && options.excludeAllergens.length > 0) {
    params.append('excludeAllergens', options.excludeAllergens.join(','));
  }
  
  const query = params.toString();
  const url = `/api/nutrition/food-items/${foodItemId}/suggestions${query ? `?${query}` : ''}`;
  const res = await api.get(url);
  return res.data;
}

/**
 * Get category-based alternatives for a food item
 */
export async function getCategoryAlternatives(
  foodItemId: string,
  options?: {
    dietaryRestrictions?: string[];
    excludeAllergens?: string[];
  }
): Promise<CategoryAlternativesResponse> {
  const params = new URLSearchParams();
  if (options?.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
    params.append('dietaryRestrictions', options.dietaryRestrictions.join(','));
  }
  if (options?.excludeAllergens && options.excludeAllergens.length > 0) {
    params.append('excludeAllergens', options.excludeAllergens.join(','));
  }
  
  const query = params.toString();
  const url = `/api/nutrition/food-items/${foodItemId}/category-alternatives${query ? `?${query}` : ''}`;
  const res = await api.get(url);
  return res.data;
}

export interface ReplacementRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  originalFood: FoodItem;
  requestedFood?: FoodItem;
  approvedFood?: FoodItem;
  reason?: string;
  coachNotes?: string;
  createdAt: string;
  processedAt?: string;
  originalQuantity?: number | null;
  plan: {
    id: string;
    title: string;
  };
  client?: {
    id: string;
    fullName: string;
    email?: string;
  };
}

export interface CreateReplacementRequest {
  planId: string;
  mealId: string;
  originalFoodId: string;
  requestedFoodId?: string;
  reason?: string;
}

export interface ProcessReplacementRequest {
  status: 'approved' | 'rejected' | 'modified';
  approvedFoodId?: string;
  quantity?: number;
  notes?: string;
}

/**
 * Create a replacement request (client)
 */
export async function createReplacementRequest(data: CreateReplacementRequest): Promise<{ request: ReplacementRequest }> {
  const res = await api.post('/api/nutrition/replacements/request', data);
  return res.data;
}

/**
 * Get pending replacement requests (coach)
 */
export async function getPendingReplacementRequests(clientId?: string): Promise<{ requests: ReplacementRequest[] }> {
  const params = clientId ? { clientId } : {};
  const res = await api.get('/api/nutrition/replacements/pending', { params });
  return res.data;
}

/**
 * Get client's replacement requests
 */
export async function getClientReplacementRequests(status?: string): Promise<{ requests: ReplacementRequest[] }> {
  const params = status ? { status } : {};
  const res = await api.get('/api/nutrition/replacements/my-requests', { params });
  return res.data;
}

/**
 * Process a replacement request (coach)
 */
export async function processReplacementRequest(
  requestId: string,
  data: ProcessReplacementRequest
): Promise<{ request: ReplacementRequest }> {
  const res = await api.put(`/api/nutrition/replacements/${requestId}/process`, data);
  return res.data;
}

// ============================================================================
// Phase 4: Advanced Features
// ============================================================================

export interface BulkReplaceRequest {
  originalFoodId: string;
  replacementFoodId: string;
  planIds: string[];
  autoMatchMacros?: boolean;
  quantity?: number;
}

export interface BulkReplaceResult {
  planId: string;
  planTitle: string;
  replaced: number;
  failed: number;
}

export interface BulkReplaceResponse {
  success: boolean;
  results: BulkReplaceResult[];
  summary: {
    totalPlans: number;
    totalReplaced: number;
    totalFailed: number;
  };
}

/**
 * Bulk replace food items across multiple plans
 */
export async function bulkReplaceFood(data: BulkReplaceRequest): Promise<BulkReplaceResponse> {
  const res = await api.post('/api/nutrition/replacements/bulk', data);
  return res.data;
}

export interface ReplacementAnalytics {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalReplacements: number;
    typeDistribution: Array<{
      type: string;
      count: number;
    }>;
  };
  mostReplacedFoods: Array<{
    food: FoodItem | null;
    replacementCount: number;
  }>;
  popularReplacements: Array<{
    food: FoodItem | null;
    usageCount: number;
  }>;
  replacementPatterns: Array<{
    original: FoodItem | null;
    replacement: FoodItem | null;
    frequency: number;
  }>;
}

/**
 * Get replacement analytics and insights
 */
export async function getReplacementAnalytics(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<ReplacementAnalytics> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  
  const query = params.toString();
  const url = `/api/nutrition/replacements/analytics${query ? `?${query}` : ''}`;
  const res = await api.get(url);
  return res.data;
}

export interface ReplacementTemplateItem {
  foodItemId: string;
  replacementId: string;
  priority: number;
  notes?: string;
}

export interface ReplacementTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  items: ReplacementTemplateItem[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateReplacementTemplateRequest {
  name: string;
  description?: string;
  items: ReplacementTemplateItem[];
  isDefault?: boolean;
}

export interface UpdateReplacementTemplateRequest {
  name?: string;
  description?: string;
  items?: ReplacementTemplateItem[];
}

export interface ApplyTemplateRequest {
  planIds?: string[];
  autoMatchMacros?: boolean;
}

/**
 * Create a replacement template
 */
export async function createReplacementTemplate(
  data: CreateReplacementTemplateRequest
): Promise<{ template: ReplacementTemplate }> {
  const res = await api.post('/api/nutrition/replacement-templates', data);
  return res.data;
}

/**
 * List replacement templates
 */
export async function listReplacementTemplates(options?: {
  includeDefaults?: boolean;
}): Promise<{ templates: ReplacementTemplate[] }> {
  const params = new URLSearchParams();
  if (options?.includeDefaults) params.append('includeDefaults', 'true');
  
  const query = params.toString();
  const url = `/api/nutrition/replacement-templates${query ? `?${query}` : ''}`;
  const res = await api.get(url);
  return res.data;
}

/**
 * Get a replacement template
 */
export async function getReplacementTemplate(templateId: string): Promise<{ template: ReplacementTemplate }> {
  const res = await api.get(`/api/nutrition/replacement-templates/${templateId}`);
  return res.data;
}

/**
 * Update a replacement template
 */
export async function updateReplacementTemplate(
  templateId: string,
  data: UpdateReplacementTemplateRequest
): Promise<{ template: ReplacementTemplate }> {
  const res = await api.put(`/api/nutrition/replacement-templates/${templateId}`, data);
  return res.data;
}

/**
 * Delete a replacement template
 */
export async function deleteReplacementTemplate(templateId: string): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/nutrition/replacement-templates/${templateId}`);
  return res.data;
}

/**
 * Apply a replacement template to plans
 */
export async function applyReplacementTemplate(
  templateId: string,
  data: ApplyTemplateRequest
): Promise<BulkReplaceResponse & { template: { id: string; name: string } }> {
  const res = await api.post(`/api/nutrition/replacement-templates/${templateId}/apply`, data);
  return res.data;
}

