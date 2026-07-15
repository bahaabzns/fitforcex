# Phase 5: Design System & UI — Deep Review

**Date:** 2026-07-14
**Scope:** Reusable primitives, styling approach, globals.css tokens, icon strategy, dark mode, component library
**Score: GOOD** (3.5/5) — Strong foundation with HeroUI + Tailwind v4, well-documented token system, but 2 dead icon libraries and inline SVG inconsistency

---

## 1. TECHNOLOGY STACK — Score: **Good**

### 1.1 UI Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| **HeroUI** (`@heroui/react`) | ^3.0.4 | Primary component library (free tier) |
| **Tailwind CSS** | v4 | Utility-first CSS framework |
| **Framer Motion** | ^12.38.0 | Animations |
| **next-themes** | ^0.4.6 | Dark/light/system theme switching |
| **lucide-react** | ^1.17.0 | Primary icon library |

### 1.2 Utility Libraries

| Library | Purpose | Usage |
|---------|---------|-------|
| `clsx` | Conditional classnames | `lib/utils.js` |
| `tailwind-merge` | Tailwind class deduplication | `lib/utils.js` |
| `class-variance-authority` | Variant-based styling | In package.json |

These three form the standard "shadcn/ui utility trio". The `cn()` helper is properly defined:

```javascript
// lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
```

### 1.3 Dead Dependencies

| Package | In package.json | Actually imported in code |
|---------|----------------|--------------------------|
| `@fortawesome/fontawesome-svg-core` | Yes | **No** |
| `@fortawesome/free-solid-svg-icons` | Yes | **No** |
| `@fortawesome/react-fontawesome` | Yes | **No** |
| `@phosphor-icons/react` | Yes | **No** |

**3 FontAwesome packages + 1 Phosphor package are dead weight.** These should be removed to reduce install size and avoid confusion.

---

## 2. TOKEN SYSTEM — Score: **Excellent**

### 2.1 Architecture

The `globals.css` (377 lines) defines a comprehensive design token system:

```css
:root {
    /* Brand */
    --accent: oklch(0.675 0.18 249);        /* #159bff */
    --primary: var(--accent);
    
    /* Semantic */
    --destructive: hsl(0 84% 60%);
    --muted-foreground: hsl(220 9% 46%);
    --border: hsl(220 13% 91%);
    
    /* Sidebar */
    --sidebar-background: hsl(220 20% 97%);
    --sidebar-accent: color-mix(in oklch, var(--accent) 12%, transparent);
    
    /* Surface elevation (4 tiers) */
    --app-surface-card: var(--surface-secondary);
    --app-surface-input: var(--field-background);
    --app-surface-hover: var(--surface-tertiary);
    --app-surface-selected: color-mix(in oklch, var(--accent) 8%, transparent);
}
```

### 2.2 Surface Elevation System

The most impressive part of the token system:

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--app-surface-card` | `--surface-secondary` | `oklch(24% 0.006 286)` | Cards on panels |
| `--app-surface-input` | `--field-background` | `oklch(29% 0.005 286)` | Editable fields |
| `--app-surface-hover` | `--surface-tertiary` | `oklch(31% 0.004 286)` | Hover states |
| `--app-surface-selected` | 8% accent mix | 14% accent mix | Active/selected |

**Excellent:** The dark mode uses deliberate oklch lightness steps (+3pp card, +5pp input, +7pp hover) to create visual hierarchy. The comment explains the rationale: "panel ≈ 21% fixed by HeroUI" so cards emerge at 24%, inputs at 29%, hover at 31%.

### 2.3 Dark Mode — Score: **Very Good**

```css
.dark {
    --accent: oklch(0.72 0.18 249);  /* Raised from 0.675 for WCAG contrast */
    --destructive: hsl(0 84% 65%);   /* Raised from 60% for dark surfaces */
    --muted-foreground: hsl(215 20% 65%);  /* Raised from 46% for WCAG AA */
    --border: hsl(240 5% 26%);       /* Raised from 14% for visibility */
}
```

Every dark mode override has a comment explaining why the value was raised. This is documentation-driven development — future developers understand the WCAG constraints without needing to re-audit.

### 2.4 Tailwind v4 Integration

```css
@theme inline {
    --color-primary: var(--primary);
    --color-destructive: var(--destructive);
    --color-sidebar: var(--sidebar-background);
    --color-app-surface-card: var(--app-surface-card);
    /* ... */
}
```

**Good:** Maps CSS custom properties to Tailwind utility values. Components can use `bg-app-surface-card` or `text-destructive` directly.

---

## 3. COMPONENT LIBRARY — Score: **Good**

### 3.1 Primitive Components

| Component | Lines | Purpose | Quality |
|-----------|-------|---------|---------|
| `DataTable` | 791 | Filterable/sortable table | Very Good |
| `EmptyState` | 98 | Zero-data surfaces (6 variants) | Excellent |
| `ErrorState` | 28 | Error boundary fallback | Good |
| `Modal` | 40 | App-modal wrapper + footer | Good |
| `Field` | 25 | Label + error text | Good |
| `InlineEditField` | 56 | Commit-on-blur text input | Very Good |
| `SaveStatusIndicator` | 41 | Dirty/saving/saved dot | Good |
| `Stepper` | 130 | Wizard progress | Excellent |
| `ActionBar` | 60 | Floating pill toolbar | Very Good |
| `CardActionsMenu` | 81 | Hover-swap kebab menu | Good |
| `KpiCardGroup` | 40 | Side-by-side stat cards | Good |
| `DatePickerField` | 57 | Date picker wrapper | Good |
| `ThemeToggle` | 50 | Light/dark/system switcher | Good |

### 3.2 DataTable — Score: **Very Good**

At 791 lines, this is the most complex primitive. Features:
- Column sorting (multi-direction)
- Date range filtering
- Quick search (Ctrl+K)
- Row selection with bulk actions
- Expanded row rendering
- Mobile-responsive expanded view
- RTL-aware corner radius swapping
- Empty state integration (first-time vs search vs filter)

**Quality:** Comprehensive, well-structured, handles edge cases (RTL, mobile, empty states).

### 3.3 EmptyState — Score: **Excellent**

```javascript
const VARIANT = {
    firstTime:   { tone: "prominent", icon: Inbox },
    search:      { tone: "light",     icon: SearchX },
    filter:      { tone: "light",     icon: FilterX },
    permission:  { tone: "prominent", icon: Lock },
    integration: { tone: "prominent", icon: Plug },
    error:       { tone: "prominent", icon: TriangleAlert },
};
```

**Excellent:** Six variants with clear CTA strategy documented in the JSDoc. The rule "creation CTA belongs ONLY to firstTime; search/filter get recovery actions, never 'create'" prevents UX drift.

### 3.4 Stepper — Score: **Excellent**

Supports horizontal and vertical orientations, completed/active/upcoming states, clickable completed steps, and proper `aria-current="step"` for accessibility. Clean implementation using `cn()` for conditional classes.

### 3.5 ActionBar — Score: **Very Good**

Floating pill toolbar built on HeroUI's free `Toolbar` primitive. The CSS in `globals.css` handles:
- Fixed positioning offset past sidebar
- Gradient scrim backdrop
- Enter/exit animation via `data-open` attribute
- Collapsed sidebar adjustment
- Mobile: labels collapse to icon-only

Clever use of CSS `pointer-events: none` on the band + `pointer-events: auto` on the pill.

---

## 4. ICON STRATEGY — Score: **Fair**

### 4.1 Current State

| Source | Files | Icons Used |
|--------|-------|-----------|
| `lucide-react` | **53 files** | Primary icon library |
| Inline `<svg>` | **26 files** | Hand-coded SVGs |
| FontAwesome | **0 files** | Dead dependency |
| Phosphor Icons | **0 files** | Dead dependency |

### 4.2 Inline SVG Hotspots

| File | Inline SVGs | Purpose |
|------|------------|---------|
| `training/RightPanel.js` | 12 | Exercise UI icons (grip, copy, etc.) |
| `nutrition/RightPanel.js` | 7 | Meal item icons |
| `nutrition/MiddlePanel.js` | 5 | Meal card icons |
| `CardActionsMenu.js` | 4 | Chevron, more, duplicate, trash |

**Issue:** `CardActionsMenu.js` exports `DuplicateIcon` and `TrashIcon` as inline SVGs, but these are common icons available in lucide-react (`Copy`, `Trash2`). The inline versions have different viewBox/sizing than lucide icons, creating visual inconsistency.

### 4.3 Recommendation

Consolidate on `lucide-react` for all icons. Replace the ~50 inline SVGs across 26 files. Remove FontAwesome and Phosphor from package.json.

---

## 5. STYLING APPROACH — Score: **Good**

### 5.1 Strategy

The codebase uses a hybrid approach:
1. **Tailwind utilities** — Primary styling method (95%+ of styles)
2. **CSS custom properties** — For design tokens and elevation
3. **Component-layer CSS** — For complex patterns (action bar, sets table, sidebar)
4. **HeroUI component APIs** — For built-in component styling

### 5.2 Component Layer CSS

`globals.css` defines reusable component classes:

```css
@layer components {
    .auth-wrapper { ... }
    .auth-card { ... }
    .sidebar { ... }
    .action-bar { ... }
    .action-bar__wrapper { ... }
}
```

**Good:** Complex layout patterns (sidebar, action bar) are defined once in CSS rather than repeated in Tailwind classes. This keeps component JSX clean.

### 5.3 Global Transition

```css
@layer base {
    * {
        transition: background-color 200ms ease, border-color 200ms ease, color 150ms ease;
    }
}
```

**Issue:** Applying transitions to `*` (every element) can cause performance issues on pages with many elements. The transition on `color` (150ms) is particularly aggressive — text color changes everywhere on hover/focus. This is intentional for theme switching but may cause jank on complex pages.

### 5.4 RTL Support

The `globals.css` has extensive RTL overrides:
- Sidebar border swap
- Table corner radius swap (first/last child)
- Tab separator repositioning
- Search field icon margin swap

**Good:** RTL is handled at the CSS level rather than in JavaScript. The `dir="rtl"` selector is correct and SSR-safe.

---

## 6. DARK MODE — Score: **Very Good**

### 6.1 Implementation

- **`next-themes`** for theme management
- **`ThemeToggle`** component with 3 options (light/dark/system)
- **Cookie-based** persistence (`theme=${value}; path=/; max-age=31536000`)
- **SSR-safe** — `mounted` state prevents flash of wrong theme
- **Brand logo swap** — `.brand-logo-dark` / `.brand-logo-light` classes toggle visibility

### 6.2 Quality

```javascript
// ThemeToggle.js
if (!mounted) return <div className="h-8 w-24 rounded-full shrink-0" />;  // Skeleton
```

**Good:** Renders a skeleton placeholder during SSR to prevent layout shift. The cookie ensures theme persists across sessions without a flash.

### 6.3 Dark Mode Token Overrides

Every token has a documented reason for its dark mode value:
- `--accent`: "Raised lightness for WCAG contrast on dark surfaces"
- `--destructive`: "Bright enough to convey urgency on dark surfaces"
- `--muted-foreground`: "Raised from 55% → 65% for WCAG AA on dark surfaces"
- `--border`: "Raised from 14% → 26% so borders are actually visible"

**Very Good:** This is accessibility-driven design. The comments explain the "why" behind every value.

---

## 7. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File(s) | Fix |
|---|-------|----------|---------|-----|
| 1 | **3 FontAwesome + 1 Phosphor packages are dead weight** | MEDIUM | `package.json` | Remove unused dependencies |
| 2 | **~50 inline SVGs across 26 files** — inconsistent with lucide-react | MEDIUM | 26 files | Consolidate on lucide-react |
| 3 | **Global `*` transition** — may cause jank on complex pages | LOW | `globals.css:147` | Scope to specific elements or use `will-change` |
| 4 | **No Storybook or component documentation** | LOW | — | Add Storybook for visual testing |
| 5 | **`SaveStatusIndicator` has hardcoded English defaults** — not i18n | LOW | `SaveStatusIndicator.js:8` | Accept labels from i18n |

---

## 8. WHAT'S WELL DONE

1. **Token system** — The 4-tier surface elevation (card → input → hover → selected) with oklch lightness steps is production-grade. The comments explain WCAG rationale.

2. **Dark mode** — Every override has a documented reason. The oklch color space provides perceptually uniform lightness adjustments.

3. **EmptyState variants** — Six variants with clear CTA strategy prevents UX drift. The "creation CTA belongs ONLY to firstTime" rule is excellent.

4. **DataTable** — 791 lines of comprehensive table functionality (sort, filter, search, selection, RTL, mobile). This is a serious component.

5. **Stepper** — Clean, accessible (`aria-current="step"`), supports both orientations. Uses `cn()` for conditional classes.

6. **ActionBar** — Clever CSS architecture: `pointer-events: none` band + `pointer-events: auto` pill. Animated via `data-open` attribute.

7. **RTL support** — Extensive CSS-level RTL overrides for tables, tabs, sidebar, and search. SSR-safe via `dir="rtl"` selector.

8. **Brand logo swap** — CSS-only theme-aware wordmark switching. No JavaScript needed.

9. **InlineEditField** — Commit-on-blur, revert-on-Escape, select-on-focus. Well-documented behavior.

10. **`cn()` utility** — Standard shadcn/ui pattern. Properly implemented with clsx + tailwind-merge.

---

## 9. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Remove FontAwesome (3 packages) and Phosphor (1 package) from `package.json`
2. Replace inline SVGs in `CardActionsMenu.js` with lucide-react icons (`Copy`, `Trash2`, `MoreVertical`, `ChevronRight`)

### Short-term
3. Consolidate remaining ~45 inline SVGs across 26 files to lucide-react
4. Add `SaveStatusIndicator` i18n labels
5. Consider scoping the global `*` transition to specific element types

### Medium-term
6. Add Storybook for visual component documentation
7. Consider extracting `DataTable` into a shared package (it's 791 lines and used across many pages)

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 6 — Coach Features*
