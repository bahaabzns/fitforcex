# Arabic Language Feature — Remaining Tasks

> Branch: `feature/arabic-language`
> Last updated: 2026-05-26
>
> **Status of already-completed work:**
> Auth & portal pages, dashboard, clients list & profile, plans queue, forms components,
> training/nutrition panels & sub-pages, settings profile — all committed and wired.

---

## Phase 1 — Shared Infrastructure (Do First)

These files are used across many pages. Wire them once and every downstream page benefits.

---

### 1.1 `DataTable.js` — Shared table component

**File:** `client/app/components/DataTable.js` (714 lines)
**Impact:** Used on every finance, training, and nutrition database page (~8 pages).
**Namespace:** `filter` (already exists with most keys — verify coverage)

Strings to wire:

| Location | Hardcoded | Key |
|---|---|---|
| Filter button | `Filter` | `filter.filterButton` (new) |
| Clear all filters | `Clear all` | `filter.clearAll` ✓ |
| Rows per page | `Rows per page` | `filter.rowsPerPage` ✓ |
| Previous button | `Previous` | `filter.previous` ✓ |
| Next button | `Next` | `filter.next` ✓ |
| Selection count | `{n} of {total} selected` | `filter.selectedCount` (new, needs `{n}` and `{total}` params) |
| Mobile expand | `Show less` / `+{n} more` | `filter.showLess` ✓, `filter.showMore` (new, needs `{count}`) |

**Notes:**
- `DataTable` is a pure component — add `useTranslations('filter')` inside it.
- Check if `filter.clearAll`, `filter.previous`, `filter.next`, `filter.rowsPerPage` already exist (they do — confirmed in en.json). Only add genuinely missing keys.
- The `quickSearch.placeholder` prop is already passed from callers — no change needed there.

---

### 1.2 `ClientSidebar.js` — Client portal sidebar

**File:** `client/app/components/ClientSidebar.js` (142 lines)
**Namespace:** `portal.sidebar` (new) or reuse `sidebar`

Strings to wire:

| Hardcoded | Suggested key |
|---|---|
| `"Nutrition Plan"` nav label | `portal.sidebar.nutritionPlan` (new) |
| `"Training Plan"` nav label | `portal.sidebar.trainingPlan` (new) |
| `"Forms"` nav label | `portal.sidebar.forms` (new) |
| `"Expand sidebar"` / `"Collapse sidebar"` title attrs | reuse `sidebar.expandSidebar` / `sidebar.collapseSidebar` |
| `"Logout"` | reuse `sidebar.logout` |

---

### 1.3 `LoadPlanModal.js` — Plan loader modal

**File:** `client/app/components/LoadPlanModal.js` (301 lines)
**Namespace:** `training` and `nutrition` (already exist)

Strings to wire:

| Hardcoded | Key |
|---|---|
| `"Search by plan name..."` placeholder | `filter.searchPlanName` ✓ |
| `"Days"` range label | `training.days` (new) |
| `"Exercises"` range label | `training.exercises` ✓ |
| `"Calories"` range label | `nutrition.calories` ✓ |
| `"Protein"` range label | new `nutrition.protein` |
| `"Carbs"` range label | new `nutrition.carbs` |
| `"Fat"` range label | new `nutrition.fat` |
| `"Min"` / `"Max"` placeholders | new `common.min` / `common.max` |

---

### 1.4 `forms/FormsPanel.js` — Forms list panel

**File:** `client/app/components/forms/FormsPanel.js` (209 lines)
**Namespace:** `forms` (already exists)

Strings to wire:

| Hardcoded | Key |
|---|---|
| `"Newest"` / `"Oldest"` sort options | `nutrition.newest` ✓ / `nutrition.oldest` ✓ (reuse, or add to `common`) |
| `title="Set to Active"` tooltip | `forms.setToActive` (new) |
| `title="Duplicate form"` tooltip | `forms.duplicateForm` (new) |
| `title="Delete form"` tooltip | `forms.deleteForm` (new) |

---

## Phase 2 — Client Sub-Pages

---

### 2.1 `clients/[id]/layout.js` — Client tab navigation

**File:** `client/app/(coach)/[workspaceSlug]/clients/[id]/layout.js` (166 lines)
**Namespace:** `clients` (already exists)

Strings to wire:

| Hardcoded | Key |
|---|---|
| Tab name `"Overview"` | `clients.tabOverview` (new) |
| Tab name `"Nutrition"` | `nav.nutrition` ✓ (reuse) |
| Tab name `"Training"` | `nav.training` ✓ (reuse) |
| Tab name `"Forms"` | `nav.forms` ✓ (reuse) |
| Tab name `"Transactions"` | `nav.transactions` ✓ (reuse) |
| `window.confirm("You have unsaved changes. Leave without saving?")` | `clients.unsavedChangesPrompt` (new) |

---

### 2.2 `clients/[id]/transactions/page.js` — Client transaction history

**File:** `client/app/(coach)/[workspaceSlug]/clients/[id]/transactions/page.js` (663 lines, ~71 string hits)
**Namespace:** `clientTransactions` (new)

This is a large, complex page. Key string groups:

**Column labels:** `Code`, `Amount`, `Currency`, `Method`, `Date`, `Subscription Period`, `Duration`, `Status`, `Actions`

**Status chips:** `Active`, `Expired`, `Frozen`, `Pre-start`, `Refunded`, `Cancelled`

**Summary card labels:** `Total Spent`, `Transactions`, `Active`, `Frozen`, `Expired`, `Refunded`, `Pre-start`, `Cancelled`

**Modal (Add Transaction):** title, Amount, Currency, Payment Method, Transaction Date, Duration (months), Proof of Payment, optional label, Notes, Add Transaction button, Saving…

**Modal (Edit Transaction):** Edit Transaction title, all the same fields, Save Changes, Cancel

**Modal (Freeze):** already covered in `clients` namespace

**Inline states:** `"—"` dash, loading text, `"No transactions yet"`, `"Add the first transaction"`

**Validation errors:** amount required, method required, date required, duration required

**Date formatting:** `"en-US"` → replace with `locale` from `useLocale()`

**New translation keys needed (~35 keys):**
```
clientTransactions.title, clientTransactions.subtitle,
clientTransactions.colCode, clientTransactions.colAmount, clientTransactions.colCurrency,
clientTransactions.colMethod, clientTransactions.colDate, clientTransactions.colPeriod,
clientTransactions.colDuration, clientTransactions.colStatus, clientTransactions.colActions,
clientTransactions.totalSpent, clientTransactions.transactions,
clientTransactions.addTransactionTitle, clientTransactions.editTransactionTitle,
clientTransactions.amountLabel, clientTransactions.currencyLabel,
clientTransactions.methodLabel, clientTransactions.dateLabel,
clientTransactions.durationLabel, clientTransactions.notesLabel,
clientTransactions.proofLabel, clientTransactions.proofOptional,
clientTransactions.addTransaction, clientTransactions.saveChanges,
clientTransactions.saving, clientTransactions.cancel,
clientTransactions.noTransactions, clientTransactions.addFirst,
clientTransactions.validationAmount, clientTransactions.validationMethod,
clientTransactions.validationDate, clientTransactions.validationDuration,
clientTransactions.deleteConfirm, clientTransactions.failedToSave
```

---

## Phase 3 — Finance Pages

All three pages follow the same DataTable + inline-edit + creation modal pattern.

---

### 3.1 `finance/payment-methods/page.js` ← **IN PROGRESS**

**File:** `client/app/(coach)/[workspaceSlug]/finance/payment-methods/page.js`
**Namespace:** `paymentMethods` (keys already added to en.json / ar.json)

**Remaining wiring to complete:**
- Column labels: `Created` → `t('createdLabel')`
- Inline edit actions: `Save` → `t('save')`, `Cancel` → `tCommon('cancel')`, `Edit` → `tCommon('edit')`, `Delete` → `tCommon('delete')`
- `displayRows` mapping: `"Active"` / `"Inactive"` → `t('active')` / `t('inactive')`
- Summary cards: `"Total"` → `t('total')`, `"{n} active"` → `t('activeCount', { count })`
- Modal title: `"New Payment Method"` → `t('newMethodTitle')`
- Form labels: `"Name"` → `t('nameLabel')`, `"Type"` → `t('typeLabel')`
- Name placeholder → `t('namePlaceholder')`
- Submit button: `"Create Method"` → `t('createMethod')`
- Toolbar button: `"+ New Method"` → `t('newMethod')`
- DataTable quick search placeholder → `t('searchPlaceholder')`
- Error messages: wire the 5 error strings already added as keys
- Date formatting: `"en-US"` → `locale` from `useLocale()`
- Loading heading: `"Payment Methods"` → `t('title')`

---

### 3.2 `finance/packages/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/finance/packages/page.js` (670 lines, ~67 string hits)
**Namespace:** `packages` (new)

Key string groups:

**Page:** title `"Packages"`, subtitle, column labels (`Name`, `Price`, `Currency`, `Duration`, `Status`, `Created`), status `Active`/`Inactive`, `"Total"` card

**Modal (Create/Edit):** `"New Package"` / `"Edit Package"`, Name field, Price, Currency (dropdown), Duration (months), status toggle, `"Create Package"` / `"Save Changes"`, Cancel

**Inline edit:** `Save`, `Cancel`, `Edit`, `Delete`

**Errors:** name required, price required, create failed, save failed, delete failed

**DataTable:** search placeholder `"Search packages..."`, `"+ New Package"` toolbar button

**New keys needed (~28 keys):** title, subtitle, colName, colPrice, colCurrency, colDuration, colStatus, colCreated, total, active, inactive, activeCount, newPackageTitle, editPackageTitle, nameLabel, priceLabel, currencyLabel, durationLabel, durationMonths, createPackage, saveChanges, save, newPackage, searchPlaceholder, errorNameRequired, errorPriceRequired, errorCreate, errorSave, errorDelete

---

### 3.3 `finance/transactions/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/finance/transactions/page.js` (663 lines, ~42 string hits)
**Namespace:** `transactions` (new)

Key string groups:

**Page:** title `"Transactions"`, subtitle, column labels (`Code`, `Client`, `Amount`, `Currency`, `Method`, `Date`, `Duration`, `Status`)

**Summary cards:** Total, This Month, Active subscriptions

**Status chips:** Active, Expired, Frozen, Pre-start, Refunded, Cancelled

**Filters / search:** quick search placeholder

**Date formatting:** `"en-US"` → `locale`

**New keys needed (~20 keys):** title, subtitle, colCode, colClient, colAmount, colCurrency, colMethod, colDate, colDuration, colStatus, total, thisMonth, activeSubscriptions, searchPlaceholder, noTransactions, and status chip labels (reuse from `clientTransactions` or define here)

---

## Phase 4 — Training & Nutrition Database Pages

These four pages are structurally identical (DataTable + CRUD modal). Best done together.

---

### 4.1 `training/exercises/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/training/exercises/page.js` (282 lines, ~29 string hits)
**Namespace:** `exercises` (new)

Key strings: title, subtitle, column labels (Name, Muscle Group, Equipment, Created), modal title (Add/Edit Exercise), form labels, search placeholder, toolbar button, error messages, inline edit actions

---

### 4.2 `training/equipment/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/training/equipment/page.js` (142 lines, ~18 string hits)
**Namespace:** `equipment` (new)

Key strings: title, subtitle, column labels (Name, Created), modal title, form labels, search placeholder, toolbar button, error messages

---

### 4.3 `training/muscle-groups/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/training/muscle-groups/page.js` (142 lines, ~18 string hits)
**Namespace:** `muscleGroups` (new)

Key strings: title, subtitle, column labels (Name, Created), modal title, form labels, search placeholder, toolbar button, error messages

---

### 4.4 `nutrition/food-categories/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/nutrition/food-categories/page.js` (136 lines, ~14 string hits)
**Namespace:** `foodCategories` (new)

Key strings: title, subtitle, column labels (Name, Created), modal title (Add/Edit Category), name field, search placeholder, toolbar button, error messages

---

### 4.5 `nutrition/food-items/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/nutrition/food-items/page.js` (194 lines, ~28 string hits)
**Namespace:** `foodItems` (new)

Key strings: title, subtitle, column labels (Name, Category, Calories, Protein, Carbs, Fat, Created), modal title, form labels, search placeholder, toolbar button, error messages

---

## Phase 5 — Settings Pages

---

### 5.1 `settings/workspace/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/settings/workspace/page.js` (384 lines, ~27 string hits)
**Namespace:** `settings` (already exists — add keys)

Key string groups:

**Page:** title `"Workspace"`, subtitle `"Manage your workspace settings."`

**Workspace Info section:** section heading, Workspace Name label, save button, success/error messages

**Branding section:** section heading, Logo Upload label, upload instructions, remove button

**Danger Zone section:** section heading, Delete Workspace label, delete warning text, confirm button

**New keys to add to `settings` namespace (~18 keys):** workspace, workspaceSubtitle, workspaceInfo, workspaceName, saveName, saving, workspaceUpdated, workspaceUpdateFailed, branding, logoUpload, uploadInstructions, removeLogoBtn, dangerZone, deleteWorkspace, deleteWarning, deleteConfirm, deleting, deleteSuccess

---

### 5.2 `settings/billing/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/settings/billing/page.js` (330 lines, ~22 string hits)
**Namespace:** `billing` (already exists — add keys)

Key string groups:

**Page:** title `"Billing"`, subtitle

**Current Plan section:** section heading, plan name chip, status, renewal date, `"Upgrade Plan"` button

**Transaction History section:** section heading, column labels (Date, Description, Amount, Status), status chips (pending, paid, failed, refunded), download button, no transactions empty state

**New keys to add to `billing` namespace (~15 keys):** title, subtitle, currentPlan, planLabel, statusLabel, renewalDate, upgradePlan, transactionHistory, colDate, colDescription, colAmount, colStatus, noTransactions, downloadInvoice ✓ (already exists), pay ✓ (already exists)

---

## Phase 6 — Team Page

### 6.1 `team/page.js`

**File:** `client/app/(coach)/[workspaceSlug]/team/page.js` (927 lines, ~35 string hits)
**Namespace:** `team` (already exists — add keys)

This is the largest remaining file. Key string groups:

**Page:** title `"Team"`, subtitle

**Members tab:** table column labels (Name, Email, Role, Status, Joined, Actions), role chips, status chips, `"Remove"` button confirm dialog

**Invitations tab:** table column labels (Email, Role, Sent, Status, Actions), status chips (pending, accepted, expired), `"Resend"` / `"Revoke"` actions

**Invite Modal:** title, email field, role selector, send button, sending state, success/error messages

**Seat usage:** `"{used} of {total} seats used"`, upgrade prompt


**New keys to add to `team` namespace (~25 keys):** title, subtitle, colName, colEmail, colRole, colStatus, colJoined, colSent, colActions, removeConfirm, removeButton, resend, revoke, inviteTitle, emailLabel, roleLabel, sendInvite, sending, inviteSent, inviteFailed, seatsUsed, seatsUpgrade, statusPending ✓, statusAccepted, statusExpired, noMembers, noInvitations

---





## Phase 7 — Nutrition Components

These components were partially wired in an earlier commit but may still have hardcoded strings.

---

### 7.1 `nutrition/CycleCalculator.js`

**File:** `client/app/components/nutrition/CycleCalculator.js` (421 lines, ~43 string hits)
**Namespace:** `nutrition` (already exists — add keys)

This is the calorie/macro calculator. Key strings: section heading, input labels (Weight, Height, Age, Gender, Activity Level), goal labels (Cut, Maintain, Bulk), result labels (Calories, Protein, Carbs, Fat), apply/close buttons, validation messages

**New keys to add (~20 keys):** calculatorTitle, weightLabel, heightLabel, ageLabel, genderLabel, activityLabel, goalLabel, male, female, goals for cut/maintain/bulk, activity levels, applyButton, resultCalories, resultProtein, resultCarbs, resultFat

---

### 7.2 `nutrition/FoodItemsModal.js`

**File:** `client/app/components/nutrition/FoodItemsModal.js` (189 lines, ~7 string hits)
**Namespace:** `nutrition` (already exists)

Key strings: modal title `"Add Food Items"`, search placeholder, no results text, add button — most of these likely already covered by existing `nutrition` keys; verify and fill gaps.

---

## Phase 8 — Partially Wired Components (Audit & Complete)

These components have `useTranslations` but may still have hardcoded strings missed in earlier commits. Audit each one:

| Component | Hook Count | Action |
|---|---|---|
| `Sidebar.js` | 3 | Audit for remaining hardcoded nav labels, workspace switcher text |
| `forms/QuestionsPanel.js` | 3 | Audit for remaining button labels, empty states |
| `nutrition/MiddlePanel.js` | 3 | Audit for remaining labels |
| `nutrition/RightPanel.js` | 2 | Audit for remaining labels |
| `training/ExercisePickerModal.js` | 3 | Audit for remaining labels |
| `training/MiddlePanel.js` | 4 | Audit for remaining labels |
| `training/RightPanel.js` | 2 | Audit for remaining labels |

---

## Summary Table

| Phase | Files | Complexity | New Namespaces Needed |
|---|---|---|---|
| 1 — Shared Infrastructure | DataTable, ClientSidebar, LoadPlanModal, FormsPanel | Medium | — (add keys to existing) |
| 2 — Client Sub-Pages | layout.js, transactions/page.js | High | `clientTransactions` |
| 3 — Finance Pages | payment-methods *(in progress)*, packages, transactions | High | `packages`, `transactions` |
| 4 — Training & Nutrition DB | exercises, equipment, muscle-groups, food-categories, food-items | Medium | `exercises`, `equipment`, `muscleGroups`, `foodCategories`, `foodItems` |
| 5 — Settings | workspace, billing | Medium | — (add to `settings`, `billing`) |
| 6 — Team | team/page.js | High | — (add to `team`) |
| 7 — Nutrition Components | CycleCalculator, FoodItemsModal | Medium | — (add to `nutrition`) |
| 8 — Audit Partial | 7 components | Low | — |

**Total remaining:** ~16 files, ~8 new namespaces, ~200+ new translation keys (EN + AR each)

---

## Rules to Follow in Every File

1. `useTranslations` must be called inside the component body — never at module level.
2. Sub-components defined outside the main component (e.g., `CountryCodeSelect`) need their own `useTranslations` call — they cannot inherit `t` from a parent scope.
3. Never use `t()` in a `.map()` callback where the loop variable is also named `t` — rename the loop variable (e.g., `type`, `item`, `row`).
4. Date formatting: replace every `toLocaleDateString("en-US", ...)` with `toLocaleDateString(locale, ...)` using `useLocale()` from `next-intl`.
5. `Date.now()` / `new Date()` in JSX render → compute in event handler or `useEffect`, store in state.
6. Module-level constant objects with display labels → keep the keys at module level, compute translated versions inside the component using `t()`.
7. Commit per logical group: one commit per page or component set.
