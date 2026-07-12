import { Prisma } from '@prisma/client';
import { isValidAttachmentCategory } from '../../lib/formAttachments';

// Single source of truth for form question types — server, client (client/app/components/forms/questionTypes.js),
// and mobile (mobile/lib/features/forms/question_types.dart) must all stay in sync with this list.
// `metricConvertible` drives which types the "Track as Metric" action (Phase 4) offers on an existing question.
export const QUESTION_TYPE_DEFS = [
    { value: 'text',        metricConvertible: false },
    { value: 'long_text',   metricConvertible: false },
    { value: 'number',      metricConvertible: true  },
    { value: 'date',        metricConvertible: false },
    { value: 'scale',       metricConvertible: true  },
    { value: 'select',      metricConvertible: false },
    { value: 'multiselect', metricConvertible: false },
    { value: 'metric',      metricConvertible: false }, // already a tracked metric — nothing to convert
    { value: 'attachment',  metricConvertible: false },
] as const;

export const QUESTION_TYPES = QUESTION_TYPE_DEFS.map((def) => def.value);

export type QuestionType = typeof QUESTION_TYPE_DEFS[number]['value'];

export function isValidQuestionType(value: unknown): value is QuestionType {
    return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value);
}

export function isMetricConvertibleType(value: unknown): boolean {
    return QUESTION_TYPE_DEFS.some((def) => def.value === value && def.metricConvertible);
}

/**
 * Shared by createQuestion/updateQuestion/saveDraft — the `options` JSON
 * column's shape depends entirely on the question's type, so this is the
 * one place that decides it rather than duplicating the per-type logic at
 * every call site. For `attachment`, the allowed category is a
 * server-enforced upload constraint (see lib/formAttachments.ts), so an
 * invalid/missing value here is corrected to "any" rather than trusted
 * as-is or rejected outright — the upload endpoint itself is the actual
 * enforcement point.
 */
export function normalizeQuestionOptions(questionType: string, rawOptions: unknown): Prisma.InputJsonValue | null {
    if (questionType === 'select' || questionType === 'multiselect') {
        return Array.isArray(rawOptions) ? (rawOptions as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue);
    }
    if (questionType === 'attachment') {
        const category = (rawOptions as { allowedCategory?: unknown } | null)?.allowedCategory;
        return { allowedCategory: isValidAttachmentCategory(category) ? category : 'any' };
    }
    return null;
}
