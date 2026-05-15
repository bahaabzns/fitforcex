# Dark Mode Implementation Plan — FitForce X

**Goal:** Add a fully working light/dark/system theme toggle to every page, with zero hardcoded colors surviving.

**Stack context:**
- HeroUI v3 (reads `.dark` class on `<html>`)
- Tailwind CSS v4 (PostCSS mode)
- Next.js App Router
- CSS custom properties already defined in `globals.css` for both `:root` (light) and `.dark`
- `providers.js` currently a no-op pass-through — HeroUI provider NOT active yet

---

## Prerequisites / Quick Orientation

Before touching any page, understand the three layers that must cooperate:

| Layer | File | Role |
|---|---|---|
| CSS tokens | `client/app/globals.css` | Defines HSL values for `:root` and `.dark` |
| Tailwind `@theme` | `client/app/globals.css` | Maps tokens to utility classes (`bg-background`, `text-foreground`, etc.) |
| HeroUI | `providers.js` (not active yet) | Applies its own internal color scale using `.dark` on `<html>` |
| Theme manager | (not installed yet) | Toggles `.dark` on `<html>`, persists preference |

The `.dark` class on `<html>` is the single source of truth. Everything else reads from it.

---

## Phase 0 — Activate the HeroUI Provider (MUST DO FIRST)

HeroUI components render unstyled without their provider context. This is a blocker for everything else.

### Step 0.1 — Update `providers.js`

File: `client/app/providers.js`

```js
'use client';

import { HeroUIProvider } from '@heroui/react';

export function Providers({ children }) {
    return (
        <HeroUIProvider>
            {children}
        </HeroUIProvider>
    );
}
```

### Step 0.2 — Verify HeroUI styles are importing

File: `client/app/globals.css` — line 1 must be:

```css
@import "@heroui/react/styles";
```

This is already present. No change needed.

### Step 0.3 — Verify `next.config.mjs` has transpilePackages

```js
transpilePackages: ["@heroui/react", "@heroui/styles"]
```

Already present. No change needed.

### Step 0.4 — Smoke test

Run `npm run dev` and open any page. HeroUI components (Button, Chip, Table) should now render with proper styles. If they look unstyled, check the import order in `globals.css` (HeroUI styles must come first).

---

## Phase 1 — Install and Configure `next-themes`

`next-themes` is the standard library for theme toggling in Next.js. It handles:
- Applying `.dark` / `.light` class to `<html>` on the server (via a blocking script)
- Persisting the chosen theme to `localStorage`
- Reacting to the OS-level `prefers-color-scheme` media query
- Avoiding the flash of wrong theme on load

### Step 1.1 — Install the package

```bash
cd client
npm install next-themes
```

### Step 1.2 — Wrap the app in `ThemeProvider`

File: `client/app/providers.js`

```js
'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <HeroUIProvider>
                {children}
            </HeroUIProvider>
        </ThemeProvider>
    );
}
```

**Why these props:**
- `attribute="class"` — applies `class="dark"` on `<html>`, which is what HeroUI and our CSS tokens both read
- `defaultTheme="system"` — new users follow their OS preference
- `enableSystem` — allows the "system" option in the toggle
- `disableTransitionOnChange` — prevents a CSS transition flash when switching themes (you can remove this later if you want smooth transitions)

### Step 1.3 — Add `suppressHydrationWarning` to `<html>`

File: `client/app/layout.js`

```js
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
    title: "FitForce X",
    description: "Fitness coaching platform",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
```

**Why:** `next-themes` injects a blocking `<script>` that sets the class on `<html>` before React hydrates. Without `suppressHydrationWarning`, React will warn about a class mismatch between server and client. This prop tells React to ignore attribute differences on `<html>` only.

---

## Phase 2 — Build the ThemeToggle Component

### Step 2.1 — Create the component file

File: `client/app/components/ThemeToggle.js`

```js
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch — render nothing until mounted on client
    useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="w-9 h-9" />;

    const cycles = ['light', 'dark', 'system'];
    const next = cycles[(cycles.indexOf(theme) + 1) % cycles.length];

    const icons = {
        light: <Sun size={16} />,
        dark: <Moon size={16} />,
        system: <Monitor size={16} />,
    };

    const labels = {
        light: 'Light',
        dark: 'Dark',
        system: 'System',
    };

    return (
        <Button
            isIconOnly
            variant="ghost"
            size="sm"
            aria-label={`Current theme: ${labels[theme]}. Click to switch to ${labels[next]}`}
            onPress={() => setTheme(next)}
        >
            {icons[theme]}
        </Button>
    );
}
```

**Why the `mounted` guard:** On the server, `theme` is always `undefined` because `next-themes` reads `localStorage`, which doesn't exist server-side. Without this guard you'd render the wrong icon on the server, causing a hydration mismatch error.

### Step 2.2 — Add toggle to the main Sidebar

File: `client/app/components/Sidebar.js`

Locate the bottom section of the sidebar (usually where the user avatar/name lives) and add the toggle there:

```js
import { ThemeToggle } from './ThemeToggle';

// Inside the sidebar JSX, near the user info at the bottom:
<div className="flex items-center gap-2">
    {/* existing user avatar/name */}
    <ThemeToggle />
</div>
```

### Step 2.3 — Add toggle to ClientSidebar

File: `client/app/components/ClientSidebar.js`

Same as above — find the bottom user section and add `<ThemeToggle />`.

### Step 2.4 — Add toggle to Admin layout

File: `client/app/(admin)/admin/layout.js`

If the admin area has a header or sidebar, place `<ThemeToggle />` there. If it's just a bare layout, add a floating toggle in the top-right corner:

```js
import { ThemeToggle } from '@/app/components/ThemeToggle';

// Inside the layout JSX:
<div className="absolute top-4 right-4 z-50">
    <ThemeToggle />
</div>
```

---

## Phase 3 — Verify CSS Tokens Cover All Colors

The `globals.css` already defines `:root` and `.dark` tokens. Verify these cover every color that appears in the UI.

### Step 3.1 — Current tokens checklist

Open `client/app/globals.css` and confirm all of these exist in both `:root` and `.dark`:

| Token | Light value | Dark value |
|---|---|---|
| `--primary` | `211 100% 50%` | `211 100% 60%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--destructive` | `0 84% 60%` | `0 63% 31%` |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 98%` |
| `--muted-foreground` | `220 9% 46%` | `215 20% 55%` |
| `--border` | `220 13% 91%` | `222 47% 16%` |
| `--sidebar-background` | `220 20% 97%` | `222 47% 9%` |
| `--sidebar-foreground` | `222 47% 11%` | `213 31% 91%` |
| `--sidebar-accent` | `220 14% 93%` | `222 47% 13%` |
| `--sidebar-accent-foreground` | `222 47% 11%` | `213 31% 91%` |
| `--sidebar-border` | `220 13% 91%` | `222 47% 16%` |

HeroUI v3 manages its own tokens (`--background`, `--foreground`, `--surface`, `--content1`–`4`, etc.) via the `@import "@heroui/react/styles"` line. Do NOT redefine those — the import handles them for both themes automatically.

### Step 3.2 — Add any missing tokens

If you find colors in components that don't map to any token above, add them to `globals.css` in both `:root` and `.dark` blocks, then add a `@theme inline` entry to expose them as Tailwind utilities.

Pattern:
```css
:root {
  --my-token: <light HSL components>;
}
.dark {
  --my-token: <dark HSL components>;
}
```

```css
@theme inline {
  --color-my-token: hsl(var(--my-token));
}
```

Then use `bg-my-token` / `text-my-token` in components.

---

## Phase 4 — Audit Every Page for Hardcoded Colors

This is the most tedious phase. Go file by file and replace every hardcoded color class with a semantic token.

### Step 4.1 — Run a global search for hardcoded color classes

Run this in the `client/` directory to find every file with a hardcoded Tailwind color:

```bash
grep -rn "bg-white\|bg-gray\|bg-slate\|bg-zinc\|bg-neutral\|bg-stone\|text-black\|text-white\|text-gray\|text-slate\|border-gray\|border-slate" app/ --include="*.js" --include="*.jsx" --include="*.tsx" --include="*.ts"
```

Save the output. This is your audit list.

### Step 4.2 — Replacement mapping

| Hardcoded class | Semantic replacement | Notes |
|---|---|---|
| `bg-white` | `bg-background` or `bg-surface` | Use `bg-surface` for cards/panels |
| `bg-gray-50` | `bg-background` | Page background |
| `bg-gray-100` | `bg-sidebar-accent` or `bg-content1` | Subtle fill |
| `bg-gray-200` | `bg-content2` | |
| `bg-gray-800` | `bg-content3` | Inverted |
| `bg-gray-900` | `bg-foreground` | Very dark fill |
| `text-black` | `text-foreground` | |
| `text-gray-500` | `text-muted-foreground` | |
| `text-gray-400` | `text-muted-foreground` | |
| `text-gray-700` | `text-foreground` | |
| `text-gray-900` | `text-foreground` | |
| `text-white` | `text-primary-foreground` | Only on colored backgrounds |
| `border-gray-200` | `border-border` | |
| `border-gray-300` | `border-border` | |

**Important:** Never replace `text-white` on a dark background (like a blue button) — that's intentional. Only replace `text-white` used on a white/light background, which is invisible in light mode anyway.

### Step 4.3 — Page-by-page audit checklist

Work through each section. Mark ✅ when done.

#### Admin section (`app/(admin)/admin/`)

- [ ] `layout.js` — check wrapper divs for `bg-*` and `text-*`
- [ ] `page.js` — dashboard stats/cards
- [ ] `login/page.js` — auth card background, input backgrounds
- [ ] `plans/page.js` — table, badges, stat cards
- [ ] `users/page.js` — table, badges
- [ ] `workspaces/page.js` — table, action buttons
- [ ] `loading.js` — skeleton backgrounds
- [ ] `users/loading.js` — skeleton backgrounds
- [ ] `workspaces/loading.js` — skeleton backgrounds

#### Coach section (`app/(coach)/[workspaceSlug]/`)

- [ ] `dashboard/page.js` — StatCard divs, badge spans (these are the main offenders per the migration plan)
- [ ] `dashboard/loading.js`
- [ ] `clients/page.js`
- [ ] `clients/loading.js`
- [ ] `clients/[id]/page.js`
- [ ] `clients/[id]/layout.js`
- [ ] `clients/[id]/loading.js`
- [ ] `clients/[id]/nutrition/loading.js`
- [ ] `clients/[id]/training/loading.js`
- [ ] `clients/[id]/forms/loading.js`
- [ ] `clients/[id]/transactions/page.js`
- [ ] `finance/packages/page.js`
- [ ] `finance/payment-methods/page.js`
- [ ] `finance/transactions/page.js`
- [ ] `forms/loading.js`
- [ ] `nutrition/food-categories/page.js`
- [ ] `nutrition/food-categories/loading.js`
- [ ] `nutrition/food-items/page.js`
- [ ] `nutrition/food-items/loading.js`

#### Client portal (`app/(client)/portal/`)

- [ ] `layout.js`
- [ ] `login/page.js`
- [ ] `login/loading.js`
- [ ] `dashboard/page.js`
- [ ] `dashboard/loading.js`
- [ ] `forms/page.js`
- [ ] `forms/[requestId]/page.js`
- [ ] `training/page.js`
- [ ] `[coachSlug]/page.js`

#### Shared components (`app/components/`)

- [ ] `Sidebar.js` — already uses CSS tokens, but double-check
- [ ] `ClientSidebar.js` — raw `<button>` elements, likely hardcoded
- [ ] `DataTable.js` — verify table headers and rows
- [ ] `Modal.js` — custom dialog portal, overlay background
- [ ] `NameModal.js`
- [ ] `ErrorState.js`
- [ ] `MacrosBadges.js`
- [ ] `training/LeftPanel.js`
- [ ] `training/MiddlePanel.js`
- [ ] `training/RightPanel.js`
- [ ] `training/ExercisePickerModal.js`
- [ ] `nutrition/LeftPanel.js`
- [ ] `nutrition/MiddlePanel.js`
- [ ] `nutrition/RightPanel.js`
- [ ] `nutrition/CycleCalculator.js`
- [ ] `nutrition/FoodItemsModal.js`
- [ ] `forms/FormsPanel.js`
- [ ] `forms/QuestionsPanel.js`
- [ ] `forms/QuestionEditorPanel.js`
- [ ] `plansQueue/PlansQueueTable.js`

#### shadcn wrapper components (`components/ui/`)

These are NOT HeroUI — they're custom wrappers. They'll be removed as HeroUI migration progresses, but until then they need dark mode support:

- [ ] `button.jsx` — check variant colors
- [ ] `input.jsx` — background, border, text
- [ ] `label.jsx` — text color
- [ ] `select.jsx` — background, border, options
- [ ] `textarea.jsx` — background, border, text
- [ ] `card.jsx` — background, border, shadow
- [ ] `badge.jsx` — variant backgrounds
- [ ] `dialog.jsx` — overlay and panel backgrounds
- [ ] `avatar.jsx` — fallback background
- [ ] `table.jsx` — header, row, border
- [ ] `tabs.jsx` — active/inactive states
- [ ] `alert.jsx` — variant backgrounds
- [ ] `progress.jsx` — track and fill
- [ ] `separator.jsx` — color
- [ ] `skeleton.jsx` — pulse background

For shadcn components, the typical fix is replacing hardcoded classes with their Tailwind dark: variants or semantic tokens. Example for a card:

```js
// Before
<div className="bg-white border border-gray-200 rounded-lg p-4">

// After
<div className="bg-surface border border-border rounded-lg p-4">
```

---

## Phase 5 — Fix Loading Skeletons

Loading states deserve special attention — they're the first thing users see on every navigation.

### Step 5.1 — Replace custom skeleton divs with HeroUI Skeleton

Any component like this:
```js
<div className="animate-pulse bg-gray-200 rounded h-8 w-32" />
```

Replace with HeroUI's Skeleton (which auto-adapts to dark mode):
```js
import { Skeleton } from '@heroui/react';

<Skeleton className="rounded h-8 w-32" />
```

### Step 5.2 — Files with custom skeletons to update

These were flagged in the migration plan:
- `app/(coach)/layout.js` — uses `@/components/ui/skeleton`
- `app/(client)/portal/layout.js` — uses `@/components/ui/skeleton`
- `app/(coach)/[workspaceSlug]/dashboard/page.js` — has `manual skeleton` comment
- All `loading.js` files listed in Phase 4

---

## Phase 6 — Handle Special Cases

### Step 6.1 — Custom modal overlays

The custom `Modal.js` uses a portal with a backdrop. The overlay must work in dark mode:

```js
// Dark mode-aware overlay
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />

// Dark mode-aware panel
<div className="bg-surface border border-border rounded-2xl shadow-xl p-6">
```

`bg-black/50` works in both modes (it's a semi-transparent black). The panel uses `bg-surface` which adapts automatically.

### Step 6.2 — Inline styles with hardcoded colors

Search for inline `style={{ backgroundColor: '...' }}` or `style={{ color: '...' }}`:

```bash
grep -rn "style={{" app/ --include="*.js" | grep -i "color\|background"
```

Replace each with CSS custom property references:
```js
// Before
style={{ backgroundColor: '#fff' }}

// After — use className instead
className="bg-surface"
```

If a CSS variable is unavoidable in an inline style:
```js
style={{ backgroundColor: 'hsl(var(--sidebar-background))' }}
```

### Step 6.3 — SVG icons

All Lucide icons use `currentColor` by default, so they inherit text color and adapt automatically. No changes needed.

For any custom inline SVGs with hardcoded `fill` or `stroke`:
```jsx
// Before
<svg><path fill="#333" /></svg>

// After
<svg><path fill="currentColor" /></svg>
```

### Step 6.4 — Chart or data visualization components

If any page uses Recharts, Chart.js, or similar, the chart colors are set programmatically — not via Tailwind classes. You'll need to read the CSS variable at runtime:

```js
function getCSSVar(name) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim();
}

// Use in chart config:
const primaryColor = getCSSVar('--primary'); // returns "211 100% 50%"
const color = `hsl(${primaryColor})`;
```

Or use a hook that re-reads values when the theme changes:
```js
import { useTheme } from 'next-themes';

function useChartColors() {
    const { resolvedTheme } = useTheme();
    // Return appropriate colors based on resolvedTheme
    return resolvedTheme === 'dark'
        ? { primary: 'hsl(211 100% 60%)' }
        : { primary: 'hsl(211 100% 50%)' };
}
```

### Step 6.5 — Images with white backgrounds

If any `<img>` or `<Image>` component has a white background built into the image file itself, you may need to add a `mix-blend-mode` or use an SVG version instead. Flag these for design review — this is a design decision, not a code decision.

---

## Phase 7 — Add Theme Transition (Optional Polish)

Optionally add a smooth color transition when switching themes. Remove `disableTransitionOnChange` from the `ThemeProvider` and add this to `globals.css`:

```css
@layer base {
  * {
    transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
  }
}
```

**Warning:** This can cause flicker on initial page load if `disableTransitionOnChange` is removed. Test carefully. If the flicker is noticeable, keep `disableTransitionOnChange` and skip this step.

---

## Phase 8 — Persist Theme Preference in Cookies (SSR Enhancement)

`next-themes` defaults to `localStorage`, which causes a flash on first load for users whose OS preference differs from the default. To eliminate this, read the theme from a cookie on the server.

### Step 8.1 — Set a cookie when the theme changes

File: `client/app/components/ThemeToggle.js`

```js
const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
};

// Replace onPress={() => setTheme(next)} with:
onPress={() => handleThemeChange(next)}
```

### Step 8.2 — Read the cookie in the root layout

File: `client/app/layout.js`

```js
import { cookies } from 'next/headers';
import { Providers } from "./providers";
import "./globals.css";

export const metadata = { ... };

export default async function RootLayout({ children }) {
    const cookieStore = await cookies();
    const theme = cookieStore.get('theme')?.value ?? 'system';

    return (
        <html lang="en" suppressHydrationWarning className={theme === 'dark' ? 'dark' : ''}>
            <body>
                <Providers defaultTheme={theme}>{children}</Providers>
            </body>
        </html>
    );
}
```

### Step 8.3 — Pass `defaultTheme` to ThemeProvider

File: `client/app/providers.js`

```js
'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider } from 'next-themes';

export function Providers({ children, defaultTheme = 'system' }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={defaultTheme}
            enableSystem
            disableTransitionOnChange
        >
            <HeroUIProvider>
                {children}
            </HeroUIProvider>
        </ThemeProvider>
    );
}
```

**Note:** This is an optional enhancement. The base implementation in Phase 1 is sufficient for most cases. Skip this phase if SSR flash is not a problem in practice.

---

## Phase 9 — Testing Checklist

Test every major page in all three themes: **Light**, **Dark**, and **System**.

### Visual test — what to look for

- [ ] No white boxes on dark background
- [ ] No invisible text (white on white, black on black)
- [ ] Borders are visible but not harsh
- [ ] Form inputs have visible backgrounds and borders
- [ ] Buttons have correct contrast in all states (default, hover, disabled)
- [ ] Loading skeletons match the background correctly (not bright white in dark mode)
- [ ] Modals and overlays are readable
- [ ] Error states and alerts are readable
- [ ] Charts/graphs are readable (if applicable)
- [ ] The theme toggle icon reflects the current theme
- [ ] Theme persists across page refreshes
- [ ] Theme persists across browser sessions

### Pages to test

| Route | Light | Dark | System |
|---|---|---|---|
| `/admin` (admin dashboard) | | | |
| `/admin/login` | | | |
| `/admin/plans` | | | |
| `/admin/users` | | | |
| `/admin/workspaces` | | | |
| `/[workspaceSlug]/dashboard` | | | |
| `/[workspaceSlug]/clients` | | | |
| `/[workspaceSlug]/clients/[id]` | | | |
| `/[workspaceSlug]/clients/[id]/nutrition` | | | |
| `/[workspaceSlug]/clients/[id]/training` | | | |
| `/[workspaceSlug]/clients/[id]/forms` | | | |
| `/[workspaceSlug]/clients/[id]/transactions` | | | |
| `/[workspaceSlug]/finance/transactions` | | | |
| `/[workspaceSlug]/finance/packages` | | | |
| `/[workspaceSlug]/finance/payment-methods` | | | |
| `/[workspaceSlug]/nutrition/food-categories` | | | |
| `/[workspaceSlug]/nutrition/food-items` | | | |
| `/portal/dashboard` (client) | | | |
| `/portal/forms` (client) | | | |
| `/portal/training` (client) | | | |
| `/portal/login` (client) | | | |
| `/portal/[coachSlug]` (public) | | | |

### Automated check

After completing all phases, run this grep to find any remaining hardcoded color classes:

```bash
grep -rn "bg-white\|bg-gray-\|bg-slate-\|text-black\|text-gray-[0-9]\|border-gray-[0-9]" \
  app/ components/ \
  --include="*.js" --include="*.jsx" --include="*.tsx"
```

Zero results = done. Any result = fix it before shipping.

---

## Implementation Order Summary

| # | Task | Effort | Blocker for |
|---|---|---|---|
| 0 | Activate HeroUI Provider | 5 min | Everything |
| 1 | Install next-themes, wrap providers, add suppressHydrationWarning | 10 min | Toggle component |
| 2 | Build ThemeToggle, add to sidebars | 15 min | User can switch themes |
| 3 | Verify CSS tokens in globals.css | 5 min | Phase 4 |
| 4 | Audit + fix hardcoded colors, page by page | 2–4 hrs | Visual correctness |
| 5 | Replace custom skeleton divs with HeroUI Skeleton | 30 min | |
| 6 | Fix special cases (modals, inline styles, SVGs) | 30 min | |
| 7 | Optional: add theme transition | 5 min | |
| 8 | Optional: SSR cookie enhancement | 20 min | |
| 9 | Full visual test | 1 hr | Ship |

**Minimum viable dark mode:** Phases 0–3 + enough of Phase 4 to cover the most-visited pages. The rest can ship incrementally.
