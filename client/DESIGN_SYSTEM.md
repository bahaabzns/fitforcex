# shadcn/ui Design System — Master Prompt

Use this prompt as a complete specification when building UI components, pages, or full SaaS products in the style of the shadcn/ui design system.

---

## 1. PHILOSOPHY & PRINCIPLES

- **Copy-paste first**: Components are not installed from a package — they live in your codebase and are fully owned and customizable.
- **Unstyled primitives**: Built on top of Radix UI headless primitives for accessibility and behavior; styled via Tailwind CSS utility classes.
- **Accessible by default**: All components follow WAI-ARIA patterns. Keyboard navigation, focus management, screen reader support, and ARIA attributes are always present.
- **No magic**: No runtime CSS-in-JS, no heavy abstractions. What you see is what you get.
- **Composable**: Every component is broken into its smallest meaningful parts (e.g., `Card`, `CardHeader`, `CardContent`, `CardFooter`) so they can be composed freely.
- **TypeScript-first**: Every component has full TypeScript types and prop interfaces.
- **Theme-driven**: All colors, radii, and spacing are CSS custom properties on `:root`, making global theming instant.

---

## 2. TECHNOLOGY STACK

- **Framework**: React (Next.js or Vite)
- **Styling**: Tailwind CSS v3/v4
- **Primitives**: Radix UI (`@radix-ui/react-*`)
- **Icons**: `lucide-react`
- **Utilities**: `clsx` + `tailwind-merge` via a `cn()` helper
- **Fonts**: `Geist Sans` (primary), `Geist Mono` (code) — loaded via `next/font` or CSS import
- **Animation**: `tailwindcss-animate` plugin for keyframes; `tw-animate-css` for extended animations

```ts
// The universal utility — always use this for className merging
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 3. CSS CUSTOM PROPERTIES (Design Tokens)

All tokens live on `:root` and are overridden inside `.dark`. Values are in HSL format (h s% l%) without the `hsl()` wrapper — Tailwind consumes them as `hsl(var(--token))`.

### Light Mode

```css
:root {
  /* Base */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  /* Card */
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  /* Popover */
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  /* Primary */
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  /* Secondary */
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  /* Muted */
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  /* Accent */
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  /* Destructive */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  /* Border, Input, Ring */
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;

  /* Chart colors */
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;

  /* Shape */
  --radius: 0.5rem;

  /* Sidebar (if applicable) */
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-primary: 240 5.9% 10%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}
```

### Dark Mode

```css
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  --sidebar-background: 240 5.9% 10%;
  --sidebar-foreground: 240 4.8% 95.9%;
  --sidebar-primary: 224.3 76.3% 48%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 240 4.8% 95.9%;
  --sidebar-border: 240 3.7% 15.9%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}
```

### Tailwind Config Mapping

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
      primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
      secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
      muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
      accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
      destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      chart: {
        "1": "hsl(var(--chart-1))",
        "2": "hsl(var(--chart-2))",
        "3": "hsl(var(--chart-3))",
        "4": "hsl(var(--chart-4))",
        "5": "hsl(var(--chart-5))",
      },
      sidebar: {
        DEFAULT: "hsl(var(--sidebar-background))",
        foreground: "hsl(var(--sidebar-foreground))",
        primary: "hsl(var(--sidebar-primary))",
        "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
        accent: "hsl(var(--sidebar-accent))",
        "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        border: "hsl(var(--sidebar-border))",
        ring: "hsl(var(--sidebar-ring))",
      },
    },
    borderRadius: {
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
  },
}
```

---

## 4. TYPOGRAPHY

### Font Stack

```css
body {
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, pre, kbd, samp {
  font-family: ui-monospace, monospace;
}
```

### Type Scale (Tailwind classes)

| Role | Class |
|---|---|
| Display / H1 | `text-4xl font-extrabold tracking-tight` |
| H2 | `text-3xl font-semibold tracking-tight` |
| H3 | `text-2xl font-semibold tracking-tight` |
| H4 | `text-xl font-semibold tracking-tight` |
| Large | `text-lg font-semibold` |
| Body (default) | `text-sm` (14px) |
| Small | `text-sm font-medium leading-none` |
| Muted / Caption | `text-sm text-muted-foreground` |
| Code inline | `text-sm font-mono` |

> The entire system defaults to `text-sm` (14px) as the base body size — NOT 16px.

---

## 5. SPACING & LAYOUT

- Base unit: `4px` (Tailwind's `1` unit)
- Component inner padding: `p-4` (16px) to `p-6` (24px)
- Card padding: `p-6`
- Form field gap: `gap-2` between label and input, `gap-4` between fields
- Section gap: `gap-6` to `gap-8`
- Sidebar width: `16rem` (256px) collapsed, `20rem` (320px) expanded
- Content max-width: `max-w-2xl` for forms, `max-w-7xl` for dashboards

---

## 6. BORDER, SHADOW & RADIUS

```css
/* Borders are always 1px, color from --border */
border: 1px solid hsl(var(--border));

/* Shadows — very subtle */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)
shadow:    0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)
shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)

/* Radius scale */
--radius: 0.5rem   /* 8px  — default, used on cards, dialogs */
calc(var(--radius) - 2px) /* 6px — inputs, selects */
calc(var(--radius) - 4px) /* 4px — badges, small elements */
9999px              /* fully round — pills, avatars */
```

---

## 7. FOCUS & INTERACTION STATES

```css
/* Focus ring — always 2px ring + 2px offset */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2

/* Disabled */
disabled:pointer-events-none
disabled:opacity-50

/* Hover on interactive surfaces */
hover:bg-accent hover:text-accent-foreground

/* Active press */
active:scale-[0.98]
```

---

## 8. COMPONENT SPECIFICATIONS

### Button

**Variants**: `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`
**Sizes**: `default` | `sm` | `lg` | `icon`

```tsx
// Base classes (all buttons)
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

// Variant classes
default:     "bg-primary text-primary-foreground hover:bg-primary/90"
destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80"
ghost:       "hover:bg-accent hover:text-accent-foreground"
link:        "text-primary underline-offset-4 hover:underline"

// Size classes
default: "h-10 px-4 py-2"
sm:      "h-9 rounded-md px-3"
lg:      "h-11 rounded-md px-8"
icon:    "h-10 w-10"
```

---

### Input

```tsx
"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium
 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
```

---

### Textarea

```tsx
"flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm
 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none
 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50"
```

---

### Label

```tsx
"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
```

---

### Card

```tsx
// Card (wrapper)
"rounded-lg border bg-card text-card-foreground shadow-sm"

// CardHeader
"flex flex-col space-y-1.5 p-6"

// CardTitle
"text-2xl font-semibold leading-none tracking-tight"

// CardDescription
"text-sm text-muted-foreground"

// CardContent
"p-6 pt-0"

// CardFooter
"flex items-center p-6 pt-0"
```

---

### Badge

**Variants**: `default` | `secondary` | `destructive` | `outline`

```tsx
// Base
"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold
 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

default:     "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
secondary:   "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80"
outline:     "text-foreground"
```

---

### Select (Radix)

```tsx
// Trigger
"flex h-10 w-full items-center justify-between rounded-md border border-input bg-background
 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground
 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"

// Content (dropdown panel)
"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover
 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out
 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95
 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 ..."

// Item
"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2
 text-sm outline-none focus:bg-accent focus:text-accent-foreground
 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
```

---

### Checkbox (Radix)

```tsx
// Root
"peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background
 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50
 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"

// Indicator
"flex items-center justify-center text-current"
// Icon inside: <Check className="h-4 w-4" />
```

---

### Switch (Radix)

```tsx
// Root
"peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2
 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
 disabled:cursor-not-allowed disabled:opacity-50
 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"

// Thumb
"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
```

---

### Dialog (Radix)

```tsx
// Overlay
"fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out
 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

// Content
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]
 gap-4 border bg-background p-6 shadow-lg duration-200
 data-[state=open]:animate-in data-[state=closed]:animate-out
 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]
 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]
 sm:rounded-lg"

// Header
"flex flex-col space-y-1.5 text-center sm:text-left"

// Footer
"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"

// Title
"text-lg font-semibold leading-none tracking-tight"

// Description
"text-sm text-muted-foreground"

// CloseButton
"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity
 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
```

---

### Sheet (Radix — Drawer variant of Dialog)

```tsx
// Overlay — same as Dialog
// Content variants by side:
left:   "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm"
right:  "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm"
top:    "inset-x-0 top-0 border-b"
bottom: "inset-x-0 bottom-0 border-t"

// Slide animations per side are added as data-[state] variants
```

---

### Dropdown Menu (Radix)

```tsx
// Content
"z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1
 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out
 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ..."

// Item
"relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm
 outline-none transition-colors focus:bg-accent focus:text-accent-foreground
 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

// Separator
"-mx-1 my-1 h-px bg-muted"

// Label
"px-2 py-1.5 text-sm font-semibold"

// Shortcut
"ml-auto text-xs tracking-widest opacity-60"

// CheckboxItem — adds check icon at pl-8
// RadioItem — same pattern
// SubTrigger — adds ChevronRight icon at ml-auto
```

---

### Tooltip (Radix)

```tsx
// Content
"z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground
 shadow-md animate-in fade-in-0 zoom-in-95
 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2
 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"

// Provider: delayDuration={0} (instant)
```

---

### Popover (Radix)

```tsx
// Content
"z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none
 data-[state=open]:animate-in data-[state=closed]:animate-out
 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ..."
```

---

### Tabs (Radix)

```tsx
// List
"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"

// Trigger
"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm
 font-medium ring-offset-background transition-all focus-visible:outline-none
 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
 disabled:pointer-events-none disabled:opacity-50
 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"

// Content
"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-ring focus-visible:ring-offset-2"
```

---

### Accordion (Radix)

```tsx
// Item
"border-b"

// Trigger
"flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline
 [&[data-state=open]>svg]:rotate-180"
// Icon: ChevronDown with "h-4 w-4 shrink-0 transition-transform duration-200"

// Content
"overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up
 data-[state=open]:animate-accordion-down"
// Content inner div: "pb-4 pt-0"
```

---

### Alert

**Variants**: `default` | `destructive`

```tsx
// Base
"relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px]
 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground"

default:     "bg-background text-foreground"
destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"

// AlertTitle
"mb-1 font-medium leading-none tracking-tight"

// AlertDescription
"text-sm [&_p]:leading-relaxed"
```

---

### Toast / Sonner

```tsx
// Uses `sonner` library — styled via toaster CSS variables
// Positioned bottom-right by default
// Variants: default, success, error, warning, info
// Duration: 4000ms default
// Has close button, action button support
```

---

### Progress

```tsx
// Root
"relative h-4 w-full overflow-hidden rounded-full bg-secondary"

// Indicator
"h-full w-full flex-1 bg-primary transition-all"
// translateX: `translateX(-${100 - (value || 0)}%)`
```

---

### Skeleton

```tsx
"animate-pulse rounded-md bg-muted"
```

---

### Separator (Radix)

```tsx
// Horizontal
"shrink-0 bg-border h-[1px] w-full"

// Vertical
"shrink-0 bg-border h-full w-[1px]"
```

---

### Avatar (Radix)

```tsx
// Root
"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full"

// Image
"aspect-square h-full w-full"

// Fallback
"flex h-full w-full items-center justify-center rounded-full bg-muted"
// Text inside: text-sm font-medium initials
```

---

### Table

```tsx
// Table wrapper
"relative w-full overflow-auto"

// Table
"w-full caption-bottom text-sm"

// TableHeader
"[&_tr]:border-b"

// TableBody
"[&_tr:last-child]:border-0"

// TableFooter
"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0"

// TableRow
"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"

// TableHead
"h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"

// TableCell
"p-4 align-middle [&:has([role=checkbox])]:pr-0"

// TableCaption
"mt-4 text-sm text-muted-foreground"
```

---

### Form (React Hook Form + Zod)

```tsx
// FormItem
"space-y-2"

// FormLabel — inherits Label + adds error state
"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
// Error state: "text-destructive" on label

// FormControl — just a Slot (no additional classes)

// FormDescription
"text-sm text-muted-foreground"

// FormMessage
"text-sm font-medium text-destructive"
```

---

### Sidebar

```tsx
// Layout wrapper (with sidebar)
"group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar"

// Sidebar root
"group peer hidden md:block text-sidebar-foreground"
// Width: w-[--sidebar-width] default 16rem, w-[--sidebar-width-icon] 3rem when collapsed

// Sidebar content areas
SidebarHeader:  "flex flex-col gap-2 p-2"
SidebarFooter:  "flex flex-col gap-2 p-2"
SidebarContent: "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden"
SidebarGroup:   "relative flex w-full min-w-0 flex-col p-2"
SidebarGroupLabel: "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ..."
SidebarMenu:    "flex w-full min-w-0 flex-col gap-1"
SidebarMenuItem:"group/menu-item relative"
SidebarMenuButton: "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ..."
// Active: "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground"
```

---

## 9. ANIMATIONS (tailwindcss-animate)

```css
/* Accordion */
@keyframes accordion-down {
  from { height: 0; }
  to   { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to   { height: 0; }
}

/* Tailwind plugin classes available: */
animate-in, animate-out
fade-in-0, fade-out-0
zoom-in-95, zoom-out-95
slide-in-from-top-2, slide-in-from-bottom-2
slide-in-from-left-2, slide-in-from-right-2
slide-out-to-top-2, slide-out-to-bottom-2
duration-200 (default for most transitions)
```

---

## 10. DARK MODE

- Strategy: `class` (add `.dark` to `<html>`)
- Toggle: use `next-themes` or a custom context with `localStorage`
- No JS flash: use `suppressHydrationWarning` on `<html>` with next-themes
- All components respond automatically via CSS variable overrides
- Never hardcode `text-gray-900` — always use semantic tokens like `text-foreground`

---

## 11. ACCESSIBILITY RULES

- Every interactive element must have a visible focus ring (`focus-visible:ring-2`)
- All icons used decoratively: `aria-hidden="true"`
- Icon-only buttons: add `<span className="sr-only">Label</span>`
- Dialogs: trap focus, `aria-labelledby`, `aria-describedby`
- Form inputs: always linked to `<Label>` via `htmlFor`/`id`
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text
- Do not rely on color alone to convey meaning — use icons or text labels too

---

## 12. FILE & FOLDER STRUCTURE

```
src/
├── components/
│   └── ui/              ← All shadcn components live here
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   └── utils.ts         ← cn() helper
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── app/ (or pages/)
│   └── globals.css      ← :root tokens, base styles, font import
└── tailwind.config.ts
```

---

## 13. GLOBALS.CSS BOILERPLATE

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

---

## 14. DESIGN RULES SUMMARY (Quick Reference)

| Principle | Rule |
|---|---|
| Colors | Always use semantic tokens, never raw Tailwind colors |
| Font size | Default body is `text-sm` (14px) |
| Border | Always `border-border`, 1px, no box shadows on inputs |
| Radius | `rounded-md` for inputs/buttons, `rounded-lg` for cards/dialogs |
| Spacing | 4px grid; card padding is `p-6`, form gap is `gap-2`/`gap-4` |
| Motion | `duration-200`, use `data-[state]` attributes for enter/exit |
| Icons | `lucide-react`, always `h-4 w-4` in buttons, `h-5 w-5` standalone |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Dark mode | CSS variables only, toggled via `.dark` class on `<html>` |
| Accessibility | Radix primitives handle ARIA; always label interactive elements |