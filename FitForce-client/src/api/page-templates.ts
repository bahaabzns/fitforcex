import api from '@/utils/axios';
import { CustomPageConfig } from '@/components/VisualPdfBuilder';

export interface WorkspacePageTemplate {
  id: string;
  name: string;
  type: 'qa' | 'disclaimer' | 'custom' | 'terms';
  description?: string;
  isDefault: boolean;
  pageConfig: CustomPageConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all page templates for the current workspace
 */
export async function listPageTemplates(type?: 'qa' | 'disclaimer' | 'custom' | 'terms') {
  const params = type ? { type } : {};
  const response = await api.get('/api/page-templates', { params });
  return response.data.templates as WorkspacePageTemplate[];
}

/**
 * Get a single page template
 */
export async function getPageTemplate(id: string) {
  const response = await api.get(`/api/page-templates/${id}`);
  return response.data.template as WorkspacePageTemplate;
}

/**
 * Create a new page template
 */
export async function createPageTemplate(data: {
  name: string;
  type: 'qa' | 'disclaimer' | 'custom' | 'terms';
  description?: string;
  pageConfig: CustomPageConfig;
  isDefault?: boolean;
}) {
  const response = await api.post('/api/page-templates', data);
  return response.data.template as WorkspacePageTemplate;
}

/**
 * Update a page template
 */
export async function updatePageTemplate(id: string, data: {
  name?: string;
  description?: string;
  pageConfig?: CustomPageConfig;
  isDefault?: boolean;
}) {
  const response = await api.put(`/api/page-templates/${id}`, data);
  return response.data.template as WorkspacePageTemplate;
}

/**
 * Delete a page template
 */
export async function deletePageTemplate(id: string) {
  await api.delete(`/api/page-templates/${id}`);
}

/**
 * Set a page template as default
 */
export async function setDefaultPageTemplate(id: string) {
  const response = await api.post(`/api/page-templates/${id}/set-default`);
  return response.data.template as WorkspacePageTemplate;
}

