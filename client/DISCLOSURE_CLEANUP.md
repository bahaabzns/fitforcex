# DisclosureGroup Migration — Cleanup Plan

## Status of migrated files

The four files targeted in the original migration are already clean:

| File | Old state refs | ChevronIcon | data-[hover] | Status |
|------|---|---|---|---|
| `nutrition/LeftPanel.js` | None | None | None | ✅ Done |
| `nutrition/MiddlePanel.js` | None | None | None | ✅ Done |
| `training/LeftPanel.js` | None | None | None | ✅ Done |
| `training/MiddlePanel.js` | None | None | None | ✅ Done |

---

## Remaining files that still use the old pattern

Three files were out of scope for the original migration but use the same manual
collapsed-state + ChevronIcon pattern. Each needs the same treatment.

---

## Step 1 — `forms/FormsPanel.js`

Simplest file. One section, no nested accordion, no flex-grow trick.

**Changes:**

### 1a. Add import
```js
// Before (line 2)
import { Button } from "@heroui/react/button";

// After
import { Button } from "@heroui/react/button";
import { Disclosure, DisclosureGroup } from "@heroui/react";
```
> No `Separator` needed — only one section.

### 1b. Replace state
```js
// Remove (line 56)
const [formsCollapsed, setFormsCollapsed] = useState(false);

// Add
const [expandedKeys, setExpandedKeys] = useState(new Set(["forms"]));
```

### 1c. Wrap card body
```jsx
// After the card opening div (line 59)
<div className="card w-full flex flex-col overflow-hidden min-h-full">
  <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">
    {/* … sections … */}
  </DisclosureGroup>
</div>
```

### 1d. Convert the Forms section (lines 61–144)

**Before:**
```jsx
<div className="flex flex-col min-h-0" style={{ flex: formsCollapsed ? "0 0 auto" : "1 1 0" }}>
  <div className="flex items-center gap-3 mb-4 shrink-0">
    <button onClick={() => setFormsCollapsed(c => !c)}>
      <ChevronIcon up={!formsCollapsed} />
    </button>
    <h2 ...>Forms <span>{forms.length}</span></h2>
    {!formsCollapsed && (
      <Button variant="primary" onClick={handleCreateForm}>+ New Form</Button>
    )}
  </div>
  {!formsCollapsed && (
    <>
      {/* Sort Pills */}
      {/* Form List */}
    </>
  )}
</div>
```

**After:**
```jsx
<div className="flex flex-col min-h-0" style={{ flex: expandedKeys.has("forms") ? "1 1 0" : "0 0 auto" }}>
  <Disclosure id="forms">
    <Disclosure.Heading>
      <div className="flex items-center gap-2 w-full mb-4">
        <Button
          slot="trigger"
          variant="ghost"
          className="flex-1 justify-start gap-2 px-0 data-hover:bg-transparent min-w-0"
        >
          <h2 className="text-base font-semibold text-foreground">
            Forms
            <span className="ml-2 text-xs font-normal text-muted-foreground">{forms.length}</span>
          </h2>
          <Disclosure.Indicator />
        </Button>
        {expandedKeys.has("forms") && (
          <Button variant="primary" onClick={handleCreateForm} className="shrink-0">
            + New Form
          </Button>
        )}
      </div>
    </Disclosure.Heading>
    <Disclosure.Content>
      <Disclosure.Body className="flex flex-col flex-1 min-h-0 px-0 pt-0">
        {/* Sort Pills — unchanged */}
        {/* Form List — unchanged */}
      </Disclosure.Body>
    </Disclosure.Content>
  </Disclosure>
</div>
```

### 1e. Remove `ChevronIcon` component (lines 19–23)

---

## Step 2 — `training/RightPanel.js`

Two sections: Exercises (with nested set grids) and Notes. Also has `exercisesCollapsed` which controls a flex-grow layout.

**Changes:**

### 2a. Add import
```js
// Before (line 3)
import { Button } from "@heroui/react/button";

// After
import { Button } from "@heroui/react/button";
import { Disclosure, DisclosureGroup, Separator } from "@heroui/react";
```

### 2b. Replace state (lines 44–45)
```js
// Remove
const [notesOpen, setNotesOpen] = useState(false);
const [exercisesCollapsed, setExercisesCollapsed] = useState(false);

// Add
const [expandedKeys, setExpandedKeys] = useState(new Set(["exercises"]));
// notesOpen started false (open) → include "notes" in initial Set if you want notes open by default
// Review: notesOpen=false means textarea was HIDDEN (inverted name like training/MiddlePanel)
// → do NOT include "notes" in initial set, matching the original closed default
```

> **Note on `notesOpen`:** Like the `training/MiddlePanel` bug, `notesOpen` is inverted — `false` meant hidden (closed). Verify the desired default: if notes should start collapsed, omit `"notes"` from the initial Set.

### 2c. Wrap collapsible sections in `DisclosureGroup`

The `training/RightPanel` card structure:
```
<div class="card">
  <div> {/* day name + close button — non-collapsible header */} </div>
  
  {/* DisclosureGroup wraps Exercises + Notes */}
  
</div>
```

Wrap after the day name header closing `</div>`, before the Exercises section.

### 2d. Convert Exercises section (around lines 96–116)

**Before:**
```jsx
<div className="flex flex-col min-h-0" style={{ flex: exercisesCollapsed ? "0 0 auto" : "1 1 0" }}>
  <div className="flex items-center gap-3 mb-3 shrink-0">
    <button onClick={() => setExercisesCollapsed(v => !v)}>
      <ChevronIcon up={!exercisesCollapsed} />
    </button>
    <h3>Exercises <span>{count}</span></h3>
    {!exercisesCollapsed && <Button>+ Add Exercise</Button>}
  </div>
  {!exercisesCollapsed && <div>{/* exercise list */}</div>}
</div>
```

**After:**
```jsx
<div className="flex flex-col min-h-0" style={{ flex: expandedKeys.has("exercises") ? "1 1 0" : "0 0 auto" }}>
  <Disclosure id="exercises">
    <Disclosure.Heading>
      <div className="flex items-center gap-2 w-full mb-3">
        <Button slot="trigger" variant="ghost" className="flex-1 justify-start gap-2 px-0 data-hover:bg-transparent min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            Exercises
            <span className="ml-2 text-xs font-normal text-muted-foreground">{count}</span>
          </h3>
          <Disclosure.Indicator />
        </Button>
        {expandedKeys.has("exercises") && (
          <Button variant="primary" onClick={...} className="shrink-0">+ Add Exercise</Button>
        )}
      </div>
    </Disclosure.Heading>
    <Disclosure.Content>
      <Disclosure.Body className="flex-1 min-h-0 overflow-y-auto px-0 pt-0">
        {/* exercise list — unchanged */}
      </Disclosure.Body>
    </Disclosure.Content>
  </Disclosure>
</div>
```

### 2e. Add `<Separator className="my-2" />` between sections

### 2f. Convert Notes section (around lines 285–300)

**Before:**
```jsx
<div className="flex flex-col shrink-0">
  <div className="flex items-center gap-3 mb-3">
    <button onClick={() => setNotesOpen(v => !v)}>
      <ChevronIcon up={!notesOpen} />
    </button>
    <h3>Notes</h3>
  </div>
  {notesOpen && <textarea ... />}
</div>
```

**After:**
```jsx
<Disclosure id="notes">
  <Disclosure.Heading>
    <Button slot="trigger" variant="ghost" className="w-full justify-start gap-2 px-0 mb-3 data-hover:bg-transparent">
      <h3 className="text-base font-semibold text-foreground flex-1 text-left">Notes</h3>
      <Disclosure.Indicator />
    </Button>
  </Disclosure.Heading>
  <Disclosure.Content>
    <Disclosure.Body className="px-0 pt-0">
      <textarea ... />
    </Disclosure.Body>
  </Disclosure.Content>
</Disclosure>
```

### 2g. Remove `ChevronIcon` component (lines 20–24)

---

## Step 3 — `nutrition/RightPanel.js`

Three sections: Items (food items list), a nested accordion inside Items (alternatives per item), and Notes.

### 3a. Add import
```js
import { Button } from "@heroui/react/button";
import { Disclosure, DisclosureGroup, Separator } from "@heroui/react";
```

### 3b. Replace state (lines 24–25)
```js
// Remove
const [itemsCollapsed, setItemsCollapsed] = useState(false);
const [notesCollapsed, setNotesCollapsed] = useState(false);

// Add
const [expandedKeys, setExpandedKeys] = useState(new Set(["items", "notes"]));
// Both started false (open) → both included in initial Set
```

### 3c. Replace the nested alternatives accordion

`nutrition/RightPanel.js` also has a per-item expand/collapse for **alternatives** (similar to the form submissions accordion in LeftPanel), using `expandedItemId`:

```js
// Current state (keep this — it drives the nested accordion)
const [expandedItemId, setExpandedItemId] = useState(null);
```

This should be converted to a nested `DisclosureGroup` exactly like the form submissions rows were converted in Step 7 of the original guide:

```jsx
<DisclosureGroup>
  {items.map(item => (
    <Disclosure key={item.id} id={String(item.id)} className="...">
      <Disclosure.Heading>
        <Button slot="trigger" ...>{item.name} <Disclosure.Indicator /></Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>{/* alternatives list */}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  ))}
</DisclosureGroup>
```

After converting, remove the `expandedItemId` state and its setter.

### 3d. Convert Items section

Same structure as the Exercises section in Step 2d. The flex-grow wrapper and Disclosure.Heading with the "+ Add Item" action button follow the established pattern.

### 3e. Add `<Separator className="my-2" />` between sections

### 3f. Convert Notes section

Same structure as Notes in Step 2f — no action buttons, simple trigger + textarea.

> **No `ChevronIcon` to remove** — `nutrition/RightPanel.js` uses inline SVGs in section headers rather than a shared component. These inline SVGs are removed as part of converting each section header.

---

## Step 4 — Surface component

### Background

HeroUI's `Surface` (`SurfaceRoot`) renders a `div` with a variant-based background and
provides `SurfaceContext` to all descendants. The four variants map to design tokens:

| Variant | CSS | When to use |
|---------|-----|-------------|
| `default` | `bg-surface` | Outermost container — the panel itself |
| `secondary` | `bg-surface-secondary` | Inset boxes inside a panel |
| `tertiary` | `bg-surface-tertiary` | Deeper nesting (rare) |
| `transparent` | `bg-transparent` | Pass-through, no background |

The existing `.card` class (used by every panel today) already applies `bg-surface`,
`shadow-surface`, padding, and border-radius. So the panels are already visually correct;
the question is whether to formalize that with the React component.

---

### Recommendation: Surface per **panel**, not per section

**Use `<Surface variant="default">` as the outer wrapper of each panel** (replacing
`<div className="card ...">`), and leave sections transparent inside.

**Do not** wrap individual sections in their own `<Surface>`. Here is why:

1. **Sections are not separate elevation levels.** The Plans section and the Form
   Submissions section inside LeftPanel live at the same visual depth — they are
   subdivisions of one panel, not independent cards. Giving each its own surface
   background would create a "cards-inside-a-card" look that adds visual noise without
   adding hierarchy.

2. **`SurfaceContext` propagates correctly at panel level.** HeroUI components that
   read `SurfaceContext` (e.g. inputs, buttons styled relative to their surface) need
   to know they are on a `default` surface. Setting this once on the panel wrapper is
   sufficient — all descendants inherit it without each section needing its own context.

3. **The flex-grow layout trick would fight per-section surfaces.** The wrapper divs
   around each `Disclosure` use `style={{ flex: "1 1 0" }}` when open and
   `"0 0 auto"` when closed. A `Surface` at that level would need matching flex
   behaviour, adding unnecessary complexity.

4. **`Separator` already provides visual section boundaries.** Adding backgrounds
   on top would be redundant.

---

### Where Surface is appropriate inside a panel

The **cycle stats box** in `nutrition/MiddlePanel.js` (lines ~202–249 in the original,
now inside the plan-header block) is a genuine inset card — a summary widget that should
visually "sit on top of" the panel. Replace its manual classes with `<Surface variant="secondary">`:

```jsx
// Before
<div className="rounded-lg bg-card border border-border p-4 mb-3 shrink-0">
  {/* calories / macro bars */}
</div>

// After
<Surface variant="secondary" className="rounded-lg p-4 mb-3 shrink-0">
  {/* calories / macro bars */}
</Surface>
```

This is the correct use of `secondary` — an elevated inset on top of a `default` panel.

---

### How to replace `.card` with `<Surface>` in each panel

The `.card` class applies: `relative flex flex-col gap-3 overflow-hidden p-4`,
`shadow-surface`, and a large border-radius. `<Surface>` only applies the background
and context. You must carry the layout classes forward manually:

```jsx
// Before (all panel files)
<div className="card w-full flex flex-col overflow-hidden min-h-full">

// After
<Surface
  variant="default"
  className="w-full flex flex-col overflow-hidden min-h-full p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface"
>
```

> **Alternative:** Keep `className="card ..."` and just add `asChild` or leave as-is.
> The `.card` class is defined in HeroUI's own CSS and already applies `bg-surface`, so
> the only thing `<Surface>` adds is `SurfaceContext`. If no child component currently
> reads that context, keeping `.card` is a valid low-risk choice — do this migration
> when you actually need the context, not preemptively.

---

### Files to update with Surface (after the Disclosure migration)

| File | Panel wrapper change | Inset Surface needed |
|------|---|---|
| `nutrition/LeftPanel.js` | `<div className="card ...">` → `<Surface variant="default" ...>` | None |
| `nutrition/MiddlePanel.js` | Same | Cycle stats box → `<Surface variant="secondary">` |
| `training/LeftPanel.js` | Same | None |
| `training/MiddlePanel.js` | Same | None |
| `nutrition/RightPanel.js` | Same | None |
| `training/RightPanel.js` | Same | None |
| `forms/FormsPanel.js` | Same | None |

Add `Surface` to the `@heroui/react` import in each file:

```js
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
```

---

## Step 5 — Final verification pass (all 7 files)

Run these checks after each file conversion:

```
Grep for stale patterns:
  - *Collapsed, notesOpen, expandedReq, expandedItemId (after conversion)
  - setPlansCollapsed, setFormsCollapsed, setMealsCollapsed, etc.
  - ChevronIcon
  - data-\[hover\]           ← must be data-hover: (no square brackets)
  - {!xCollapsed &&          ← confirms no missed conditional renders
  - style=\{\{ flex: .*Collapsed  ← confirms flex trick is updated
```

Check imports in each file:
- `Disclosure`, `DisclosureGroup`, `Separator` imported from `@heroui/react`
- No import of `ChevronIcon` (it was always a local component, not imported)
- No unused imports left behind

---

## Step 5 — Visual smoke test

After each file, open the page in the browser and verify:

| Page | URL | Sections to test |
|------|-----|---|
| Nutrition builder | `/[workspaceSlug]/clients/[id]/nutrition` | LeftPanel: Plans, Form Submissions, Calc · MiddlePanel: Cycles, Meals, Notes · RightPanel: Items, Alternatives, Notes |
| Training builder | `/[workspaceSlug]/clients/[id]/training` | LeftPanel: Plans, Form Submissions · MiddlePanel: Days, Notes · RightPanel: Exercises, Notes |
| Forms page | `/[workspaceSlug]/forms` | FormsPanel: Forms section |

For each section verify:
- [ ] Clicking the heading toggles open/close
- [ ] `Disclosure.Indicator` arrow rotates correctly
- [ ] Action buttons (Create Plan, + Cycle, + Meal, etc.) only appear when the section is open
- [ ] Sections that should grow vertically (`plans`, `forms`, `items`, `exercises`) fill the remaining height when expanded
- [ ] Sections that should shrink (`calc`, `notes`) collapse to zero height
- [ ] Multiple sections can be open simultaneously (DisclosureGroup is not exclusive)
- [ ] The nested form submission rows and alternatives rows expand/collapse independently
- [ ] Drag-and-drop on meals, days, exercises still works inside `Disclosure.Content`
