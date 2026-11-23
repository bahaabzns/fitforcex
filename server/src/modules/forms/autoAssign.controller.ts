import { Request, Response, NextFunction } from 'express';
import {
    AUTO_ASSIGN_PLAN_TYPES, AutoAssignPlanType, RULE_SORT_KEYS, RULES_DEFAULT_SORT, RuleSort, RuleSortKey, EnableRuleOutcome, RULES_DEFAULT_PAGE_SIZE, RULES_MAX_PAGE_SIZE, RuleFilters,
    disableClientRules, disableMatchingRules, disableRule, enableRuleForRequest, listActiveRules, listRuleAgents, setClientRuleAgent,
} from './autoAssign.service';
import { isManagerOrOwner } from './forms.controller';

const MANAGER_ONLY_MESSAGE = 'Only the workspace owner or a manager can manage auto-assign rules';
const MAX_SEARCH_LENGTH = 100;

// Outcomes that mean "nothing was turned on": status and a terse message (no internals leaked).
const ENABLE_FAILURES: Partial<Record<EnableRuleOutcome, { status: number; error: string }>> = {
    request_not_found:   { status: 404, error: 'Queue item not found' },
    not_assigned:        { status: 400, error: 'Assign this form to someone before turning on auto-assign' },
    not_a_plan_form:     { status: 400, error: 'Only forms that lead to a plan can be auto-assigned' },
    agent_not_eligible:  { status: 400, error: 'That person cannot receive plans' },
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const asText = (input: unknown): string | undefined => (typeof input === 'string' && input.trim() ? input.trim() : undefined);

// Strict on purpose: an unrecognised filter must fail loudly rather than be ignored, because the same
// filters decide which rules "turn off all matching" switches off — ignoring one would widen that.
function parseRuleFilters(source: Record<string, unknown>): Parsed<RuleFilters> {
    const filters: RuleFilters = {};
    const search = asText(source.search);
    if (search) filters.search = search.slice(0, MAX_SEARCH_LENGTH);

    const planType = asText(source.planType);
    if (planType) {
        if (!(AUTO_ASSIGN_PLAN_TYPES as readonly string[]).includes(planType)) return { ok: false, error: 'planType is not valid' };
        filters.planType = planType as AutoAssignPlanType;
    }

    const status = asText(source.status);
    if (status) {
        if (status !== 'unavailable') return { ok: false, error: 'status is not valid' };
        filters.status = status;
    }

    const agentUserId = asText(source.agentUserId);
    if (agentUserId) filters.agentUserId = agentUserId;
    return { ok: true, value: filters };
}

// Unlike the filters, sorting never changes which rules a bulk action touches, so a bad value falls back to the default.
function parseRuleSort(source: Record<string, unknown>): RuleSort {
    const key = asText(source.sortBy);
    if (!key || !(RULE_SORT_KEYS as readonly string[]).includes(key)) return RULES_DEFAULT_SORT;
    return { key: key as RuleSortKey, direction: asText(source.sortDir) === 'asc' ? 'asc' : 'desc' };
}

function parsePositiveInt(input: unknown, fallback: number, max: number): number {
    const parsed = Number.parseInt(String(input ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

// Anyone with forms-read can see the rules (an agent should be able to see why a form landed on them);
// only owners/managers can change them.
export async function getAutoAssignRules(req: Request, res: Response, next: NextFunction) {
    const parsed = parseRuleFilters(req.query);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    try {
        res.json(await listActiveRules({
            workspaceId: req.user!.workspaceId,
            filters:     parsed.value,
            sort:        parseRuleSort(req.query),
            page:        parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER),
            pageSize:    parsePositiveInt(req.query.pageSize, RULES_DEFAULT_PAGE_SIZE, RULES_MAX_PAGE_SIZE),
        }));
    } catch (err) {
        next(err);
    }
}

export async function turnOffAutoAssignRule(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: MANAGER_ONLY_MESSAGE });
    try {
        const turnedOff = await disableRule({
            workspaceId: req.user!.workspaceId, ruleId: req.params.id as string, actorUserId: req.user!.userId,
        });
        if (!turnedOff) return res.status(404).json({ error: 'Auto-assign rule not found' });
        res.json({ id: req.params.id, turnedOff: true });
    } catch (err) {
        next(err);
    }
}

export async function turnOffMatchingAutoAssignRules(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: MANAGER_ONLY_MESSAGE });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseRuleFilters(body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    // Turning off *every* rule must be a deliberate, explicit request — never the result of an empty filter.
    if (Object.keys(parsed.value).length === 0 && body.all !== true) {
        return res.status(400).json({ error: 'Pass at least one filter, or all: true to turn off every rule' });
    }
    try {
        const turnedOff = await disableMatchingRules({
            workspaceId: req.user!.workspaceId, filters: parsed.value, actorUserId: req.user!.userId,
        });
        res.json({ turnedOff });
    } catch (err) {
        next(err);
    }
}

export async function enableAutoAssignRule(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: MANAGER_ONLY_MESSAGE });
    const { requestId } = req.body as { requestId?: unknown };
    if (typeof requestId !== 'string' || !requestId) return res.status(400).json({ error: 'requestId is required' });
    try {
        const { outcome, rule } = await enableRuleForRequest({
            workspaceId: req.user!.workspaceId, requestId, actorUserId: req.user!.userId,
        });
        const failure = ENABLE_FAILURES[outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error });
        res.json({ outcome, rule });
    } catch (err) {
        next(err);
    }
}

// The people each plan type's agent dropdown may offer (owner/manager plus the matching specialist role).
export async function getAutoAssignAgents(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await listRuleAgents(req.user!.workspaceId));
    } catch (err) {
        next(err);
    }
}

const SET_AGENT_FAILURES: Record<string, { status: number; error: string }> = {
    client_not_found:   { status: 404, error: 'Client not found' },
    agent_not_eligible: { status: 400, error: 'That person cannot receive this type of plan' },
};

// Body { agentUserId: string | null }: a person points the client's rule for this plan type at them, null turns it off.
export async function setAutoAssignClientAgent(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: MANAGER_ONLY_MESSAGE });
    const planType = req.params.planType as string;
    if (!(AUTO_ASSIGN_PLAN_TYPES as readonly string[]).includes(planType)) return res.status(400).json({ error: 'planType is not valid' });
    const { agentUserId } = (req.body ?? {}) as { agentUserId?: unknown };
    if (agentUserId !== null && (typeof agentUserId !== 'string' || !agentUserId)) {
        return res.status(400).json({ error: 'agentUserId must be a user id, or null to turn the rule off' });
    }
    try {
        const { outcome, rule } = await setClientRuleAgent({
            workspaceId: req.user!.workspaceId, clientId: req.params.clientId as string,
            planType: planType as AutoAssignPlanType, agentUserId: agentUserId as string | null, actorUserId: req.user!.userId,
        });
        const failure = SET_AGENT_FAILURES[outcome];
        if (failure) return res.status(failure.status).json({ error: failure.error });
        res.json({ outcome, rule });
    } catch (err) {
        next(err);
    }
}

// Turns off both of a client's rules (nutrition and workout) in one go.
export async function turnOffAutoAssignClient(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: MANAGER_ONLY_MESSAGE });
    try {
        const turnedOff = await disableClientRules({
            workspaceId: req.user!.workspaceId, clientId: req.params.clientId as string, actorUserId: req.user!.userId,
        });
        if (turnedOff === 0) return res.status(404).json({ error: 'Auto-assign rules not found' });
        res.json({ turnedOff });
    } catch (err) {
        next(err);
    }
}
