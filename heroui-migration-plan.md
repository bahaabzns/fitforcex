# HeroUI Full Design System Migration Plan

**Goal:** Replace every custom component, raw HTML UI element, and shadcn-style wrapper with native HeroUI v3 components. No component left behind.

---

## Current State Audit

### What is already using HeroUI correctly
| File | HeroUI components used |
|---|---|
| `app/(auth)/login/page.js` | `TextField`, `Label`, `Input`, `Button` |
| `app/(auth)/register/page.js` | `TextField`, `Label`, `Input`, `Button` |
| `app/components/Sidebar.js` | `Button`, `Avatar`, `Chip`, `Disclosure`, `Separator` |
| `app/components/DataTable.js` | `Table.*`, `Checkbox.*`, `Pagination.*`, `Button` |

### What is NOT using HeroUI (needs migration)
| File | Problem |
|---|---|
| `components/ui/button.jsx` | CVA wrapper around raw `<button>` — NOT HeroUI |
| `components/ui/input.jsx` | Styled raw `<input>` — NOT HeroUI |
| `components/ui/label.jsx` | Styled raw `<label>` — NOT HeroUI |
| `components/ui/select.jsx` | Styled raw `<select>` — NOT HeroUI |
| `components/ui/textarea.jsx` | Styled raw `<textarea>` — NOT HeroUI |
| `components/ui/card.jsx` | Styled raw `<div>` — NOT HeroUI |
| `components/ui/badge.jsx` | Styled raw `<span>` — NOT HeroUI |
| `components/ui/dialog.jsx` | Custom implementation — NOT HeroUI |
| `components/ui/avatar.jsx` | CVA wrapper — NOT HeroUI |
| `components/ui/table.jsx` | Styled raw `<table>` — NOT HeroUI |
| `components/ui/tabs.jsx` | Styled raw tabs — NOT HeroUI |
| `components/ui/alert.jsx` | Styled raw `<div>` — NOT HeroUI |
| `components/ui/progress.jsx` | Styled raw `<div>` — NOT HeroUI |
| `components/ui/separator.jsx` | Styled `<hr>` — NOT HeroUI |
| `components/ui/skeleton.jsx` | Styled `<div>` with pulse — NOT HeroUI |
| `app/components/Modal.js` | Fully custom dialog with portal — NOT HeroUI |
| `app/components/NameModal.js` | Uses `@/components/ui/input` + `button` |
| `app/components/ClientSidebar.js` | Raw `<button>`, undefined CSS classes, no HeroUI |
| `app/components/ErrorState.js` | Unknown — needs audit |
| `app/components/MacrosBadges.js` | Unknown — needs audit |
| `app/components/training/LeftPanel.js` | Unknown — needs audit |
| `app/components/training/MiddlePanel.js` | Unknown — needs audit |
| `app/components/training/RightPanel.js` | Unknown — needs audit |
| `app/components/training/ExercisePickerModal.js` | Modal — NOT HeroUI |
| `app/components/nutrition/LeftPanel.js` | Unknown — needs audit |
| `app/components/nutrition/MiddlePanel.js` | Unknown — needs audit |
| `app/components/nutrition/RightPanel.js` | Unknown — needs audit |
| `app/components/nutrition/CycleCalculator.js` | Unknown — needs audit |
| `app/components/nutrition/FoodItemsModal.js` | Modal — NOT HeroUI |
| `app/components/forms/FormsPanel.js` | Unknown — needs audit |
| `app/components/forms/QuestionsPanel.js` | Unknown — needs audit |
| `app/components/forms/QuestionEditorPanel.js` | Unknown — needs audit |
| `app/components/plansQueue/PlansQueueTable.js` | Unknown — needs audit |
| `app/(coach)/layout.js` | Uses `@/components/ui/skeleton` |
| `app/(client)/portal/layout.js` | Uses `@/components/ui/skeleton` |
| `app/(coach)/[workspaceSlug]/dashboard/page.js` | Custom `StatCard` divs, hardcoded badge spans, manual skeleton |
| `app/(coach)/[workspaceSlug]/clients/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/clients/[id]/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/clients/[id]/training/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/clients/[id]/forms/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/clients/[id]/transactions/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/team/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/settings/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/finance/*/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/forms/page.js` | Unknown — needs audit |
| `app/(coach)/[workspaceSlug]/plans-queue/page.js` | Unknown — needs audit |
| `app/(admin)/admin/layout.js` | Unknown — needs audit |
| `app/(admin)/admin/page.js` | Unknown — needs audit |
| `app/(admin)/admin/users/page.js` | Unknown — needs audit |
| `app/(admin)/admin/workspaces/page.js` | Unknown — needs audit |
| `app/(admin)/admin/plans/page.js` | Unknown — needs audit |
| `app/(admin)/admin/login/page.js` | Unknown — needs audit |
| `app/(client)/portal/*/page.js` | Unknown — needs audit |
| `app/page.js` (landing) | Unknown — needs audit |

---

## Component Mapping: Custom → HeroUI

| Custom / Raw | HeroUI v3 Equivalent | Import path |
|---|---|---|
| `<button>` | `Button` | `@heroui/react/button` |
| `<input>` | `Input` inside `TextField` | `@heroui/react/input`, `@heroui/react/textfield` |
| `<label>` | `Label` | `@heroui/react/label` |
| `<select>` | `Select` + `Select.Trigger` + `Select.Content` + `Select.Item` | `@heroui/react/select` |
| `<textarea>` | `Textarea` inside `TextField` | `@heroui/react/textarea`, `@heroui/react/textfield` |
| Custom card div | `Card` + `Card.Header` + `Card.Body` + `Card.Footer` | `@heroui/react/card` |
| Badge/status span | `Chip` (with `color` + `variant`) | `@heroui/react/chip` |
| Custom modal/dialog | `Modal` + `Modal.Backdrop` + `Modal.Container` + `Modal.Dialog` + `Modal.Header` + `Modal.Heading` + `Modal.Body` + `Modal.Footer` + `Modal.CloseTrigger` | `@heroui/react/modal` |
| Destructive confirm modal | `AlertDialog` (same sub-components as Modal) | `@heroui/react/alert-dialog` |
| Side detail panel/drawer | `Drawer` (same sub-components as Modal, slides from side) | `@heroui/react/drawer` |
| Custom avatar div | `Avatar` + `Avatar.Fallback` | `@heroui/react/avatar` |
| Custom table | `Table.*` (already done in DataTable) | `@heroui/react/table` |
| Custom tabs | `Tabs` + `Tabs.List` + `Tabs.Tab` + `Tabs.Panel` | `@heroui/react/tabs` |
| Alert/banner div | `Alert` + `Alert.Indicator` + `Alert.Content` + `Alert.Title` + `Alert.Description` | `@heroui/react/alert` |
| Progress bar div | `ProgressBar` + `ProgressBar.Track` + `ProgressBar.Fill` | `@heroui/react/progress-bar` |
| `<hr>` / divider | `Separator` | `@heroui/react/separator` |
| Skeleton `animate-pulse` div | `Skeleton` | `@heroui/react/skeleton` |
| Checkbox | `Checkbox` + `Checkbox.Control` + `Checkbox.Indicator` | `@heroui/react/checkbox` |
| Collapsible section | `Disclosure` + `Disclosure.Heading` + `Disclosure.Trigger` + `Disclosure.Content` + `Disclosure.Body` | `@heroui/react/disclosure` |
| Pagination | `Pagination.*` (already done in DataTable) | `@heroui/react/pagination` |

---

## Migration Phases

---

### Phase 0 — Add HeroUI Provider to root layout ⚠️ MUST BE FIRST

**Why critical:** `app/layout.js` currently has no HeroUI provider. Without it, every HeroUI component renders without theme tokens (colors, radius, dark mode). This must land before any component work.

**File:** `app/layout.js`

```jsx
import { HeroUIProvider } from "@heroui/react";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <HeroUIProvider>{children}</HeroUIProvider>
      </body>
    </html>
  );
}
```

> Note: `HeroUIProvider` requires `'use client'` in Next.js App Router. Wrap it in a separate `app/providers.js` client component and import that in the server `layout.js`:
> ```jsx
> // app/providers.js
> 'use client';
> import { HeroUIProvider } from "@heroui/react";
> export function Providers({ children }) {
>   return <HeroUIProvider>{children}</HeroUIProvider>;
> }
> ```

---

### Phase 1 — Eliminate `components/ui/` directory

**Why first:** Only 5 files import from here. Remove the abstraction layer before anything else so subsequent phases always import from `@heroui/react/*` directly.

**Files to change:**

#### 1.1 `app/components/NameModal.js`
- Remove `import { Input } from "@/components/ui/input"`
- Remove `import { Button } from "@/components/ui/button"`
- Add `import { TextField } from "@heroui/react/textfield"`
- Add `import { Label } from "@heroui/react/label"`
- Add `import { Input } from "@heroui/react/input"`
- Add `import { Button } from "@heroui/react/button"`
- Update JSX: wrap `<Input>` in `<TextField>` with `<Label>` (same pattern as login page)

#### 1.2 `app/(coach)/layout.js`
- Remove `import { Skeleton } from "@/components/ui/skeleton"`
- Add `import { Skeleton } from "@heroui/react/skeleton"`
- Replace every `<div className="... animate-pulse ...">` loading skeleton with `<Skeleton className="...">` 

#### 1.3 `app/(client)/portal/layout.js`
- Remove `import { Skeleton } from "@/components/ui/skeleton"`
- Add `import { Skeleton } from "@heroui/react/skeleton"`
- Same skeleton replacement

#### 1.4 `app/(coach)/[workspaceSlug]/nutrition/food-items/page.js`
- Remove `import { Button } from "@/components/ui/button"`
- Add `import { Button } from "@heroui/react/button"`
- No JSX changes needed (same prop API if only using `onClick`, `children`)

#### 1.5 Delete `components/ui/` directory
- After confirming zero remaining imports, delete the entire `client/components/ui/` directory

---

### Phase 2 — Replace `Modal.js` with HeroUI `Dialog`

**Why:** `Modal.js` is used throughout the app as the base for all modals. Replacing it here fixes every modal consumer at once.

#### 2.1 Rewrite `app/components/Modal.js`
- Remove all custom implementation (backdrop div, focus trap, keydown handler, body scroll lock)
- The HeroUI component is **`Modal`** (not `Dialog` — `Dialog` does not exist in HeroUI v3)
- Actual compound API: `Modal`, `Modal.Backdrop`, `Modal.Container`, `Modal.Dialog`, `Modal.Header`, `Modal.Heading`, `Modal.Body`, `Modal.Footer`, `Modal.CloseTrigger`
- Replace with:
```jsx
'use client';
import { Modal } from "@heroui/react/modal";

export default function AppModal({ open, onClose, title, children, wide }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Backdrop />
      <Modal.Container className={wide ? "max-w-2xl" : "max-w-lg"}>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
            <Modal.CloseTrigger />
          </Modal.Header>
          <Modal.Body>{children}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}
```
- HeroUI Modal handles: backdrop, scroll lock, focus trap, Escape key — no manual code needed
- Rename the component export to `AppModal` to avoid collision with the HeroUI `Modal` name in files that import both

#### 2.2 `app/components/training/ExercisePickerModal.js`
- Audit the file: replace custom `<Modal>` or custom dialog implementation with `Dialog` from `@heroui/react/dialog` directly (no wrapper needed for complex modals — use Dialog compound API)
- Replace any raw `<input>` search fields with `TextField` + `Input`
- Replace any raw `<button>` with `Button`

#### 2.3 `app/components/nutrition/FoodItemsModal.js`
- Same as ExercisePickerModal above

---

### Phase 3 — Fix `DataTable.js` filter area

**Why:** The table body and pagination already use HeroUI. The filter panel is the only non-HeroUI section.

#### 3.1 Text filter inputs
- Replace raw `<input type="text">` with:
```jsx
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";

<TextField value={...} onChange={...}>
  <Input type="text" placeholder={...} />
</TextField>
```

#### 3.2 Date range inputs
- Replace both `<input type="date">` with `TextField` + `Input type="date"` (same pattern)

#### 3.3 Multi-select dropdown
- Replace the custom `<button>` toggle + custom dropdown `<div>` + option `<button>` elements with HeroUI `Select`:
```jsx
import { Select } from "@heroui/react/select";
// or keep as popover — use Disclosure or a HeroUI Popover component
```
- If HeroUI has no multi-select, use a `Popover` + `Checkbox` list pattern matching DataTable's existing `Checkbox` usage

#### 3.4 Mobile card checkboxes
- Replace raw `<input type="checkbox">` in mobile cards with `Checkbox` + `Checkbox.Control` + `Checkbox.Indicator` (matching what the desktop table already uses)

---

### Phase 4 — Fix `ClientSidebar.js`

**Why:** Uses undefined CSS class names (`sidebar-link`, `sidebar-avatar`, `sidebar-logout-btn`, etc.) and a raw `<button>` for logout. Pattern should mirror the coach `Sidebar.js`.

#### 4.1 Replace undefined CSS classes
- Remove all references to: `sidebar-user`, `sidebar-avatar`, `sidebar-link`, `sidebar-link-active`, `sidebar-logout-btn`, `sidebar-footer`, `sidebar-nav`, `sidebar-user-info`, `sidebar-user-name`, `sidebar-user-email`
- Replace with inline Tailwind utility classes matching the coach Sidebar style

#### 4.2 Add HeroUI components
- Import `Avatar`, `Avatar.Fallback` from `@heroui/react/avatar` for user initials
- Import `Button` from `@heroui/react/button` for the logout and collapse toggle buttons
- Import `Separator` from `@heroui/react/separator` between sections

#### 4.3 Nav links
- Use the same `navLink(active)` helper pattern from `Sidebar.js` for consistency

---

### Phase 5 — Dashboard page

**File:** `app/(coach)/[workspaceSlug]/dashboard/page.js`

#### 5.1 Replace `StatCard` with HeroUI `Card`
- Remove the local `StatCard` function component
- Import `Card` from `@heroui/react/card`
- Actual compound API: `Card`, `Card.Header`, `Card.Title`, `Card.Description`, **`Card.Content`** (not `Card.Body`), `Card.Footer`
- Rewrite as:
```jsx
<Card>
  <Card.Content className="flex flex-col gap-3 p-5">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10"}`}>
      <Icon size={17} className={accent ? "text-white" : "text-primary"} />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </Card.Content>
</Card>
```

#### 5.2 Replace status badge spans with `Chip`
- Remove hardcoded `STATUS_CLS` map and `${STATUS_CLS[...]}` className spans
- Import `Chip` from `@heroui/react/chip`
- Map subscription status to HeroUI color props:
  - `Active` → `color="success"` `variant="soft"`
  - `Expired` → `color="danger"` `variant="soft"`
  - `Frozen` → `color="primary"` `variant="soft"`
  - `Pre-start` → `color="warning"` `variant="soft"`
  - `Cancelled` → `color="default"` `variant="soft"`
  - `Refunded` → `color="accent"` `variant="soft"`

#### 5.3 Replace manual skeleton divs with `Skeleton`
- Remove all `<div className="... animate-pulse ...">` loading state divs
- Import `Skeleton` from `@heroui/react/skeleton`
- Replace with `<Skeleton className="h-8 w-52 rounded-lg mb-8" />` etc.

---

### Phase 6 — Coach pages audit and update

For each page below: read the file, identify raw HTML/custom patterns, replace with HeroUI equivalents.

**Priority order:**

#### 6.1 `app/(coach)/[workspaceSlug]/clients/page.js`
- Likely uses `DataTable` (already HeroUI) + action buttons + modals
- Replace any raw `<input>`, `<button>`, `<select>` with HeroUI equivalents
- Replace any custom badge/chip spans for client status with `Chip`
- Replace any custom modal opens with HeroUI `Dialog` (via the updated `Modal.js`)

#### 6.2 `app/(coach)/[workspaceSlug]/clients/[id]/page.js`
- Client detail page — likely has tabs, cards, avatar
- Replace custom tabs with `Tabs` + `Tabs.List` + `Tabs.Tab` + `Tabs.Panel`
- Replace any inline avatar div with `Avatar` + `Avatar.Fallback`
- Replace status badge with `Chip`

#### 6.3 `app/(coach)/[workspaceSlug]/clients/[id]/transactions/page.js`
- Financial table — check for raw HTML, replace buttons/inputs with HeroUI

#### 6.4 `app/(coach)/[workspaceSlug]/team/page.js`
- Has tabs (Members, Invitations, My Invitations)
- Replace tab implementation with `Tabs.*` from `@heroui/react/tabs`
- Has permission modal — replace with `Modal` from `@heroui/react/modal`
- Has `SeatUsageBar` — replace with `ProgressBar` from `@heroui/react/progress-bar`
- Has `UpgradeBanner` — replace with `Alert.*` from `@heroui/react/alert`
- Replace invite form raw inputs with `TextField` + `Input`

#### 6.5 `app/(coach)/[workspaceSlug]/settings/page.js`
- Has tabs (Profile, Workspace, Danger Zone)
- Replace tabs with `Tabs.*`
- Replace form inputs with `TextField` + `Input` / `Label`
- Replace any danger action with destructive `Button` variant

#### 6.6 `app/(coach)/[workspaceSlug]/finance/transactions/page.js`
#### 6.7 `app/(coach)/[workspaceSlug]/finance/packages/page.js`
#### 6.8 `app/(coach)/[workspaceSlug]/finance/payment-methods/page.js`
- All three: replace raw form elements, buttons, badges with HeroUI equivalents

#### 6.9 `app/(coach)/[workspaceSlug]/forms/page.js`
- Contains `FormsPanel`, `QuestionsPanel`, `QuestionEditorPanel` — handled in Phase 7

#### 6.10 `app/(coach)/[workspaceSlug]/plans-queue/page.js`
- Contains `PlansQueueTable` — handled in Phase 7

---

### Phase 7 — Complex panel components

These are feature-rich components requiring careful migration. Each file must be read in full before making changes.

#### 7.1 `app/components/training/LeftPanel.js`
- Replace raw `<input>` search/filter with `TextField` + `Input`
- Replace raw `<button>` elements with `Button`
- Replace custom expand/collapse sections with `Disclosure`
- Replace any modal opens with HeroUI `Modal`

#### 7.2 `app/components/training/MiddlePanel.js`
- Drag-and-drop exercise list editor
- Replace any raw `<input>` (set reps/weight) with `TextField` + `Input`
- Replace raw `<button>` (add day, add exercise, delete) with `Button`
- Replace any confirmation dialogs with `AlertDialog` (destructive) or `Modal` (non-destructive)
- Keep custom drag logic — only replace UI primitives

#### 7.3 `app/components/training/RightPanel.js`
- Exercise detail view
- Replace raw `<input>` / `<textarea>` with HeroUI equivalents
- Replace raw `<button>` with `Button`
- Replace any badge spans with `Chip`

#### 7.4 `app/components/nutrition/LeftPanel.js`
#### 7.5 `app/components/nutrition/MiddlePanel.js`
#### 7.6 `app/components/nutrition/RightPanel.js`
- Same pattern as training panels above

#### 7.7 `app/components/nutrition/CycleCalculator.js`
- Macro calculation UI
- Replace raw `<input>` with `TextField` + `Input`
- Replace macro bars/progress indicators with `ProgressBar` from `@heroui/react/progress-bar`
- Replace any result badges with `Chip`

#### 7.8 `app/components/forms/FormsPanel.js`
#### 7.9 `app/components/forms/QuestionsPanel.js`
#### 7.10 `app/components/forms/QuestionEditorPanel.js`
- Replace all raw `<input>`, `<textarea>`, `<select>`, `<button>` with HeroUI
- Replace any inline switch/toggle with `Switch` + `Switch.Control` + `Switch.Thumb` from `@heroui/react/switch`
- Replace any badge/tag spans with `Chip`
- Replace form group collapses with `Disclosure`

#### 7.11 `app/components/plansQueue/PlansQueueTable.js`
- Replace any raw UI elements with HeroUI equivalents
- If it has its own table, migrate to `DataTable.js` (which already uses HeroUI `Table.*`)

#### 7.12 `app/components/ErrorState.js`
- Replace error display with HeroUI `Alert` + appropriate color/variant

#### 7.13 `app/components/MacrosBadges.js`
- Replace any badge spans with `Chip` with appropriate colors

---

### Phase 8 — Admin pages

#### 8.1 `app/(admin)/admin/login/page.js`
- Replace with same pattern as coach login: `TextField`, `Label`, `Input`, `Button`

#### 8.2 `app/(admin)/admin/layout.js`
- Admin sidebar — replace raw `<button>` with `Button`
- Add `Separator` between sections
- Add `Avatar` for admin user if shown

#### 8.3 `app/(admin)/admin/page.js`
- Stats overview — replace custom stat divs with HeroUI `Card`
- Replace any badge spans with `Chip`
- Replace skeleton loading with `Skeleton`

#### 8.4 `app/(admin)/admin/users/page.js`
- Paginated list + detail drawer
- If it has its own table, use `DataTable.js` (HeroUI Table) or ensure Table uses `Table.*`
- Replace detail side panel with HeroUI `Drawer` (not Modal — it slides in from the side, which matches the existing UX pattern)
- Replace filter inputs with `TextField` + `Input`
- Replace badge status with `Chip`

#### 8.5 `app/(admin)/admin/workspaces/page.js`
- Same as users page
- Subscription override modal → `Modal` from `@heroui/react/modal`
- Archive/restore confirm → `AlertDialog` from `@heroui/react/alert-dialog` (destructive action)
- Archive/restore buttons → `Button` with appropriate variant

#### 8.6 `app/(admin)/admin/plans/page.js`
- CRUD with edit modal
- Edit modal → `Modal` from `@heroui/react/modal`
- Form inputs → `TextField` + `Input`
- Plan cards → `Card` (`Card.Content` not `Card.Body`)

---

### Phase 9 — Client portal pages

#### 9.1 `app/(client)/portal/login/page.js`
- Replace with same pattern as coach login: `TextField`, `Label`, `Input`, `Button`

#### 9.2 `app/(client)/portal/page.js` (public coach portal page)
- Landing/profile page for coach
- Replace any raw form with HeroUI form components

#### 9.3 `app/(client)/portal/dashboard/page.js`
- Client nutrition dashboard
- Replace status badges with `Chip`
- Replace any cards with `Card`
- Replace skeleton loading with `Skeleton`

#### 9.4 `app/(client)/portal/training/page.js`
- Read-only training view for client
- Replace any badge/chip spans with `Chip`
- Replace any card divs with `Card`

#### 9.5 `app/(client)/portal/forms/page.js`
#### 9.6 `app/(client)/portal/forms/[requestId]/page.js`
- Form filling interface
- Replace raw form elements (`<input>`, `<textarea>`, `<select>`) with HeroUI equivalents
- Replace submit button with `Button`

---

### Phase 10 — Landing page

#### 10.1 `app/page.js`
- Audit all UI elements
- Replace any raw buttons with `Button`
- Replace any raw inputs (newsletter, etc.) with `TextField` + `Input`
- Apply `Card` for feature/pricing sections if applicable

---

### Phase 11 — Cleanup

#### 11.1 Remove `components/ui/` directory
- Verify zero imports remain (`grep -r "from \"@/components/ui/"` should return nothing)
- Delete `client/components/ui/` entirely

#### 11.2 Audit `globals.css`
- Remove any CSS class definitions that are now handled by HeroUI (e.g. undefined `sidebar-link*` classes in ClientSidebar)
- Keep only tokens HeroUI doesn't provide: `--primary`, `--destructive`, `--muted-foreground`, `--border`, `--sidebar-*`, and the `@layer components` `.auth-*` and `.sidebar` base rules
- Do NOT remove `@import "@heroui/react/styles"` — must stay first

#### 11.3 Final grep audit
Run the following searches and fix any remaining hits:
```bash
grep -r "animate-pulse" app/         # should be zero — all replaced by Skeleton
grep -r "from \"@/components/ui/"    # should be zero — all replaced
grep -r "<input " app/               # review each hit — ensure wrapped in TextField
grep -r "<select " app/              # review each hit — ensure using HeroUI Select
grep -r "<textarea " app/            # review each hit — ensure using HeroUI Textarea
grep -r "<button " app/              # review each hit — ensure using HeroUI Button
```

---

## HeroUI v3 Compound API Quick Reference

> **Verified against `node_modules/@heroui/react/dist/components/`**

```jsx
// TextField (wraps label + input) — import from @heroui/react/textfield
<TextField value={val} onChange={setVal} isRequired>
  <Label>Email</Label>                    {/* @heroui/react/label */}
  <Input type="email" placeholder="..." />{/* @heroui/react/input */}
</TextField>

// Textarea inside TextField — import from @heroui/react/textarea
<TextField value={val} onChange={setVal}>
  <Label>Notes</Label>
  <Textarea rows={4} />
</TextField>

// Select — items live inside Select.Popover as ListBox.Item
// import { Select } from "@heroui/react/select"
// import { ListBox } from "@heroui/react/list-box"
<Select value={val} onValueChange={setVal}>
  <Label>Status</Label>
  <Select.Trigger>
    <Select.Value />
    <Select.Indicator />
  </Select.Trigger>
  <Select.Popover>
    <ListBox>
      <ListBox.Item id="active">Active</ListBox.Item>
      <ListBox.Item id="expired">Expired</ListBox.Item>
    </ListBox>
  </Select.Popover>
</Select>

// Card — note: Card.Content NOT Card.Body
// import { Card } from "@heroui/react/card"
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>subtitle</Card.Description>
  </Card.Header>
  <Card.Content>body content</Card.Content>
  <Card.Footer>footer</Card.Footer>
</Card>

// Modal (HeroUI has NO Dialog component — use Modal)
// import { Modal } from "@heroui/react/modal"
<Modal open={open} onOpenChange={(o) => !o && onClose()}>
  <Modal.Backdrop />
  <Modal.Container>
    <Modal.Dialog>
      <Modal.Header>
        <Modal.Heading>Title</Modal.Heading>
        <Modal.CloseTrigger />
      </Modal.Header>
      <Modal.Body>content</Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal.Container>
</Modal>

// AlertDialog — for destructive confirmations (delete, archive)
// import { AlertDialog } from "@heroui/react/alert-dialog"
// Same compound API as Modal: AlertDialog.Backdrop, .Container, .Dialog, .Header, .Heading, .Body, .Footer, .CloseTrigger

// Chip (badge/status) — import from @heroui/react/chip
<Chip color="success" variant="soft">Active</Chip>
<Chip color="danger"  variant="soft">Expired</Chip>
<Chip color="warning" variant="soft">Pre-start</Chip>
<Chip color="primary" variant="soft">Frozen</Chip>

// Skeleton — import from @heroui/react/skeleton
<Skeleton className="h-8 w-52 rounded-lg" />

// ProgressBar (NOT Progress) — import from @heroui/react/progress-bar
<ProgressBar value={60}>
  <ProgressBar.Track>
    <ProgressBar.Fill />
  </ProgressBar.Track>
  <ProgressBar.Output />   {/* optional: renders "60%" text */}
</ProgressBar>

// Tabs — import from @heroui/react/tabs
<Tabs>
  <Tabs.List>
    <Tabs.Tab id="tab1">Members</Tabs.Tab>
    <Tabs.Tab id="tab2">Invitations</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel id="tab1">...</Tabs.Panel>
  <Tabs.Panel id="tab2">...</Tabs.Panel>
</Tabs>

// Alert — compound, NOT a simple wrapper
// import { Alert } from "@heroui/react/alert"
<Alert>
  <Alert.Indicator />        {/* icon */}
  <Alert.Content>
    <Alert.Title>Seat limit reached</Alert.Title>
    <Alert.Description>Upgrade to add more members.</Alert.Description>
  </Alert.Content>
</Alert>

// Switch — for toggles in form builders
// import { Switch } from "@heroui/react/switch"
<Switch checked={val} onCheckedChange={setVal}>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Switch.Content>Enable feature</Switch.Content>
</Switch>

// Disclosure (already used in Sidebar — provided for reference)
// import { Disclosure } from "@heroui/react/disclosure"
<Disclosure isExpanded={open} onExpandedChange={setOpen}>
  <Disclosure.Heading>
    <Disclosure.Trigger>Toggle</Disclosure.Trigger>
  </Disclosure.Heading>
  <Disclosure.Content>
    <Disclosure.Body>hidden content</Disclosure.Body>
  </Disclosure.Content>
</Disclosure>

// Separator — import from @heroui/react/separator
<Separator />

// Drawer — for detail panels / side drawers (admin user/workspace detail)
// import { Drawer } from "@heroui/react/drawer"
// Same compound API as Modal but slides in from a side
```

---

## Execution Notes

1. **Read each file fully before editing.** Panel components (training, nutrition, forms) are 500–1000+ lines. Changing the wrong thing breaks state management.
2. **Do not change hook logic** in `useTrainingPlan.js`, `useNutritionPlan.js`, `useFormBuilder.js` — only swap UI primitives in the panel components.
3. **Check HeroUI v3 docs** (`node_modules/@heroui/react/dist/docs/`) before assuming a component API — v3 has breaking changes from prior HeroUI versions.
4. **Test each phase visually** before moving to the next. The app must render without errors after each phase.
5. **Phase 1 has zero risk** — only 5 import swaps, no JSX changes.
6. **Phase 2 (Modal)** is the highest leverage change — fixes all modals app-wide.
7. **Phases 7 and 8** are highest risk — complex components with interleaved state and UI. Work on one panel at a time.
