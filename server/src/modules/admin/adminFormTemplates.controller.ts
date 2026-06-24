import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { normalizePostAction, normalizeFormType } from '../forms/forms.controller';

// Super-admin CRUD for the global Master Form Templates (master_forms /
// master_form_questions). Mirrors the coach form-builder controller
// (modules/forms/forms.controller.ts) but operates on the master tables and is NOT
// workspace-scoped — these are the single global defaults cloned into every new
// workspace on signup (see lib/libraryClone.ts). The Super Admin UI drives this with
// the exact same form-builder components coaches use.

export async function listTemplates(_req: Request, res: Response, next: NextFunction) {
    try {
        const templates = await prisma.master_forms.findMany({
            include: { _count: { select: { questions: true } } },
            orderBy: { created_at: 'desc' },
        });
        res.json(templates.map(({ _count, ...t }) => ({ ...t, question_count: _count.questions })));
    } catch (err) {
        next(err);
    }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
    const { title_en, title_ar, description_en, description_ar, postAction, formType } = req.body as Record<string, unknown>;
    try {
        const template = await prisma.master_forms.create({
            data: {
                id:             createId(),
                title_en:       (title_en as string | undefined) || 'Untitled Form',
                title_ar:       (title_ar as string | undefined) || null,
                description_en: (description_en as string | undefined) || null,
                description_ar: (description_ar as string | undefined) || null,
                post_action:    normalizePostAction(postAction),
                form_type:      normalizeFormType(formType),
            },
        });
        res.status(201).json({ ...template, question_count: 0 });
    } catch (err) {
        next(err);
    }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
    const { title_en, title_ar, description_en, description_ar, status, postAction, formType } = req.body as Record<string, unknown>;
    try {
        const updated = await prisma.master_forms.updateMany({
            where: { id: req.params.id as string },
            data: {
                title_en:       (title_en       as string | undefined) ?? undefined,
                title_ar:       (title_ar       as string | undefined) ?? undefined,
                description_en: (description_en as string | undefined) ?? undefined,
                description_ar: (description_ar as string | undefined) ?? undefined,
                status:         (status         as string | undefined) ?? undefined,
                post_action:    postAction !== undefined ? normalizePostAction(postAction) : undefined,
                form_type:      formType   !== undefined ? normalizeFormType(formType)    : undefined,
                updated_at:     new Date(),
            },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Template not found' });
        const template = await prisma.master_forms.findFirst({ where: { id: req.params.id as string } });
        res.json(template);
    } catch (err) {
        next(err);
    }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.master_forms.deleteMany({ where: { id: req.params.id as string } });
        if (deleted.count === 0) return res.status(404).json({ error: 'Template not found' });
        res.json({ deleted: req.params.id });
    } catch (err) {
        next(err);
    }
}

export async function getTemplateQuestions(req: Request, res: Response, next: NextFunction) {
    try {
        const template = await prisma.master_forms.findFirst({
            where:  { id: req.params.id as string },
            select: { id: true },
        });
        if (!template) return res.status(404).json({ error: 'Template not found' });

        const questions = await prisma.master_form_questions.findMany({
            where:   { master_form_id: req.params.id as string },
            orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
        });
        res.json(questions);
    } catch (err) {
        next(err);
    }
}

export async function createTemplateQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type } = req.body as Record<string, unknown>;
    try {
        const template = await prisma.master_forms.findFirst({
            where:  { id: req.params.id as string },
            select: { id: true },
        });
        if (!template) return res.status(404).json({ error: 'Template not found' });

        const agg = await prisma.master_form_questions.aggregate({
            where: { master_form_id: req.params.id as string },
            _max:  { order_index: true },
        });
        const orderIndex = (agg._max.order_index ?? -1) + 1;

        const defaults = {
            min_value: type === 'scale' ? 1 : null,
            max_value: type === 'scale' ? 10 : null,
            options:   ['select', 'multiselect'].includes(type as string) ? ([] as Prisma.InputJsonValue) : null,
        };

        const question = await prisma.master_form_questions.create({
            data: {
                id:             createId(),
                master_form_id: req.params.id as string,
                label_en:       (label_en as string | undefined) || 'Question',
                label_ar:       (label_ar as string | undefined) || null,
                type:           (type as string | undefined) || 'text',
                order_index:    orderIndex,
                min_value:      defaults.min_value,
                max_value:      defaults.max_value,
                options:        defaults.options ?? Prisma.DbNull,
            },
        });

        await prisma.master_forms.updateMany({ where: { id: req.params.id as string }, data: { updated_at: new Date() } });
        res.status(201).json(question);
    } catch (err) {
        next(err);
    }
}

export async function updateTemplateQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type, required, placeholder_en, placeholder_ar, options, options_ar, min_value, max_value } = req.body as Record<string, unknown>;
    try {
        const existing = await prisma.master_form_questions.findFirst({
            where: { id: req.params.qid as string, master_form_id: req.params.id as string },
        });
        if (!existing) return res.status(404).json({ error: 'Question not found' });

        const updated = await prisma.master_form_questions.update({
            where: { id: req.params.qid as string },
            data: {
                label_en:       label_en       !== undefined ? (label_en       as string) : existing.label_en,
                label_ar:       label_ar       !== undefined ? (label_ar       as string | null) : existing.label_ar,
                type:           type           !== undefined ? (type           as string) : existing.type,
                required:       required       !== undefined ? (required       as boolean) : existing.required,
                placeholder_en: placeholder_en !== undefined ? (placeholder_en as string | null) : existing.placeholder_en,
                placeholder_ar: placeholder_ar !== undefined ? (placeholder_ar as string | null) : existing.placeholder_ar,
                options:        options    !== undefined ? (options    != null ? options    as Prisma.InputJsonValue : Prisma.DbNull) : (existing.options    ?? Prisma.DbNull),
                options_ar:     options_ar !== undefined ? (options_ar != null ? options_ar as Prisma.InputJsonValue : Prisma.DbNull) : (existing.options_ar ?? Prisma.DbNull),
                min_value:      min_value  !== undefined ? (min_value  as number | null) : existing.min_value,
                max_value:      max_value  !== undefined ? (max_value  as number | null) : existing.max_value,
            },
        });

        await prisma.master_forms.updateMany({ where: { id: req.params.id as string }, data: { updated_at: new Date() } });
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function deleteTemplateQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.master_form_questions.deleteMany({
            where: { id: req.params.qid as string, master_form_id: req.params.id as string },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Question not found' });

        await prisma.master_forms.updateMany({ where: { id: req.params.id as string }, data: { updated_at: new Date() } });
        res.json({ deleted: req.params.qid });
    } catch (err) {
        next(err);
    }
}

export async function reorderTemplateQuestions(req: Request, res: Response, next: NextFunction) {
    const { order } = req.body as { order?: Array<{ id: string; order_index: number }> };
    try {
        await prisma.$transaction(
            (order || []).map(({ id, order_index }) =>
                prisma.master_form_questions.updateMany({
                    where: { id, master_form_id: req.params.id as string },
                    data:  { order_index },
                })
            )
        );
        await prisma.master_forms.updateMany({ where: { id: req.params.id as string }, data: { updated_at: new Date() } });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}
