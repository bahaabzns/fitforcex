// Client-side mirror of the server's permission guards (server/src/middleware/requirePermission.ts),
// used only to decide what to SHOW. The server stays the authority: it still answers 403 to anything
// not allowed. `workspace` is `me.currentWorkspace` from GET /api/auth/me: { role, permissions }.

export function hasPermission(workspace, module, action = "read") {
    if (!workspace) return false;
    if (workspace.role === "owner") return true;
    return workspace.permissions?.[module]?.[action] === true;
}

// Which Finance pages the user can open. Mirrors the route guards:
//   transactions, payment methods -> finance.read
//   packages (GET)               -> finance.read OR clients.read (coaches browse the catalog)
export function financeNavAccess(workspace) {
    const canReadFinance = hasPermission(workspace, "finance", "read");
    const access = {
        transactions:   canReadFinance,
        packages:       canReadFinance || hasPermission(workspace, "clients", "read"),
        paymentMethods: canReadFinance,
    };
    return { ...access, any: access.transactions || access.packages || access.paymentMethods };
}

// True when an axios error is the server saying "you are not allowed" (as opposed to a failure to load).
export function isAccessDenied(error) {
    return error?.response?.status === 403;
}
