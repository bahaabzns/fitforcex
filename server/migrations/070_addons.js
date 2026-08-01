// Add-ons (founder decisions): small incremental purchases stacked on top of a base plan
// (+10 clients, +50 clients, +1 team member; future: AI credits, storage). Add-ons only ever
// raise a numeric usage limit — never unlock a feature — so `seatLimits.ts` sums the base
// variation/plan limit with the active add-on units for the same dimension.
//
// `addons` is the catalog (one row per SKU). `plan_addon_rules` is what makes a plan's cap
// admin-configurable without hardcoding plan identity in business logic (e.g. OneForce's
// "max 3 client add-ons" is just a `max_units` value on one row here, not an `if (plan.name
// === 'oneforce')` branch). `workspace_addons` is a purchase record — dimension/units/price
// are snapshotted at purchase time so a later edit to the `addons` catalog row (or even its
// deletion) never changes what a workspace already bought and is actively using.
exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE addons (
            id            TEXT     PRIMARY KEY,
            key           TEXT     NOT NULL UNIQUE,
            label         TEXT     NOT NULL,
            dimension     TEXT     NOT NULL,
            units         INTEGER  NOT NULL,
            price_monthly DECIMAL(10, 2) NOT NULL,
            currency      TEXT     NOT NULL DEFAULT 'LE',
            payment_link  TEXT,
            is_active     BOOLEAN  NOT NULL DEFAULT TRUE,
            sort_order    INTEGER  NOT NULL DEFAULT 0,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE plan_addon_rules (
            id         TEXT     PRIMARY KEY,
            plan_id    TEXT     NOT NULL REFERENCES plans(id)  ON DELETE CASCADE,
            addon_id   TEXT     NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
            max_units  INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            CONSTRAINT plan_addon_rules_plan_addon_unique UNIQUE (plan_id, addon_id)
        );
        CREATE INDEX idx_plan_addon_rules_plan_id ON plan_addon_rules (plan_id);

        CREATE TABLE workspace_addons (
            id                   TEXT     PRIMARY KEY,
            workspace_id         TEXT     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            addon_id             TEXT     REFERENCES addons(id) ON DELETE SET NULL,
            dimension            TEXT     NOT NULL,
            units                INTEGER  NOT NULL,
            quantity             INTEGER  NOT NULL DEFAULT 1,
            unit_price_locked    DECIMAL(10, 2) NOT NULL,
            currency             TEXT     NOT NULL DEFAULT 'LE',
            status               TEXT     NOT NULL DEFAULT 'active',
            workspace_payment_id TEXT     REFERENCES workspace_payments(id),
            purchased_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            canceled_at          TIMESTAMPTZ
        );
        CREATE INDEX idx_workspace_addons_workspace_id ON workspace_addons (workspace_id);
        CREATE INDEX idx_workspace_addons_status       ON workspace_addons (workspace_id, status);

        ALTER TABLE workspace_payments
            ADD COLUMN addon_id TEXT REFERENCES addons(id) ON DELETE SET NULL;
        CREATE INDEX idx_workspace_payments_addon_id ON workspace_payments (addon_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE workspace_payments DROP COLUMN IF EXISTS addon_id;
        DROP TABLE IF EXISTS workspace_addons;
        DROP TABLE IF EXISTS plan_addon_rules;
        DROP TABLE IF EXISTS addons;
    `);
};
