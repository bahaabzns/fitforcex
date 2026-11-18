import { describe, it, expect } from "vitest";
import { hasPermission, financeNavAccess, isAccessDenied } from "./permissions";

// Shapes copied from server/src/lib/defaultPermissions.ts.
const MANAGER = {
    role: "manager",
    permissions: {
        clients: { read: true, write: true, delete: true },
        finance: { read: false, write: false, delete: false },
    },
};
const FINANCE_VIEWER = { role: "accountant", permissions: { clients: { read: false }, finance: { read: true, write: true, delete: false } } };
const TRAINER_NO_CLIENTS = { role: "trainer", permissions: { clients: { read: false }, finance: { read: false } } };

describe("hasPermission", () => {
    it("always allows the workspace owner, whatever the stored permissions say", () => {
        expect(hasPermission({ role: "owner", permissions: null }, "finance")).toBe(true);
    });

    it("allows exactly what the permissions grant", () => {
        expect(hasPermission(MANAGER, "clients", "read")).toBe(true);
        expect(hasPermission(MANAGER, "finance", "read")).toBe(false);
    });

    it("denies an unknown module or action, and a missing workspace", () => {
        expect(hasPermission(MANAGER, "billing")).toBe(false);
        expect(hasPermission(MANAGER, "clients", "export")).toBe(false);
        expect(hasPermission(undefined, "clients")).toBe(false);
        expect(hasPermission(null, "clients")).toBe(false);
    });

    it("treats anything but literal true as denied", () => {
        expect(hasPermission({ role: "x", permissions: { finance: { read: "true" } } }, "finance")).toBe(false);
    });
});

describe("financeNavAccess", () => {
    it("shows everything to an owner", () => {
        expect(financeNavAccess({ role: "owner" })).toEqual({ transactions: true, packages: true, paymentMethods: true, any: true });
    });

    it("shows a manager only the package catalog (clients.read), not transactions or payment methods", () => {
        expect(financeNavAccess(MANAGER)).toEqual({ transactions: false, packages: true, paymentMethods: false, any: true });
    });

    it("shows everything to someone with finance.read", () => {
        expect(financeNavAccess(FINANCE_VIEWER)).toEqual({ transactions: true, packages: true, paymentMethods: true, any: true });
    });

    it("hides the whole Finance group from someone with neither finance.read nor clients.read", () => {
        expect(financeNavAccess(TRAINER_NO_CLIENTS)).toEqual({ transactions: false, packages: false, paymentMethods: false, any: false });
    });

    it("hides everything until the workspace is known", () => {
        expect(financeNavAccess(undefined).any).toBe(false);
    });
});

describe("isAccessDenied", () => {
    it("is true only for a 403 response", () => {
        expect(isAccessDenied({ response: { status: 403 } })).toBe(true);
        expect(isAccessDenied({ response: { status: 500 } })).toBe(false);
        expect(isAccessDenied({ response: { status: 401 } })).toBe(false);
        expect(isAccessDenied(new Error("Network Error"))).toBe(false);
        expect(isAccessDenied(undefined)).toBe(false);
    });
});
