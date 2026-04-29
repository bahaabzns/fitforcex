# FitForce X — Design System

This document describes the visual language, CSS tokens, utility classes, layout patterns, and component conventions used across the FitForce X client application. Follow these rules precisely when building or modifying any UI.

---

## 1. CSS Custom Properties (Tokens)

Defined in `app/globals.css` under `:root`. Always reference via `var(--token)`.

| Token | Value | Usage |
|---|---|---|
| `--background` | `#F5F5F7` | Page background |
| `--foreground` | `#1D1D1F` | Primary text |
| `--accent` | `#007AFF` | Primary blue — buttons, active states, links |
| `--accent-hover` | `#0056CC` | Hover state for accent elements |
| `--secondary-text` | `#86868B` | Muted/label text |
| `--card-bg` | `#FFFFFF` | Card backgrounds |
| `--border-color` | `#D2D2D7` | All borders and dividers |
| `--sidebar-bg` | `#F0F0F5` | Sidebar background |
| `--danger` | `#FF3B30` | Destructive actions, errors |
| `--success` | `#34C759` | Success states |

**In Tailwind**, reference tokens with the CSS variable syntax:
```jsx
className="border-[var(--border-color)] bg-[var(--accent)] text-[var(--foreground)]"
```

---

## 2. Typography

- **Font stack**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`
- Font rendering: `antialiased` (`-webkit-font-smoothing: antialiased`)
- Use Tailwind font-size utilities. Common scale:

| Role | Class |
|---|---|
| Page title | `text-2xl font-bold` |
| Section heading | `text-base font-semibold` |
| Card title | `text-sm font-medium` (`.card-title`) |
| Body | `text-sm text-gray-700` |
| Label / caption | `text-xs text-gray-500` |
| Micro label | `text-[10px] font-semibold uppercase tracking-widest text-gray-400` |
| Secondary / muted | `text-xs text-gray-400` |

---

## 3. Global CSS Classes

### Cards
```css
.card
  rounded-2xl shadow-sm p-6
  background: white
  backdrop-filter: blur(20px) saturate(180%)
  border: 1px solid rgba(255,255,255,0.5)
```
Use `.card` as the base container for any white content panel.

### Input Fields
```css
.input-field
  w-full px-4 py-3 rounded-xl
  border: 1px solid var(--border-color)
  background: #FAFAFA
  focus: ring-2 ring-[var(--accent)] border-[var(--accent)]
```
For inputs with a unit badge (e.g. "kg", "%"), use an `InputWithUnit` wrapper pattern instead:
```jsx
<div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[#FAFAFA] overflow-hidden focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition">
  <input className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-gray-900 min-w-0" />
  <span className="px-3 text-xs font-medium text-gray-400 border-l border-[var(--border-color)] shrink-0">kg</span>
</div>
```

### Buttons
```css
.btn-primary   — accent background, white text, rounded-xl, py-3, font-medium
.btn-danger    — danger (#FF3B30) background, white text, rounded-xl, py-3
.btn-secondary — accent-colored text only, no background, py-2 font-semibold text-sm
```
Always add `cursor-pointer` on interactive buttons.

For small inline buttons (icon + label), use direct Tailwind:
```jsx
className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer"
```

### Toggle / Segmented Control
Pill toggle used for binary/small option sets (e.g. Male/Female, Measure/Direct):
```jsx
<div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
  <button className="flex-1 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm">Active</button>
  <button className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700">Inactive</button>
</div>
```

### Status Badges
```jsx
// Pending
<span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
  <Clock size={11} /> Pending
</span>

// Submitted / Success
<span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
  <CheckCircle size={11} /> Submitted
</span>

// Active plan
<span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-semibold">
  <CheckIcon /> Active
</span>

// Error
<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{n}%</span>
```

### Section Labels (Micro Headings)
```jsx
<p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
  Label Text
</p>
```

---

## 4. Sidebar

Two implementations — `Sidebar.js` (coach) and `ClientSidebar.js` (client portal) — share the same CSS classes.

```
.sidebar              — outer container, 16rem wide, collapses to 4rem
.sidebar.collapsed    — collapsed state
.sidebar-title        — brand name, accent color, border-bottom
.sidebar-user         — user info row (avatar + name + email/sub)
.sidebar-avatar       — round avatar, accent background, white initials
.sidebar-nav          — flex-1 scrollable nav area
.sidebar-link         — inactive nav item
.sidebar-link-active  — active nav item (accent background, white text)
.sidebar-sub-link     — indented sub-nav link
.sidebar-sub-link-active — active sub-nav link
.sidebar-footer       — bottom logout area, border-top
.sidebar-logout-btn   — logout button (danger color)
```

Active detection pattern:
```js
const isActive = pathname === href;           // exact match for dashboard
const isActive = pathname.startsWith(href);   // prefix match for sections
```

---

## 5. Layout Patterns

### Full-height App Shell
```jsx
// Root: body is h-screen overflow-hidden
// Pages inside coach layout:
<div className="flex h-screen overflow-hidden">
  <Sidebar />
  <main className="flex-1 flex flex-col overflow-hidden">
    {children}
  </main>
</div>
```

### Multi-Panel Layout with Draggable Dividers
All detail pages (nutrition, forms, etc.) use a draggable-divider panel system:

```jsx
const [widths, setWidths] = useState([38, 62]); // percentages, must sum to ~100
const containerRef = useRef(null);

function handleDividerMouseDown(e) {
  e.preventDefault();
  const containerWidth = containerRef.current.getBoundingClientRect().width;
  const startX = e.clientX;
  const startWidths = [...widths];
  function onMove(moveEvent) {
    const deltaPct = ((moveEvent.clientX - startX) / containerWidth) * 100;
    setWidths([
      Math.max(20, startWidths[0] + deltaPct),
      Math.max(20, startWidths[1] - deltaPct),
    ]);
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

// JSX
<div ref={containerRef} className="flex h-full overflow-hidden">
  <div style={{ width: `${widths[0]}%` }} className="flex flex-col overflow-hidden">
    {/* Left panel content */}
  </div>

  {/* Divider handle */}
  <div
    className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
    onMouseDown={handleDividerMouseDown}
  >
    <div className="w-1.5 h-12 bg-blue-200 rounded-full group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
  </div>

  <div style={{ width: `${widths[1]}%` }} className="flex flex-col overflow-hidden">
    {/* Right panel content */}
  </div>
</div>
```

For 3 panels, use `widths = [33, 34, 33]` and pass an `index` to the handler.

### Collapsible Sections (within a panel)
```jsx
const [collapsed, setCollapsed] = useState(false);

<div className="flex flex-col min-h-0" style={{ flex: collapsed ? "0 0 auto" : "1 1 0" }}>
  <div className="flex items-center gap-3 mb-4 shrink-0">
    <button onClick={() => setCollapsed(c => !c)}>
      <ChevronIcon up={!collapsed} />
    </button>
    <h2 className="text-base font-semibold text-gray-900 flex-1">Section Title</h2>
  </div>
  {!collapsed && (
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* content */}
    </div>
  )}
</div>
```

Section dividers between collapsible panels:
```jsx
<div className="shrink-0 border-t border-gray-100 my-4" />
```

---

## 6. Modal

Use the shared `<Modal>` component (`app/components/Modal.js`):

```jsx
import Modal from "@/app/components/Modal";

<Modal open={isOpen} onClose={() => setIsOpen(false)} title="Modal Title" wide={false}>
  {/* body content */}
</Modal>
```

- Backdrop: `bg-black/40 backdrop-blur-sm`
- Container: `bg-white border border-[#D2D2D7] rounded-2xl shadow-xl`
- Header: `px-6 py-4 border-b border-[#D2D2D7]` with title + X button
- Body: pass as `children`
- `wide` prop switches between `max-w-lg` and `max-w-2xl`

---

## 7. Empty States

Consistent pattern for empty lists/panels:
```jsx
<div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
  <SomeIcon size={40} className="text-gray-200" />
  <p className="text-sm font-medium text-gray-500">Nothing here yet</p>
  <p className="text-xs text-gray-400">Descriptive sub-text</p>
  {/* optional CTA button */}
</div>
```

---

## 8. Error States

Use the shared `<ErrorState>` component in every `error.js` boundary:
```jsx
import ErrorState from "@/app/components/ErrorState";
export default function Error({ error, reset }) {
  return <ErrorState error={error} reset={reset} />;
}
```

---

## 9. Loading States

Pulse skeleton pattern:
```jsx
<div className="flex flex-col gap-2">
  {[1, 2, 3].map(i => (
    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
  ))}
</div>
```

---

## 10. Tab Navigation (within a page)

Used in client detail pages (`clients/[id]/layout.js`):
```jsx
<nav className="flex gap-1 border-b border-gray-200 px-6">
  {tabs.map(tab => (
    <Link
      key={tab.href}
      href={tab.href}
      className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
        pathname === tab.href
          ? "text-blue-600 border-blue-500"
          : "text-gray-500 border-transparent hover:text-gray-700"
      }`}
    >
      {tab.label}
    </Link>
  ))}
</nav>
```

---

## 11. Data Table

Use the shared `<DataTable>` component (`app/components/DataTable.js`) for any list with filtering/sorting:
```jsx
import DataTable from "@/app/components/DataTable";

<DataTable
  columns={[
    { key: "name",       label: "Name",       filterType: "text",  sortable: true },
    { key: "status",     label: "Status",     filterType: "multi", options: ["active","inactive"] },
    { key: "created_at", label: "Created",    filterType: "dateRange" },
    { key: "actions",    label: "",           render: (row) => <ActionButtons row={row} /> },
  ]}
  data={rows}
  rowKey="id"
/>
```

---

## 12. Macros Display

Use `<MacrosBadges>` for any calorie/macro summary display:
```jsx
import MacrosBadges from "@/app/components/MacrosBadges";

<MacrosBadges calories={2000} protein={150} carbs={220} fats={65} />
```

---

## 13. Icons

Use **lucide-react** exclusively for icons. Common ones used:
`LayoutDashboard, Users, Database, Salad, Dumbbell, ClipboardList, Settings, LogOut, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trash2, Clock, CheckCircle, Send, Eye`

SVG inline icons are used only for the sidebar chevron toggle and plan list actions (DuplicateIcon, TrashIcon) as lightweight alternatives.

---

## 14. Color Usage Guidelines

| Situation | Color / Class |
|---|---|
| Primary action | `bg-[var(--accent)]` → `#007AFF` |
| Hover on primary | `bg-[var(--accent-hover)]` → `#0056CC` |
| Destructive action | `bg-[var(--danger)]` → `#FF3B30` |
| Success/Active | `text-green-600`, `bg-green-100` |
| Pending/Warning | `text-yellow-700`, `bg-yellow-100` |
| Muted text | `text-gray-400` or `text-[var(--secondary-text)]` |
| Borders | `border-[var(--border-color)]` or `border-gray-200` |
| Input background | `bg-[#FAFAFA]` |
| Hover background (subtle) | `hover:bg-gray-50` |
| Active row/item | `bg-blue-50 border-blue-200` |
| Accent text (links, active labels) | `text-[var(--accent)]` |

---

## 15. Spacing & Border Radius Conventions

| Element | Radius |
|---|---|
| Cards, modals, large inputs | `rounded-2xl` |
| Buttons, standard inputs | `rounded-xl` |
| Badges, pills, small toggles | `rounded-full` |
| Small buttons, tag chips | `rounded-lg` |
| Divider handles | `rounded-full` |

Standard gap inside flex/grid layouts: `gap-3` to `gap-6` for sections, `gap-1.5` to `gap-2` for tight lists.

---

## 16. Next.js App Router Conventions

- All interactive components: `"use client"` at top of file
- Route groups: `(coach)` for coach pages, `client` for client portal
- Each route folder has: `page.js`, `loading.js`, `error.js`
- `loading.js` → pulse skeleton
- `error.js` → `<ErrorState error={error} reset={reset} />`
- Layouts at `(coach)/layout.js` and `client/layout.js` wrap with sidebar + auth guard
- API calls via `import api from "@/lib/axios"` (pre-configured Axios instance)

---

## 17. API & Auth Patterns

- Coach routes: require `authMiddleware` → `req.user.id` = workspace ID
- Client portal routes: require `clientAuthMiddleware` → `req.client.id`, `req.client.coach_id`
- Base URL configured in `lib/axios.js`; all calls use relative `/api/...` paths
- Auth check pattern in page components:
```js
useEffect(() => {
  api.get("/api/auth/me")
    .then(res => setUser(res.data))
    .catch(() => router.push("/login"));
}, []);
```
