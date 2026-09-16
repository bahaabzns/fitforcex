/**
 * Shared by the forms module, the training/nutrition plan-activation flows,
 * the check-in reconciliation engine, and the dispatch scheduler — one
 * definition of which post_action values are valid, so every code path that
 * creates a form_requests row stamps the same "after submission" action the
 * coach configured on the form, instead of silently falling back to the
 * column default ('nothing' / "No Action") when it forgets to set it.
 */

export const ALLOWED_POST_ACTIONS = ['nothing', 'nutrition-plan', 'workout-plan'] as const;

export function normalizePostAction(value: unknown): string {
    return ALLOWED_POST_ACTIONS.includes(value as typeof ALLOWED_POST_ACTIONS[number])
        ? (value as string)
        : 'nothing';
}
