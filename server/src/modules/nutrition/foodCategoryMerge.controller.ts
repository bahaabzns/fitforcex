import { Request, Response, NextFunction } from 'express';
import {
    MergeError, parseMergeInput, previewMerge, executeMerge, listRecentMerges, undoMerge,
} from './foodCategoryMerge.service';

// Thin HTTP layer for "Merge categories". Everything is scoped to req.user.workspaceId;
// MergeError carries the status/message, anything else goes to the global error handler.
function handle(action: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await action(req, res);
        } catch (err) {
            if (err instanceof MergeError) return void res.status(err.status).json({ error: err.message });
            next(err);
        }
    };
}

export const previewFoodCategoryMerge = handle(async (req, res) => {
    res.json(await previewMerge(req.user!.workspaceId as string, parseMergeInput(req.body)));
});

export const mergeFoodCategories = handle(async (req, res) => {
    res.status(201).json(await executeMerge(req.user!.workspaceId as string, req.user!.userId as string, parseMergeInput(req.body)));
});

export const getFoodCategoryMerges = handle(async (req, res) => {
    res.json(await listRecentMerges(req.user!.workspaceId as string));
});

export const undoFoodCategoryMerge = handle(async (req, res) => {
    res.json(await undoMerge(req.user!.workspaceId as string, req.user!.userId as string, req.params.mergeId as string));
});
