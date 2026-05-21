# Landing Page Enhancement Plan
> Target: match the Arabic marketing landing page design using HeroUI components
> File to edit: `client/app/page.js`

---

## Overall Design System

- **Theme**: Dark (near-black `#080d1a` base), bright blue accent `#0099FF`
- **Direction**: RTL (`dir="rtl"`) — all layout and text is Arabic-first
- **Typography**: Bold Arabic headings, regular body text, tight line-height
- **Background**: Deep dark navy gradient with subtle radial glow behind hero
- **Sections alternate**: image-left/text-right, then text-left/image-right

---

## Section 1 — Navbar

**HeroUI**: `Navbar`, `NavbarBrand`, `NavbarContent`, `NavbarItem`, `Button`, `Link`

### Requirements
- Sticky, `backdrop-blur`, semi-transparent dark background with bottom border
- **Left side**: FitForce**X** logo (bold, accent-colored X)
- **Center**: navigation links (الرئيسية, المميزات, الأسعار, عن المنصة) — hidden on mobile
- **Right side**: two buttons — "تسجيل الدخول" (ghost) + "ابدأ مجاناً" (solid primary)
- Mobile: hamburger `NavbarMenuToggle` + `NavbarMenu` drawer

```jsx
<Navbar isBordered isBlurred maxWidth="xl" dir="rtl">
  <NavbarBrand>FitForce<span className="text-primary">X</span></NavbarBrand>
  <NavbarContent className="hidden sm:flex" justify="center">
    <NavbarItem><Link>المميزات</Link></NavbarItem>
    <NavbarItem><Link>الأسعار</Link></NavbarItem>
  </NavbarContent>
  <NavbarContent justify="start">
    <NavbarItem><Button variant="light">تسجيل الدخول</Button></NavbarItem>
    <NavbarItem><Button color="primary">ابدأ مجاناً</Button></NavbarItem>
  </NavbarContent>
</Navbar>
```

---

## Section 2 — Hero

**HeroUI**: `Button`, `Chip`

### Requirements
- Full-viewport-height section, `text-center`, vertically centered
- **Background**: deep dark with radial glow blob (blue, low opacity) behind text
- **Badge chip**: "منصة التدريب الرياضي #1" — `Chip` with primary color outline variant
- **H1**: "منصتك الكاملة لتطوير شغلك في التدريب الرياضي" — extra-bold, large (text-5xl+)
- **Subtext**: one or two lines describing the platform
- **CTA button**: "ابدأ تجربتك المجانية" — `Button color="primary" size="lg"` with arrow icon
- **Product mockup**: dashboard screenshot inside a browser-chrome frame (div with dark rounded border + top bar dots), below the CTA, shadowed
- **Stats row** at bottom: 3 numbers (عدد المدربين, العملاء المُدارون, وقت التشغيل)

---

## Section 3 — Trust Banner

**HeroUI**: `Card`

### Requirements
- Full-width dark card / banner strip between hero and features
- Short bold marketing line (e.g. "صمم خطة تدريبية شخصية لعملائك...")
- Subtle border, slightly lighter background than page
- Acts as a visual separator and social-proof hook

---

## Section 4 — Feature Sections (×6)

Each feature section is a full-width row with image on one side and content on the other, **alternating** per section.

**HeroUI**: `Chip`, `Button`  
**Icons**: Lucide or Heroicons checkmark/tick icons for bullet list

### Shared structure per section
```
[Section chip/label]
[Bold H2 heading in Arabic]
[3–4 bullet points with check icons]
[CTA button → "ابدأ مجاناً"]
[Product screenshot / illustration]
```

### Sections in order

| # | Heading | Layout | Content focus |
|---|---------|--------|---------------|
| 1 | مديروك بلا حدود | image-right, text-left | Unlimited client management, plans, tracking |
| 2 | اشتغل من أي مكان | image-left, text-right | Mobile app / accessible anywhere |
| 3 | سلّم الخطة بالطريقة جاهزة | image-right, text-left | Ready-made plan delivery to clients |
| 4 | مكتبة تمارين وأطعمة جاهزة | image-left, text-right | Built-in exercises + food database |
| 5 | متابعة تطور المتدربين | image-right, text-left | Progress tracking, check-ins, measurements |
| 6 | سهلة جداً | image-left, text-right | Simple UX, onboarding, ease of use |

### Screenshot containers
- Dark rounded card with glowing blue border or subtle shadow
- Background slightly lighter than page (`surface` color)
- Use `next/image` with actual product screenshots

---

## Section 5 — Testimonials

**HeroUI**: `Card`, `Card.Content`, `Avatar`, `Avatar.Fallback`, `Chip`
**Lucide**: `Star`, `ChevronLeft`, `ChevronRight`
**Directive**: `'use client'` (carousel needs useState)

### Requirements
- Section heading: "Trusted by Top-Tier Coaches"
- Client-side carousel — one testimonial visible at a time, left/right chevron buttons
- Each testimonial card contains:
  - Large `Avatar` (size lg, color accent) with `Avatar.Fallback` initials (no real photos yet)
  - Coach name (bold, white) + role/title (muted)
  - 5-star rating row using filled `Star` icons
  - Quote text (italic, white/70)
- 3 testimonials minimum
- Prev/next buttons are ghost icon buttons flanking the card
- Insert **between feature sections and pricing**

---

## Section 6 — Pricing

**HeroUI**: `Card`, `CardHeader`, `CardBody`, `CardFooter`, `Button`, `Chip`, `Divider`

### Requirements
- Section heading: "اختار الخطة المناسبة لشغلك"
- Three pricing cards in a row:

| Plan | Name | Price | Highlight |
|------|------|-------|-----------|
| Basic | بن قوس | lowest | — |
| Standard | تيم قوس | mid (e.g. 2,000 ر.س) | — |
| Premium | بريميو قوس | highest (e.g. 4,000 ر.س) | "الأكثر شيوعاً" badge |

- Each card:
  - Plan name + optional popular `Chip`
  - Price (large bold number + "ر.س / شهرياً")
  - `Divider`
  - Features checklist (check icons)
  - `Button` → "ابدأ الآن"
- Premium card: `isBlurred` or glowing blue border to stand out

```jsx
<Card isBlurred className="border-2 border-primary">
  <CardHeader>
    <Chip color="primary" variant="flat">الأكثر شيوعاً</Chip>
    <h3>بريميو قوس</h3>
  </CardHeader>
  <CardBody>
    <p className="text-4xl font-bold">4,000 <span className="text-sm">ر.س/شهر</span></p>
    <Divider />
    {/* feature list */}
  </CardBody>
  <CardFooter>
    <Button fullWidth color="primary">ابدأ الآن</Button>
  </CardFooter>
</Card>
```

---

## Section 7 — Founder's Guarantee

**HeroUI**: `Card`, `Card.Content`, `Chip`

### Requirements
- Section heading: "Founder's Guarantee" + subtitle line
- Two-column layout (max-w-6xl):
  - **Left**: founder photo placeholder (dark card with person silhouette + "الكوتشينج الذكي" chip overlay)
  - **Right**: large decorative opening quote mark, quote text (italic), founder name + title
- Dark card background with subtle blue accent border or glow
- Insert **between pricing and FAQ**

---

## Section 8 — FAQ

**HeroUI**: `Accordion`, `AccordionItem`

### Requirements
- Section heading: "الأسئلة الشائعة"
- 5–7 accordion items, each with a question + answer
- `variant="splitted"` or `variant="bordered"` for clear separation
- `selectionMode="multiple"` so multiple can be open

```jsx
<Accordion variant="splitted" dir="rtl">
  <AccordionItem key="1" title="هل يمكنني تجربة المنصة مجاناً؟">
    نعم، نوفر تجربة مجانية لمدة 14 يوم...
  </AccordionItem>
  {/* more items */}
</Accordion>
```

---

## Section 9 — Final CTA

**HeroUI**: `Card`, `Card.Content`

### Requirements
- Full-width section with radial gradient background (deep accent glow behind text)
- Bold heading: "Ready to Transform Your Coaching Business?"
- Subtext: join X coaches already using the platform
- Single large primary CTA link-button: "Get Started Free"
- Mirrors the hero visually — dark with blue glow, centered, text-white
- Insert **after FAQ, before footer**

---

## Section 10 — Footer

**HeroUI**: `Separator`

### Requirements
- Dark background (`bg-[#080d1a]`), top `Separator`
- Top row — two columns:
  - **Left**: FitForce**X** logo (bold, accent X) + tagline line
  - **Right**: 3-column link groups — Product, Company, Legal
- Bottom row: copyright line centered or left-aligned
- Replace current minimal footer entirely

---

## Implementation Notes

### Global page changes
- Add `dir="rtl"` and `lang="ar"` to `<html>` in `layout.js` — or scope to landing page wrapper
- Import `@heroui/react` components (already installed) — switch from custom button classes to `Button color="primary"`
- Replace emoji icons with Lucide icons: `npm install lucide-react` (check if already present)
- Add product screenshots to `client/public/screenshots/` directory

### File structure
```
client/app/page.js              ← main file to rewrite
client/public/screenshots/      ← product mockup images
client/public/team/             ← founder/coach photos
```

### Styling approach
- Use HeroUI's `bg-content1`, `bg-content2` for section backgrounds (respects dark theme)
- Accent glow: `shadow-[0_0_30px_rgba(0,153,255,0.15)]` on highlighted cards
- Spacing: `py-24` between sections, `max-w-7xl mx-auto px-6` for content width
- Section labels: `Chip variant="flat" color="primary"` above each heading

---

## Corrected Page Section Order

```
Navbar
Hero + trust banner
6 Feature sections
Testimonials          ← was missing, goes here
Pricing (3 cards)
Founder's Guarantee   ← was missing, goes here
FAQ accordion
Final CTA banner      ← was missing, goes here
Footer                ← needs logo + column links
```

## Priority Order

1. [x] Navbar (HeroUI `Button` + `Drawer`, English)
2. [x] Hero section + product mockup frame + trust banner
3. [x] Feature sections (6 alternating, CSS mockups, English content)
4. [x] Pricing cards (FitForce / TeamForce / EnterpriseForce, popular card glows)
5. [x] FAQ accordion (7 questions, Accordion surface variant, allowsMultipleExpanded)
6. [x] Testimonials — `'use client'` carousel, Avatar.Fallback, Star icons, dot indicators, inserted before pricing
7. [x] Founder's Guarantee — two-column card, photo placeholder + quote, inserted after pricing
8. [x] Final CTA banner — radial glow card, heading + primary button + trial note, inserted after FAQ
9. [x] Footer upgrade — FitForce X logo + Product/Company/Legal columns + copyright row
10. [x] Mobile responsiveness pass
