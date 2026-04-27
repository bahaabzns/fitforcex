import api from '@/utils/axios';

export interface PdfTemplate {
  id: string;
  name: string;
  kind: 'nutrition' | 'workout';
  fileUrl?: string;
  isGlobal: boolean;
  assignedWorkspaceIds?: string[] | null;
  workspace?: {
    id: string;
    name: string;
    subdomain: string;
  };
  placeholders?: string[];
  patterns?: Array<{
    baseName: string;
    maxNumber: number;
    pageIndex: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface UploadTemplateData {
  name: string;
  kind: 'nutrition' | 'workout';
  isGlobal: boolean;
  assignedWorkspaceIds?: string[];
}

export interface AssignTemplateData {
  isGlobal: boolean;
  assignedWorkspaceIds?: string[] | null;
}

/**
 * List all PDF templates
 */
export async function listPdfTemplates(kind?: 'nutrition' | 'workout'): Promise<{ templates: PdfTemplate[] }> {
  const params = kind ? { kind } : {};
  const response = await api.get('/api/admin/pdf-templates', { params });
  return response.data;
}

/**
 * Get a single PDF template with placeholder info
 */
export async function getPdfTemplate(id: string): Promise<{ template: PdfTemplate }> {
  const response = await api.get(`/api/admin/pdf-templates/${id}`);
  return response.data;
}

/**
 * Upload a new PDF template
 */
export async function uploadPdfTemplate(
  file: File,
  data: UploadTemplateData
): Promise<{ template: PdfTemplate }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', data.name);
  formData.append('kind', data.kind);
  formData.append('isGlobal', String(data.isGlobal));
  // Always send assignedWorkspaceIds, even if empty (backend will handle null for global templates)
  formData.append('assignedWorkspaceIds', JSON.stringify(data.assignedWorkspaceIds || []));
  
  const response = await api.post('/api/admin/pdf-templates', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Assign template to workspaces or set as global
 */
export async function assignTemplate(
  templateId: string,
  data: AssignTemplateData
): Promise<{ template: PdfTemplate }> {
  const response = await api.post(`/api/admin/pdf-templates/${templateId}/assign`, data);
  return response.data;
}

/**
 * Delete a PDF template
 */
export async function deleteTemplate(templateId: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/api/admin/pdf-templates/${templateId}`);
  return response.data;
}

/**
 * Generate PDF from template for a plan
 */
export async function generatePdfFromTemplate(
  planId: string,
  planType: 'nutrition' | 'workout'
): Promise<{ pdfUrl: string }> {
  const endpoint = planType === 'nutrition' 
    ? `/api/nutrition/plans/${planId}/generate-pdf`
    : `/api/workout/plans/${planId}/generate-pdf`;
  
  const response = await api.post(endpoint);
  return response.data;
}

