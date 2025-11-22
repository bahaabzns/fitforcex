import api from '@/utils/axios';

export interface VisualPdfTemplate {
  id: string;
  workspaceId: string;
  name: string;
  kind: 'workout' | 'nutrition';
  isGlobal: boolean;
  assignedWorkspaceIds?: string[] | null;
  config: any; // VisualPdfConfig
  workspace?: {
    id: string;
    name: string;
    subdomain: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisualTemplateData {
  name: string;
  kind: 'workout' | 'nutrition';
  config: any;
  workspaceId: string;
  isGlobal?: boolean;
  assignedWorkspaceIds?: string[];
}

export interface UpdateVisualTemplateData {
  name?: string;
  kind?: 'workout' | 'nutrition';
  config?: any;
  isGlobal?: boolean;
  assignedWorkspaceIds?: string[];
}

export interface AssignVisualTemplateData {
  isGlobal: boolean;
  assignedWorkspaceIds?: string[] | null;
}

/**
 * List all visual PDF templates
 */
export async function listVisualPdfTemplates(kind?: 'nutrition' | 'workout'): Promise<{ templates: VisualPdfTemplate[] }> {
  const params = kind ? { kind } : {};
  const response = await api.get('/api/admin/visual-pdf-templates', { params });
  return response.data;
}

/**
 * Get a single visual PDF template
 */
export async function getVisualPdfTemplate(id: string): Promise<{ template: VisualPdfTemplate }> {
  const response = await api.get(`/api/admin/visual-pdf-templates/${id}`);
  return response.data;
}

/**
 * Create a new visual PDF template
 */
export async function createVisualPdfTemplate(data: CreateVisualTemplateData): Promise<{ template: VisualPdfTemplate }> {
  const response = await api.post('/api/admin/visual-pdf-templates', data);
  return response.data;
}

/**
 * Update a visual PDF template
 */
export async function updateVisualPdfTemplate(id: string, data: UpdateVisualTemplateData): Promise<{ template: VisualPdfTemplate }> {
  const response = await api.put(`/api/admin/visual-pdf-templates/${id}`, data);
  return response.data;
}

/**
 * Delete a visual PDF template
 */
export async function deleteVisualPdfTemplate(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/api/admin/visual-pdf-templates/${id}`);
  return response.data;
}

/**
 * Assign visual PDF template to workspaces
 */
export async function assignVisualPdfTemplate(id: string, data: AssignVisualTemplateData): Promise<{ template: VisualPdfTemplate }> {
  const response = await api.put(`/api/admin/visual-pdf-templates/${id}/assign`, data);
  return response.data;
}

/**
 * Generate a preview PDF from a visual template
 */
export async function previewVisualPdfTemplate(id: string): Promise<{ previewUrl: string }> {
  const response = await api.post(`/api/admin/visual-pdf-templates/${id}/preview`);
  return response.data;
}

