import api from '@/utils/axios';

export type PdfTemplate = {
  id: string;
  workspaceId: string;
  name: string;
  kind: 'nutrition' | 'workout';
  updatedAt?: string;
};

export async function listPdfTemplates(kind?: 'nutrition' | 'workout') {
  const params = kind ? { kind } : undefined;
  const res = await api.get('/api/templates', { params });
  return res.data as { templates: PdfTemplate[] };
}

export async function createPdfTemplate(input: {
  name: string;
  kind: 'nutrition' | 'workout';
  html?: string;
  schema?: unknown;
  config?: unknown;
}) {
  const res = await api.post('/api/templates', input);
  return res.data as { template: PdfTemplate };
}

export async function uploadHtmlTemplate(templateId: string, file: File | null, htmlText?: string) {
  if (file) {
    const form = new FormData();
    form.set('file', file);
    const res = await api.post(`/api/templates/${templateId}/upload-html`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data as { template: PdfTemplate };
  }
  if (htmlText && htmlText.trim().length > 0) {
    const res = await api.post(`/api/templates/${templateId}/upload-html`, { html: htmlText });
    return res.data as { template: PdfTemplate };
  }
  throw new Error('Provide a File or html text');
}

export async function generatePdfFromTemplate(args: {
  templateId: string;
  planId?: string;
  clientId?: string;
  data?: Record<string, unknown>;
}) {
  const { templateId, ...body } = args;
  const res = await api.post(`/api/templates/${templateId}/generate`, body);
  return res.data as { pdfUrl: string };
}



