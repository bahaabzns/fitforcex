---
applyTo: "client/**"
---

# FitForce X — Design System Instructions

Always follow these conventions when writing or modifying any code in the `client/` directory.

---

## CSS Tokens — always use `var(--token)`

| Token | Value |
|---|---|
| `--background` | `#F5F5F7` |
| `--foreground` | `#1D1D1F` |
| `--accent` | `#007AFF` |
| `--accent-hover` | `#0056CC` |
| `--secondary-text` | `#86868B` |
| `--border-color` | `#D2D2D7` |
| `--sidebar-bg` | `#F0F0F5` |
| `--danger` | `#FF3B30` |
| `--success` | `#34C759` |

In Tailwind: `border-[var(--border-color)]`, `bg-[var(--accent)]`, `text-[var(--foreground)]`

---

## Global CSS Classes

- `.card` — `rounded-2xl shadow-sm p-6 bg-white` with blur backdrop + soft border. Use for all white content containers.
- `.input-field` — `px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[#FAFAFA]` with accent focus ring.
- `.btn-primary` — accent background, white text, `rounded-xl py-3 font-medium`. Always add `cursor-pointer`.
- `.btn-danger` — danger background, white text, `rounded-xl py-3 font-medium`.
- `.btn-secondary` — accent color text only, no background.
- Sidebar classes: `.sidebar`, `.sidebar-link`, `.sidebar-link-active`, `.sidebar-nav`, `.sidebar-footer`, `.sidebar-logout-btn`, `.sidebar-avatar`, `.sidebar-user`

---

## Input With Unit Badge

For inputs needing a unit label (kg, cm, %, etc.), do NOT use a plain `.input-field`. Use this wrapper pattern:
```jsx
<div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[#FAFAFA] overflow-hidden focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition">
  <input className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-gray-900 min-w-0" />
  <span className="px-3 text-xs font-medium text-gray-400 border-l border-[var(--border-color)] shrink-0">kg</span>
</div>
```

---

## Border Radius Scale

- Large containers (cards, modals): `rounded-2xl`
- Buttons, inputs: `rounded-xl`
- Small buttons, chips: `rounded-lg`
- Badges, pills, toggles: `rounded-full`

---

## Status Badges

```jsx
// Pending
<span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium"><Clock size={11} /> Pending</span>
// Submitted / success
<span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium"><CheckCircle size={11} /> Submitted</span>
```

---

## Segmented / Pill Toggle

For binary or small option sets (not a `<select>`):
```jsx
<div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
  <button className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Option A</button>
  <button className={`flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${!active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Option B</button>
</div>
```

---

## Section Micro Label

```jsx
<p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Section Name</p>
```

---

## Draggable Multi-Panel Layout

All detail pages use a draggable-divider pattern. Use `widths` state (% array), a `containerRef`, and a `handleDividerMouseDown` function:
```jsx
const [widths, setWidths] = useState([38, 62]);
const containerRef = useRef(null);

function handleDividerMouseDown(e) {
  e.preventDefault();
  const containerWidth = containerRef.current.getBoundingClientRect().width;
  const startX = e.clientX;
  const startWidths = [...widths];
  function onMove(ev) {
    const deltaPct = ((ev.clientX - startX) / containerWidth) * 100;
    setWidths([Math.max(20, startWidths[0] + deltaPct), Math.max(20, startWidths[1] - deltaPct)]);
  }
  function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
```

Divider handle JSX:
```jsx
<div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={handleDividerMouseDown}>
  <div className="w-1.5 h-12 bg-blue-200 rounded-full group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
</div>
```

---

## Collapsible Panel Sections

```jsx
<div className="flex flex-col min-h-0" style={{ flex: collapsed ? "0 0 auto" : "1 1 0" }}>
  <div className="flex items-center gap-3 mb-4 shrink-0">
    <button onClick={() => setCollapsed(c => !c)}><ChevronIcon up={!collapsed} /></button>
    <h2 className="text-base font-semibold text-gray-900 flex-1">Title</h2>
  </div>
  {!collapsed && <div className="flex-1 overflow-y-auto min-h-0">{/* content */}</div>}
</div>
```

Section dividers: `<div className="shrink-0 border-t border-gray-100 my-4" />`

---

## Modal

Always use the shared `<Modal>` component:
```jsx
import Modal from "@/app/components/Modal";
<Modal open={open} onClose={() => setOpen(false)} title="Title" wide={false}>{/* body */}</Modal>
```

---

## Empty States

```jsx
<div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
  <Icon size={40} className="text-gray-200" />
  <p className="text-sm font-medium text-gray-500">Nothing here yet</p>
  <p className="text-xs text-gray-400">Descriptive sub-text</p>
</div>
```

---

## Loading Skeletons

```jsx
{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
```

---

## Error Boundaries

Every `error.js` must use `<ErrorState>`:
```jsx
import ErrorState from "@/app/components/ErrorState";
export default function Error({ error, reset }) { return <ErrorState error={error} reset={reset} />; }
```

---

## Icons

Use **lucide-react** only. Never use other icon libraries.

---

## Active Row Highlighting

```jsx
className={`... ${isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"}`}
```

---

## API Calls

Always import from `@/lib/axios`:
```js
import api from "@/lib/axios";
api.get("/api/...").then(...).catch(...);
```

---

## Next.js Conventions

- `"use client"` at top of every interactive component
- Route groups: `(coach)/` for coach, `client/` for client portal
- Each route: `page.js` + `loading.js` (skeleton) + `error.js` (ErrorState)
- `loading.js` → pulse skeleton cards
- Full reference: `client/DESIGN_SYSTEM.md`
