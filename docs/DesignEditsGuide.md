# Design Edits — Implementation Guide

Tasks grouped by location. Each phase can be worked on independently.

---

## Phase 1 — Builders: Shared (Nutrition & Training Left/Middle/Right Panels)

Both builders share the same panel architecture:
- `client/app/components/nutrition/LeftPanel.js` — plans list + form submissions + calorie calculator disclosure sections
- `client/app/components/nutrition/MiddlePanel.js` — cycles + meals disclosure sections
- `client/app/components/nutrition/RightPanel.js` — food items disclosure section
- `client/app/components/training/LeftPanel.js` — plans list + form submissions disclosure sections
- `client/app/components/training/MiddlePanel.js` — days + exercises disclosure sections
- `client/app/components/training/RightPanel.js` — exercise detail disclosure section

---

### 1.1 — Allow Scrolling in Builder Sections

**Goal:** Each builder panel should be individually scrollable so content never gets clipped.

**Files:** All six panel files above.

**Steps:**

1. In each panel's outermost `<Surface>` wrapper, confirm the className includes `overflow-hidden`. It already does. The issue is that inner `Disclosure.Body` elements that list dynamic content (plans, meals, exercises) need `overflow-y-auto` + a `max-h` or `flex-1 min-h-0` to activate scroll.

2. In `nutrition/LeftPanel.js`, the plans list div on line 140 already has `flex-1 overflow-y-auto min-h-0`. Verify that the parent chain (`DisclosureGroup` → `Disclosure` → `Disclosure.Content` → `Disclosure.Body`) also carries `flex flex-col min-h-0` or `overflow: hidden` so the flex constraint propagates. The `<div>` on line 83 already has `flex flex-col min-h-0`. Check that it doesn't need an explicit `height: 0` fallback in the browser.

3. In `nutrition/MiddlePanel.js`, locate the cycles list and meals list — wrap each scrollable list container in `overflow-y-auto flex-1 min-h-0`.

4. In `nutrition/RightPanel.js` and both training counterparts, apply the same pattern to the food-items/exercises list containers.

5. The outer page layout (`clients/[id]/nutrition/page.js`) renders the three panels side by side in a flex row. Ensure the row container has `h-full overflow-hidden` and each panel column has `h-full min-h-0`.

---

### 1.2 — Empty States in Builders Should Have Surface

**Goal:** The "No plans yet" / "No days yet" / "No exercises" empty state blocks should be wrapped in `<Surface variant="secondary">` to match the design system. The panels already use `variant="secondary"` for nested info cards (e.g. the calorie card in `nutrition/MiddlePanel.js`). `Surface` is already imported in all panel files.

There are **7 empty states** to update across 5 files.

**The general pattern:**
```jsx
// BEFORE — plain div, no visual container
<div className="flex flex-col items-center justify-center ... py-12 text-center">
  ...content...
</div>

// AFTER — Surface wrapper, move layout classes onto it
<Surface variant="secondary" className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center mx-2 my-2">
  ...content...
</Surface>
```

---

**Step 1 — `training/LeftPanel.js` · Plans empty state (~line 141)**

Find:
```jsx
{plans.length === 0 ? (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
        <svg className="w-10 h-10 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <div>
            <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first training plan</p>
        </div>
        <Button variant="primary" onClick={handleCreatePlan}>
            + Create Plan
        </Button>
    </div>
```

Replace with:
```jsx
{plans.length === 0 ? (
    <Surface variant="secondary" className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center mx-2 my-2">
        <svg className="w-10 h-10 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <div>
            <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first training plan</p>
        </div>
        <Button variant="primary" onClick={handleCreatePlan}>
            + Create Plan
        </Button>
    </Surface>
```

---

**Step 2 — `training/LeftPanel.js` · Submitted Forms empty state (~line 247)**

Find:
```jsx
<div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <p className="text-xs font-medium text-muted-foreground">No submitted forms yet</p>
</div>
```

Replace with:
```jsx
<Surface variant="secondary" className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center mx-2 my-1">
    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <p className="text-xs font-medium text-muted-foreground">No submitted forms yet</p>
</Surface>
```

---

**Step 3 — `training/MiddlePanel.js` · No days empty state (~line 236)**

Find:
```jsx
{currentDays.length === 0 && (
    <div className="text-center py-10 text-sm text-muted-foreground">No days yet</div>
)}
```

Replace with:
```jsx
{currentDays.length === 0 && (
    <Surface variant="secondary" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
        <p className="text-sm text-muted-foreground">No days yet</p>
    </Surface>
)}
```

---

**Step 4 — `training/RightPanel.js` · No exercises empty state (~line 279)**

> The `!selectedDay` state at line ~45 is already a full `<Surface variant="default">` panel — leave it as-is.

Find:
```jsx
{(selectedDay.exercises ?? []).length === 0 && (
    <div className="text-center text-sm text-muted-foreground py-10">No exercises in this day yet</div>
)}
```

Replace with:
```jsx
{(selectedDay.exercises ?? []).length === 0 && (
    <Surface variant="secondary" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
        <p className="text-sm text-muted-foreground">No exercises in this day yet</p>
    </Surface>
)}
```

---

**Step 5 — `nutrition/LeftPanel.js` · Plans empty state (~line 142)**

Same as Step 1 but in the nutrition panel. Find the opening `<div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">` and its closing `</div>`, and apply the identical Surface wrapper.

---

**Step 6 — `nutrition/LeftPanel.js` · Submitted Forms empty state (~line 248)**

Same as Step 2 but in the nutrition panel. Find `<div className="flex flex-col items-center justify-center py-10 gap-2 text-center">` and apply the identical Surface wrapper.

---

**Step 7 — `nutrition/MiddlePanel.js` · No meals empty state (~line 370)**

Find:
```jsx
{selectedPlan.cycles.length === 0 ? (
    <p className="text-muted-foreground">No meals added yet.</p>
```

Replace with:
```jsx
{selectedPlan.cycles.length === 0 ? (
    <Surface variant="secondary" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
        <p className="text-sm text-muted-foreground">No meals added yet.</p>
    </Surface>
```

---

**Verification:**
1. Training builder → no plans: plans area shows a styled card with SVG + "Create Plan" button.
2. Training plan with no days: days area shows a card, not bare text.
3. Training day with no exercises: exercises area shows a card.
4. Repeat for Nutrition builder (no plans, no meals).
5. The empty state cards should visually match the calorie info card in the Nutrition MiddlePanel.

---

### 1.3 — Hover Color of Plan Cards in Builders

**Goal:** When hovering a plan card that is not selected, the background color should use a more visible/branded accent instead of the current `hover:bg-accent`.

**Files:**
- `nutrition/LeftPanel.js` line 161–167
- `training/LeftPanel.js` line 160–166

**Steps:**

1. Locate the plan card `<div>` with className:
   ```
   "hover:bg-accent border border-transparent"
   ```

2. Change `hover:bg-accent` to `hover:bg-primary/8` (or whatever token the design system uses for a subtle primary tint). Example:
   ```
   "hover:bg-primary/8 hover:border-primary/15 border border-transparent"
   ```

3. Also update the dot indicator `bg-border group-hover:bg-muted-foreground` → `group-hover:bg-primary/50` so the small dot tracks the card hover color.

4. Apply the identical change in `training/LeftPanel.js`.

---

### 1.4 — Disclosure Sections: Add X Padding to Title and Reduce Padding Between Sections

**Goal:** Each disclosure heading title needs horizontal padding so text doesn't sit flush against the panel edge. The vertical gap between adjacent disclosure sections should be tightened.

**Files:** All six panel files.

**Steps:**

1. **Title X padding** — Each `Disclosure.Heading` wraps a `<Button slot="trigger">` or a `<div>`. In `nutrition/LeftPanel.js`, the Plans heading `<Button>` has `px-0`. Change to `px-3`:
   ```jsx
   // Before
   className="flex-1 justify-start gap-2 px-0 data-hover:bg-transparent min-w-0"
   // After
   className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
   ```
   Do the same for the Form Submissions and Calorie Calculator heading buttons.

2. Apply the same `px-3` fix to all heading buttons in `training/LeftPanel.js`, and in all heading elements in the Middle and Right panels.

3. **Reduce padding between sections** — The `<Separator>` between disclosure sections currently uses `my-4`. Change to `my-2`:
   ```jsx
   // Before
   <Separator className="my-4" />
   // After
   <Separator className="my-2" />
   ```
   Apply in all panels that use a `<Separator>` between disclosures.

4. The `mb-4` inside each `Disclosure.Heading` (the bottom margin on the heading row) can also be reduced to `mb-2` to further tighten up vertical rhythm.

---

### 1.5 — Add Scroll Shadow to Builder Sections

**Goal:** Scrollable content areas inside disclosures should show a fade shadow at the top and bottom to signal more content is available. Replace every bare `overflow-y-auto` scroll container with HeroUI's `ScrollShadow`.

**Reference:** `https://heroui.com/docs/react/components/scroll-shadow`

**Files:** All six panel files.

**Total containers to update: 9**

---

**Step 0 — Import ScrollShadow in every panel file**

Add to each file's import block:
```js
import { ScrollShadow } from "@heroui/react/scroll-shadow";
```

Files that need this import:
- `client/app/components/nutrition/LeftPanel.js`
- `client/app/components/nutrition/MiddlePanel.js`
- `client/app/components/nutrition/RightPanel.js`
- `client/app/components/training/LeftPanel.js`
- `client/app/components/training/MiddlePanel.js`
- `client/app/components/training/RightPanel.js`

---

**Step 1 — `nutrition/LeftPanel.js` · Plans list (~line 141)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```
*(first occurrence — inside the plans Disclosure.Body)*

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 2 — `nutrition/LeftPanel.js` · Form submissions list (~line 241)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```
*(second occurrence — inside the form submissions Disclosure.Body)*

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 3 — `nutrition/LeftPanel.js` · Calorie calculator (~line 319)**

Find:
```jsx
<div className="overflow-y-auto flex-1 min-h-0">
```
*(note: class order differs from the other two)*

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 4 — `nutrition/MiddlePanel.js` · Meals list (~line 369)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 5 — `nutrition/RightPanel.js` · Food items list (~line 111)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 6 — `training/LeftPanel.js` · Plans list (~line 139)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```
*(first occurrence — plans Disclosure.Body)*

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 7 — `training/LeftPanel.js` · Form submissions list (~line 239)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```
*(second occurrence — form submissions Disclosure.Body)*

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 8 — `training/MiddlePanel.js` · Days list (~line 179)**

Find:
```jsx
<div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
```
*(this container carries flex layout classes — keep them)*

Replace with:
```jsx
<ScrollShadow className="flex flex-col gap-2 flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Step 9 — `training/RightPanel.js` · Exercises list (~line 116)**

Find:
```jsx
<div className="flex-1 overflow-y-auto min-h-0">
```

Replace with:
```jsx
<ScrollShadow className="flex-1 min-h-0" hideScrollBar>
```
Close tag: change `</div>` → `</ScrollShadow>`.

---

**Notes**

- `ScrollShadow` sets `overflow-y: auto` internally — do **not** keep `overflow-y-auto` on it.
- `hideScrollBar` hides the native scrollbar while keeping scrollability.
- If the shadow fade is too strong, add `offset={20}` or `size={20}` props to soften it.
- `min-h-0` is critical — without it the flex item won't shrink and scrolling never activates.

---

### 1.6 — Add "Load Plan" to Builders

**Goal:** Add a button in the Plans section of both builders that lets the coach load/import an existing plan from the workspace template library (or from another client) into the current client's builder.

**Files:**
- `nutrition/LeftPanel.js` — Plans heading action area (line 98–113)
- `training/LeftPanel.js` — Plans heading action area (line 96–111)

**Steps:**

1. In the heading action area next to the `+ Create Plan` button, add a `Load Plan` button:
   ```jsx
   <Button variant="outline" onClick={handleLoadPlan}>
       Load Plan
   </Button>
   ```

2. Add `handleLoadPlan` to the props list of `LeftPanel` in both files.

3. In the parent pages (`clients/[id]/nutrition/page.js` and `clients/[id]/training/page.js`), implement `handleLoadPlan`:
   - Open a modal that fetches plans from the workspace library endpoint (`GET /api/nutrition-plans/templates` or similar).
   - Let the coach pick a plan from the list.
   - On confirm, duplicate the selected plan and associate it with the current client.

4. Create a `LoadPlanModal` component (can live at `client/app/components/nutrition/LoadPlanModal.js` and a training equivalent) that:
   - Shows a searchable list of available plans.
   - On selection, calls the parent's `onLoad(planId)` callback.

---

## Phase 2 — Nutrition Builder: Calorie Cards & Calculator

Files in this phase:
- `client/app/components/nutrition/CycleCalculator.js`
- `client/app/components/nutrition/MiddlePanel.js`
- `client/app/components/nutrition/RightPanel.js`

---

### 2.1 — Enhance the Calories Cards

**Goal:** The cycle-level calorie/macro summary cards (shown in the Middle Panel for the selected cycle) should be visually upgraded — bigger numbers, progress rings or bars, cleaner layout.

**File:** `client/app/components/nutrition/MiddlePanel.js` — locate the section rendering calorie totals (currently using `<ProgressBar>` and raw numbers).

**Steps:**

1. Locate the calorie target display block (search for `ProgressBar` usage in the file).

2. Replace plain `<div>` + `<ProgressBar>` with HeroUI `<Card>` per macro:
   ```jsx
   <Card className="p-3 flex flex-col gap-1">
       <p className="text-xs text-muted-foreground">Calories</p>
       <p className="text-xl font-bold text-foreground">{calories}</p>
       <ProgressBar value={pct} color="primary" size="sm" />
   </Card>
   ```

3. Group the four macros (Calories, Protein, Carbs, Fat) in a `grid grid-cols-2 gap-2` or `grid grid-cols-4 gap-2`.

---

### 2.2 — Use HeroUI Meter in Calorie Target Card

**Goal:** Replace `ProgressBar` in the calorie target card with HeroUI `Meter` which has built-in color segments and label support.

**Reference:** `https://heroui.com/docs/react/components/meter#colors`

**File:** `client/app/components/nutrition/MiddlePanel.js`

**Steps:**

1. Import `Meter` from HeroUI:
   ```js
   import { Meter } from "@heroui/react/meter";
   ```

2. Replace each `<ProgressBar>` in the cycle calorie card with:
   ```jsx
   <Meter
       value={currentCalories}
       minValue={0}
       maxValue={targetCalories}
       color={currentCalories > targetCalories ? "danger" : "success"}
       label={`${currentCalories} / ${targetCalories} kcal`}
       showValueLabel
   />
   ```

3. Apply the same Meter replacement for Protein, Carbs, and Fat, using `color="warning"` for carbs, `color="primary"` for protein, `color="secondary"` for fat (adjust to match your design tokens).

---

### 2.3 — Use NumberField with Chevrons for Amount and Unit

**Goal:** Food item amount fields in the Right Panel should use HeroUI `NumberField` (with up/down chevrons) instead of raw `<input type="number">`.

**Reference:** `https://heroui.com/docs/react/components/number-field#with-chevrons`

**File:** `client/app/components/nutrition/RightPanel.js`

**Steps:**

1. Import `NumberField` from HeroUI:
   ```js
   import { NumberField } from "@heroui/react/number-field";
   ```

2. Locate each food item amount `<input type="number">` in the items list (search for `handleAmountChange`).

3. Replace with:
   ```jsx
   <NumberField
       value={item.amount}
       onChange={(val) => handleAmountChange(item.id, val)}
       minValue={0}
       step={1}
       formatOptions={{ maximumFractionDigits: 2 }}
       hideStepper={false}
       className="w-24"
   />
   ```

4. The unit (g, ml, etc.) should appear as a suffix label next to the `NumberField`. If HeroUI's `NumberField` supports an `endContent` prop, pass the unit string there. Otherwise, wrap the field and a unit `<span>` in a flex container.

---

### 2.4 — Use RadioGroup for Calorie Calculator Formula Selection

**Goal:** The BMR formula selector in `CycleCalculator.js` (currently likely a `<select>` or custom buttons) should use HeroUI's styled `RadioGroup` matching the "delivery/payment" card style.

**Reference:** `https://heroui.com/docs/react/components/radio-group#delivery--payment`

**File:** `client/app/components/nutrition/CycleCalculator.js`

**Steps:**

1. Import `RadioGroup` and `Radio` from HeroUI:
   ```js
   import { RadioGroup, Radio } from "@heroui/react/radio-group";
   ```

2. Locate the formula selection UI — the `ACTIVITY_LEVELS` array and the formula selector (Mifflin, Harris-Benedict, Katch-McArdle).

3. Replace the formula `<select>` with:
   ```jsx
   <RadioGroup
       label="BMR Formula"
       value={formula}
       onValueChange={setFormula}
       orientation="horizontal"
   >
       <Radio value="mifflin" description="Most accurate for general population">Mifflin-St Jeor</Radio>
       <Radio value="harris" description="Classic formula">Harris-Benedict</Radio>
       <Radio value="katch" description="Requires body fat %">Katch-McArdle</Radio>
   </RadioGroup>
   ```

4. Apply the card-style variant by adding `classNames={{ wrapper: "gap-3", label: "font-medium" }}` and using the card radio pattern from the HeroUI docs if available in your version.

---

## Phase 3 — Client Details Page

Files:
- `client/app/(coach)/[workspaceSlug]/layout.js` — the header with breadcrumbs
- `client/app/(coach)/[workspaceSlug]/clients/[id]/layout.js` — client-level tab layout
- `client/app/(coach)/[workspaceSlug]/clients/[id]/transactions/page.js` — transactions page

---

### 3.1 — Add Client Name and Client Code to the Header Path

**Goal:** When viewing any client sub-page (overview, nutrition, training, transactions, forms), the header breadcrumb should read:  
`Clients › [Client Name] (#CODE)` instead of just `Clients`.

**File:** `client/app/(coach)/[workspaceSlug]/layout.js`

**Steps:**

1. The `getPageInfo(pathname)` function on line 23 currently returns `{ crumbs: ['Clients'] }` for any path containing `/clients`. It doesn't have access to client data.

2. Convert the header to read client info from the URL. The `workspaceSlug` and client `id` are available from `useParams()` in the layout component (`WorkspaceLayout` on line 64).

3. Add state for the client name and code inside `WorkspaceLayout`:
   ```js
   const [clientInfo, setClientInfo] = useState(null);
   const params = useParams();
   const clientId = params.id ?? null;
   ```

4. Add a `useEffect` that fetches client info when `clientId` changes:
   ```js
   useEffect(() => {
       if (!clientId) { setClientInfo(null); return; }
       api.get(`/api/clients/${clientId}`)
           .then(res => setClientInfo(res.data))
           .catch(() => setClientInfo(null));
   }, [clientId]);
   ```

5. Modify `getPageInfo` to accept `clientInfo` as a second argument, or move the crumb assembly inline after calling it:
   ```js
   const { icon, crumbs: baseCrumbs } = getPageInfo(pathname);
   const crumbs = pathname.includes('/clients') && clientInfo
       ? ['Clients', `${clientInfo.fname} ${clientInfo.lname} (#${clientInfo.code})`]
       : baseCrumbs;
   ```

6. The last crumb is already styled as `font-medium text-foreground` in the header render loop, so the client name will appear bold and the `(#CODE)` will be part of the same string. If you want the code to be styled differently (e.g., muted), split it into two separate crumbs or add a custom render for the last crumb.

---

### 3.2 — Transactions Page: Replace Custom Table with DataTable

**Goal:** The raw `<table>` in `transactions/page.js` (line 514–599) should be replaced with the project's `DataTable` component to match the design system — consistent sorting, filtering, search, pagination, and row styling.

**File:** `client/app/(coach)/[workspaceSlug]/clients/[id]/transactions/page.js`

**Steps:**

1. Import `DataTable` at the top:
   ```js
   import DataTable from "@/app/components/DataTable";
   ```

2. Define a `columns` array mapping to the existing data fields:
   ```js
   const columns = [
       { key: "date",             label: "Tx Date",       sortable: true, type: "date" },
       { key: "subscriptionStart",label: "Sub Start",     sortable: true },
       { key: "subStatus",        label: "Sub Status" },
       { key: "packageVariation", label: "Package",       sortable: true },
       { key: "amount",           label: "Amount",        sortable: true, type: "number" },
       { key: "duration",         label: "Duration",      sortable: true, type: "number" },
       { key: "paymentMethod",    label: "Method",        sortable: true },
       { key: "type",             label: "Type" },
       { key: "status",           label: "Pay Status" },
       { key: "proof",            label: "Proof" },
       { key: "actions",          label: "" },
   ];
   ```

3. Map `transactions` to a `rows` array, computing `subStatus` using the existing `getPerTxStatus` function, and adding a `proof` field and an `actions` renderer.

4. Replace the `<div className="overflow-x-auto rounded-lg border border-border">` block with:
   ```jsx
   <DataTable
       columns={columns}
       data={rows}
       rowKey="id"
       defaultSort="date"
       defaultSortDirection="desc"
       quickSearch
   />
   ```

5. Use DataTable's `renderExpandedRow` or custom cell renderers (check DataTable's API in `DataTable.js`) to inject the `<StatusBadge>`, proof link, and Edit/Refund/Delete action buttons.

6. Remove the old `<table>` JSX block (lines 514–600) and the empty-state fallback `<div>` (line 511–513) — `DataTable` handles empty states internally.

---

## Phase 4 — Sidebar

File: `client/app/components/Sidebar.js`

---

### 4.1 — Skeleton / Spinner on All Loader Pages

**Goal:** All pages that have a loading state should use a single consistent shimmer skeleton (not an ad-hoc mix of Skeleton and plain divs). Alternatively, switch to a centered Spinner for instant feedback.

**Reference:** `https://heroui.com/docs/react/components/skeleton`

**Steps:**

1. Create a shared `PageSkeleton` component at `client/app/components/PageSkeleton.js`:
   ```jsx
   import { Skeleton } from "@heroui/react/skeleton";
   export default function PageSkeleton({ rows = 5 }) {
       return (
           <div className="p-6 flex flex-col gap-3">
               <Skeleton className="h-8 w-48 rounded-xl" />
               {Array.from({ length: rows }).map((_, i) => (
                   <Skeleton key={i} className="h-12 rounded-xl" />
               ))}
           </div>
       );
   }
   ```

2. Find every `loading.js` file across the coach routes:
   - `clients/loading.js`
   - `clients/[id]/loading.js`
   - `clients/[id]/nutrition/loading.js`
   - `clients/[id]/training/loading.js`
   - `clients/[id]/forms/loading.js`
   - `finance/transactions/loading.js` (if it exists)
   - etc.

3. Replace each loading file's content with:
   ```jsx
   import PageSkeleton from "@/app/components/PageSkeleton";
   export default function Loading() { return <PageSkeleton />; }
   ```

4. For inline loading states inside pages (e.g., `if (loading) return <div>...Skeleton...</div>`), replace with `<PageSkeleton rows={3} />` or a `<Spinner size="lg" />` from HeroUI centered in the page.

---

### 4.2 — Badge on Plans Queue Nav Item

**Goal:** The "Plans Queue" sidebar link should show a numbered badge with the count of pending/unreviewed queue items.

**Reference:** `https://heroui.com/docs/react/components/badge#with-content`

**File:** `client/app/components/Sidebar.js`

**Steps:**

1. Import `Badge` from HeroUI:
   ```js
   import { Badge } from "@heroui/react/badge";
   ```

2. Add state for the queue count:
   ```js
   const [queueCount, setQueueCount] = useState(0);
   ```

3. In the existing `useEffect` that fetches user data, add:
   ```js
   api.get('/api/forms/queue/count')   // adjust to your actual endpoint
       .then(res => setQueueCount(res.data?.count ?? 0))
       .catch(() => {});
   ```
   If no dedicated count endpoint exists, you may fetch the queue list and use `.length`.

4. Locate the Plans Queue nav link in the sidebar JSX (search for `plans-queue`). Wrap the icon or the link label with:
   ```jsx
   <Badge content={queueCount} color="danger" isInvisible={queueCount === 0} size="sm">
       <ClipboardList size={16} />
   </Badge>
   ```

---

### 4.3 — Dark/Light Mode Toggle with Icons

**Goal:** Replace the existing dark mode toggle (in `ThemeToggle.js` or wherever it lives in the sidebar) with HeroUI's `Switch` component with sun/moon icons.

**Reference:** `https://heroui.com/docs/react/components/switch#with-icons`

**File:** `client/app/components/ThemeToggle.js` + `Sidebar.js`

**Steps:**

1. Open `ThemeToggle.js` to see the current implementation.

2. Import `Switch` from HeroUI and sun/moon icons from `lucide-react`:
   ```js
   import { Switch } from "@heroui/react/switch";
   import { Sun, Moon } from "lucide-react";
   ```

3. Replace whatever toggle element exists with:
   ```jsx
   <Switch
       isSelected={theme === "dark"}
       onValueChange={(val) => setTheme(val ? "dark" : "light")}
       thumbIcon={({ isSelected }) => isSelected ? <Moon size={12} /> : <Sun size={12} />}
       size="sm"
   />
   ```

4. Adjust `setTheme` to whatever the current theme-switching mechanism is (e.g., `next-themes`'s `setTheme`).

---

### 4.4 — Add Client Portal Link Next to Workspaces in Sidebar

**Goal:** Below or next to the workspace switcher section at the top of the sidebar, add a direct link to the client-facing portal.

**File:** `client/app/components/Sidebar.js`

**Steps:**

1. Locate the workspace switcher block (the `ref={wsRef}` dropdown area near the top of the sidebar JSX).

2. Below the workspace switcher button, add:
   ```jsx
   <Link
       href={`/portal/${workspaceSlug}`}
       target="_blank"
       className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
   >
       <ExternalLink size={13} />
       Client Portal
   </Link>
   ```
   Import `ExternalLink` from `lucide-react` and get `workspaceSlug` from the user state.

---

## Phase 5 — Global: Data Tables

File: `client/app/components/DataTable.js`

---

### 5.1 — Use SearchField Instead of Plain Input in Quick Search

**Goal:** The quick-search input in the DataTable header should use HeroUI's `SearchField` component (already imported on line 15) instead of a raw `<input>`.

**File:** `client/app/components/DataTable.js`

**Steps:**

1. `SearchField` is already imported. Locate the quick-search input JSX (search for `quickSearchValue`).

2. Replace the raw `<input>` or `<TextField>` with `<SearchField>`:
   ```jsx
   <SearchField
       value={quickSearchValue}
       onChange={setQuickSearchValue}
       onClear={() => setQuickSearchValue("")}
       placeholder="Quick search…"
       size="sm"
   />
   ```

3. Remove the custom `<Kbd>` inline wrapper if `SearchField` provides its own end-content slot, or pass the `<Kbd>` as `endContent`:
   ```jsx
   <SearchField endContent={<Kbd keys={["ctrl"]}>K</Kbd>} ... />
   ```

---

### 5.2 — Fix Ctrl+K Shortcut (Was Cmd+K)

**Goal:** The keyboard shortcut to focus the quick-search should be Ctrl+K on all platforms, not Cmd+K.

**File:** `client/app/components/DataTable.js` line ~60

**Steps:**

1. Find the `handleKeyDown` function inside the `useEffect` for `quickSearch`:
   ```js
   if (e.ctrlKey && e.key === "k") {
   ```

2. It already uses `e.ctrlKey` — verify the `<Kbd>` display label also says `Ctrl` not `⌘`. If it shows `⌘`, change the `<Kbd keys={["command"]}>` to `<Kbd keys={["ctrl"]}>`.

---

### 5.3 — Row Click Should NOT Select — Only Checkbox Should

**Goal:** Clicking a row in the clients table should navigate to the client detail page. Only clicking the checkbox column should toggle row selection.

**Files:**
- `client/app/components/DataTable.js` — the row click handler
- `client/app/(coach)/[workspaceSlug]/clients/page.js` — the table usage

**Steps:**

1. In `DataTable.js`, locate where row clicks trigger selection (search for `onSelectionChange` and the row `onClick` handler).

2. Modify the row `onClick` to do nothing (or call a passed-in `onRowClick` callback for navigation), and only call `onSelectionChange` from the checkbox cell's `onChange`.

3. In `clients/page.js`, pass an `onRowClick` prop to `DataTable` that navigates to the client detail page:
   ```jsx
   onRowClick={(row) => router.push(`/${workspaceSlug}/clients/${row.id}`)}
   ```

4. In `DataTable.js`, add an `onRowClick` prop and wire it to the `<tr onClick>`.

5. Prevent the checkbox cell click from bubbling to the row `onClick` by calling `e.stopPropagation()` in the checkbox cell.

---

### 5.4 — Max Rows Selector: Move and Restyle

**Goal:** The "rows per page" selector should be moved to a more logical location (e.g., bottom-left near pagination) and restyled using HeroUI Tabs for the size options.

**Reference:** `https://heroui.com/docs/react/components/tabs#custom-styles`

**File:** `client/app/components/DataTable.js`

**Steps:**

1. Find the current rows-per-page UI (search for `pageSize` or `rowsPerPage`).

2. Move it to the bottom bar of the table, next to the `<Pagination>` component.

3. Replace it with HeroUI `Tabs` styled as pills:
   ```jsx
   <Tabs
       selectedKey={String(pageSize)}
       onSelectionChange={(key) => setPageSize(Number(key))}
       size="sm"
       variant="solid"
       classNames={{ tabList: "gap-1" }}
   >
       {[10, 25, 50].map(n => (
           <Tab key={String(n)} title={String(n)} />
       ))}
   </Tabs>
   ```

---

### 5.5 — Sorting Icons: Replace with Design System Icons

**Goal:** The sort direction arrows in column headers should use consistent HeroUI-compatible icons (or Lucide icons) instead of any custom or emoji arrows.

**File:** `client/app/components/DataTable.js`

**Steps:**

1. Import `ArrowUp`, `ArrowDown`, `ArrowUpDown` from `lucide-react`.

2. Find all sort icon renders in the column header JSX. Replace with:
   ```jsx
   {sortKey === col.key
       ? (sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
       : <ArrowUpDown size={13} className="text-muted-foreground/40" />
   }
   ```

---

### 5.6 — Enhance Filtering Section

**Goal:** The filter dropdown area should use multi-select (without a search field) for filter values.

**Reference:** `https://heroui.com/docs/react/components/select` (multiple)

**File:** `client/app/components/DataTable.js`

**Steps:**

1. Find the filter UI (search for `filter` state or `ListBox` usage).

2. For each filterable column, replace single-select dropdowns with HeroUI `Select` in `selectionMode="multiple"`:
   ```jsx
   <Select
       selectionMode="multiple"
       selectedKeys={activeFilters[col.key] ?? new Set()}
       onSelectionChange={(keys) => setFilter(col.key, keys)}
       placeholder={`Filter ${col.label}…`}
       size="sm"
   >
       {uniqueValues(col.key).map(val => (
           <SelectItem key={val}>{val}</SelectItem>
       ))}
   </Select>
   ```

3. Remove any search field from inside the filter dropdown — just show the value list directly.

---

## Phase 6 — Global: Modals & Dialogs

---

### 6.1 — Alert Dialogs for Destructive Actions

**Goal:** Replace `window.confirm()` calls and unconfirmed delete/action buttons throughout the app with HeroUI `AlertDialog`.

**Reference:** `https://heroui.com/docs/react/components/alert-dialog`

**Files to update:**
- `clients/[id]/transactions/page.js` — `handleDelete`, `handleRefund` (lines 281–297)
- `Sidebar.js` — `handleLogout`
- Any other page with delete actions

**Steps:**

1. Import `AlertDialog` from HeroUI:
   ```js
   import { AlertDialog } from "@heroui/react/alert-dialog";
   ```

2. Add state for the dialog in each affected component:
   ```js
   const [alertOpen, setAlertOpen] = useState(false);
   const [pendingAction, setPendingAction] = useState(null);
   ```

3. Replace `window.confirm("Delete this transaction?")` with:
   ```jsx
   // Trigger
   <AlertDialog
       open={alertOpen}
       onOpenChange={setAlertOpen}
       title="Delete Transaction"
       description="This action cannot be undone. The transaction will be permanently removed."
       actionLabel="Delete"
       actionColor="danger"
       onAction={() => { execDelete(pendingAction); setAlertOpen(false); }}
   />
   ```
   And change the delete button to: `onClick={() => { setPendingAction(tx); setAlertOpen(true); }}`

4. Apply the same pattern to:
   - Sign out button in `Sidebar.js`
   - Discard changes (wherever unsaved-change warnings appear)
   - Complete task actions
   - Reset password actions
   - Any `window.confirm()` or inline confirm patterns

---

### 6.2 — Fluid Slide Animations in Dialogs

**Goal:** All modals and alert dialogs should animate with a fluid slide-in effect.

**Reference:** `https://heroui.com/docs/react/components/alert-dialog#custom-animations`

**Files:** `client/app/components/Modal.js` and all alert dialog usages.

**Steps:**

1. Open `Modal.js` to see the current modal wrapper. Check if it uses HeroUI `Modal` or a custom implementation.

2. If using HeroUI `Modal`, add motion props:
   ```jsx
   <Modal
       motionProps={{
           variants: {
               enter: { y: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
               exit:  { y: 20, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
           }
       }}
   />
   ```

3. Apply the same `motionProps` to all `AlertDialog` instances via a shared wrapper or a helper constant.

---

### 6.3 — Unify All Modals

**Goal:** All modals across the app (add/edit/delete flows) should share the same visual style — consistent header, footer, padding, and max-width.

**File:** `client/app/components/Modal.js`

**Steps:**

1. Review `Modal.js` to confirm it uses HeroUI `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`.

2. Set consistent defaults in the wrapper:
   - `size="md"` (or `"lg"` where content is dense)
   - `scrollBehavior="inside"` so long forms scroll inside the modal
   - `placement="center"`

3. Export a `ModalFooter` pattern with a primary action button on the left and a ghost "Cancel" on the right (or whichever side the design specifies).

4. Audit all usages of `<Modal>` across the app and remove any per-instance size/padding overrides that deviate from the standard.

---

### 6.4 — Unify Action Icons in Tables and Builders

**Goal:** Edit, Delete, Duplicate, and other action buttons across all tables and builders should use the same icon set, size, and button variant.

**Reference:** `https://heroui.com/docs/react/components/button#icon-only`

**Files:** `DataTable.js`, all LeftPanel files, `transactions/page.js`, and any other page with row actions.

**Steps:**

1. Establish a standard: use HeroUI `Button` with `isIconOnly`, `variant="ghost"`, `size="sm"` for all inline action buttons.

2. Use Lucide icons consistently:
   - Edit → `<Pencil size={14} />`
   - Delete → `<Trash2 size={14} />`
   - Duplicate → `<Copy size={14} />`
   - View → `<Eye size={14} />`

3. Replace text-based action links (`"Edit"`, `"Delete"`, `"Refund"`) in `transactions/page.js` (lines 573–592) with icon-only buttons using tooltip labels via HeroUI `Tooltip`.

4. In `LeftPanel` files (both builders), the duplicate/delete icon buttons on plan cards already use custom SVGs — replace with Lucide `<Copy>` and `<Trash2>`.

---

## Phase 7 — Global: Forms & Inputs

---

### 7.1 — Use InputGroup for Price Fields

**Goal:** Any field where the user enters a monetary amount should use HeroUI `InputGroup` with the currency symbol as a prefix.

**Reference:** `https://heroui.com/docs/react/components/input-group#with-prefix-and-suffix`

**Files:**
- `finance/packages/page.js` — package price inputs
- `clients/[id]/transactions/page.js` — any editable amount field (currently read-only from package)

**Steps:**

1. Import `InputGroup`, `Input` from HeroUI.

2. Replace raw `<input type="number">` price fields with:
   ```jsx
   <InputGroup>
       <InputGroup.Addon>{currency || "EGP"}</InputGroup.Addon>
       <Input type="number" value={price} onChange={...} min={0} step={0.01} />
   </InputGroup>
   ```

3. Apply to every price/amount input found across the app.

---

### 7.2 — Use InputGroup for Tempo Fields in Training Builder

**Goal:** Exercise tempo fields (eccentric/isometric/concentric/rest counts) should use `InputGroup` with a label prefix.

**File:** `client/app/components/training/RightPanel.js` — exercise detail form.

**Steps:**

1. Find the tempo input(s) in the training Right Panel.

2. Wrap each with:
   ```jsx
   <InputGroup>
       <InputGroup.Addon>Tempo</InputGroup.Addon>
       <Input value={tempo} onChange={...} placeholder="3-1-2-0" />
   </InputGroup>
   ```

---

### 7.3 — Add External Links to Quick-Add in Builders

**Goal:** In each builder, next to dropdowns/modals that let the coach pick exercises, food categories, or equipment, add a small external link icon that opens the relevant management page in a new tab.

**Files:**
- `nutrition/FoodItemsModal.js` — add link to food-categories management
- `training/ExercisePickerModal.js` — add link to exercises management and equipment management

**Steps:**

1. Import `ExternalLink` from `lucide-react`.

2. In `FoodItemsModal.js`, next to the food category filter dropdown, add:
   ```jsx
   <a href={`/${workspaceSlug}/nutrition/food-categories`} target="_blank" rel="noreferrer"
      className="text-muted-foreground hover:text-primary transition-colors">
       <ExternalLink size={13} />
   </a>
   ```

3. In `ExercisePickerModal.js`, add similar links next to the exercise search heading and equipment filter.

---

## Phase 8 — Global: Team Members

---

### 8.1 — Avatars for Team Members (Gradient Style)

**Goal:** Wherever team members are displayed (team page, assigned-coach dropdowns), show HeroUI `Avatar` with gradient background initials instead of plain text.

**Reference:** `https://heroui.com/docs/react/components/avatar`

**Files:** `team/page.js`, any coach-assignment dropdowns.

**Steps:**

1. Import `Avatar` from HeroUI:
   ```js
   import { Avatar } from "@heroui/react/avatar";
   ```

2. Render each team member as:
   ```jsx
   <Avatar
       name={`${member.fname} ${member.lname}`}
       color="gradient"
       size="md"
       isBordered
   />
   ```

3. If the member has a profile photo, pass `src={member.avatarUrl}` and the gradient fallback will still show if the image fails.

---

### 8.2 — Team Member Avatar Dropdown for Selection

**Goal:** In places where a team member is assigned (e.g., assigning a coach to a client), show a dropdown of team members using their avatar + name.

**Steps:**

1. Use HeroUI `Select` with custom `renderValue` and item rendering to show an `<Avatar>` + name row for each option.

2. Example:
   ```jsx
   <Select
       label="Assign Coach"
       renderValue={(items) => items.map(item => (
           <div key={item.key} className="flex items-center gap-2">
               <Avatar name={item.data.name} size="sm" color="gradient" />
               <span>{item.data.name}</span>
           </div>
       ))}
   >
       {teamMembers.map(m => (
           <SelectItem key={m.id} textValue={`${m.fname} ${m.lname}`} data={{ name: `${m.fname} ${m.lname}` }}>
               <div className="flex items-center gap-2">
                   <Avatar name={`${m.fname} ${m.lname}`} size="sm" color="gradient" />
                   <span>{m.fname} {m.lname}</span>
               </div>
           </SelectItem>
       ))}
   </Select>
   ```

---

## Phase 9 — Global: Miscellaneous

---

### 9.1 — Change Logo in Dark Mode

**Goal:** The sidebar logo should switch to a light/inverted version when dark mode is active.

**File:** `client/app/components/Sidebar.js`

**Steps:**

1. Locate the `<NextImage>` logo render in `Sidebar.js` (search for `NextImage` or `logo`).

2. Use `next-themes` `useTheme()` to read the current theme:
   ```js
   import { useTheme } from "next-themes";
   const { resolvedTheme } = useTheme();
   ```

3. Switch the `src` based on theme:
   ```jsx
   <NextImage
       src={resolvedTheme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
       alt="FitForce X"
       width={120}
       height={32}
   />
   ```

4. Add the dark-mode logo asset to `client/public/`.

---

### 9.2 — Add Default Nutrition and Training Databases on New Accounts

**Goal:** When a new workspace is created, seed it with a default set of food categories, food items, exercises, muscle groups, and equipment.

**Files:** Server-side — the workspace creation endpoint in the Express API.

**Steps:**

1. Find the workspace creation route (likely `server/routes/workspaces.js` or `server/controllers/workspacesController.js`).

2. After the workspace record is inserted, call a `seedDefaults(workspaceId)` function that bulk-inserts:
   - Default muscle groups (Chest, Back, Shoulders, etc.)
   - Default equipment (Barbell, Dumbbell, Cable, etc.)
   - Default food categories (Protein, Vegetables, Grains, etc.)

3. Create a `server/seeds/defaultData.js` file that exports these arrays, and the `seedDefaults` function that runs the inserts in a transaction.

---

### 9.3 — Arabic Version

**Goal:** Add RTL Arabic language support across the app.

**Steps:**

1. Install `next-intl` or use Next.js built-in i18n routing to support `ar` locale.

2. Set `dir="rtl"` on the `<html>` element when locale is Arabic.

3. Add `ar.json` translation file under `client/locales/` with all UI string keys.

4. Wrap text-rendering components and layout containers to respect `text-align: start` (which flips automatically with RTL).

5. Test sidebar, builder panels, table headers, and modals in RTL.

---

### 9.4 — Subscription Logic Audit

**Goal:** Review and verify the subscription timeline and status calculation logic.

**Files:**
- `clients/[id]/transactions/page.js` — `computeTimeline`, `getPerTxStatus`
- Server-side subscription status calculation (if any)

**Steps:**

1. Map out all subscription states: Active, Pre-start, Expired, Frozen, Refunded, No Subscription.

2. Write unit tests for `computeTimeline` covering edge cases:
   - Multiple queued transactions
   - Freeze overlapping subscription end
   - Custom start dates
   - On-first-plan activation mode

3. Verify the logic for `getPerTxStatus` returns the correct state for each combination.

4. Cross-check that freeze days are correctly added to the end date when the freeze falls within the active period.

---

### 9.5 — Client Portal Enhancement

**Goal:** Improve the client-facing portal at `client/app/(client)/portal/`.

**Steps:** (To be defined after a UI review of the portal pages.)

1. Audit `portal/dashboard/page.js`, `portal/training/page.js`, `portal/measurements/page.js`.

2. Apply HeroUI design tokens (Surface, Card, Typography) consistently.

3. Ensure mobile-first layout since clients typically access on phone.

4. Add empty states and loading skeletons consistent with the coach app patterns.
