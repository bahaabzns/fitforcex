// Turns a coach's validated brand colors into the CSS variables the portal theme reads.
// Pure functions (no DOM access) so they can be unit-tested.
//
// Only #RRGGBB values ever reach the generated CSS — anything else is dropped — so the
// stylesheet can be injected without any risk of CSS injection.

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const WHITE = "#ffffff";
const BLACK = "#000000";
// Approximates the dark-mode page background (globals.css .dark surfaces ≈ oklch 21%).
const DARK_SURFACE = "#1c1c1f";
const MIN_TEXT_CONTRAST = 4.5;
const LIFT_STEP = 0.1;
const MAX_LIFT = 0.6;

export function isHexColor(value) {
    return typeof value === "string" && HEX_COLOR.test(value);
}

function toChannels(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(channels) {
    return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex) {
    const [r, g, b] = toChannels(hex)
        .map((c) => c / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

export function pickForeground(hex) {
    return contrastRatio(hex, WHITE) >= contrastRatio(hex, BLACK) ? WHITE : BLACK;
}

function mixWithWhite(hex, amount) {
    return toHex(toChannels(hex).map((c) => c + (255 - c) * amount));
}

/**
 * Dark surfaces need a lighter tone of the same hue for links/text-on-dark. Lightens in small
 * steps only until the color reads (≥4.5:1) against the dark page background.
 */
export function liftForDark(hex) {
    for (let amount = 0; amount <= MAX_LIFT; amount += LIFT_STEP) {
        const candidate = amount === 0 ? hex : mixWithWhite(hex, amount);
        if (contrastRatio(candidate, DARK_SURFACE) >= MIN_TEXT_CONTRAST) return candidate;
    }
    return mixWithWhite(hex, MAX_LIFT);
}

function themeDeclarations(accent, foreground) {
    return [
        `--accent:${accent}`,
        `--accent-foreground:${foreground}`,
        `--primary:${accent}`,
        `--primary-foreground:${foreground}`,
        `--focus:${accent}`,
        `--sidebar-accent:color-mix(in oklch, ${accent} 14%, transparent)`,
        `--sidebar-accent-foreground:${accent}`,
        `--app-surface-selected:color-mix(in oklch, ${accent} 10%, transparent)`,
    ].join(";");
}

/**
 * CSS for the portal. Targets html itself (not a wrapper) because HeroUI modals, popovers and
 * drawers render in a portal outside any wrapper element. Returns "" when no valid primary.
 * `html:root` / `html.dark:root` outrank globals.css's `:root` / `.dark` regardless of order.
 */
export function buildBrandCss({ primaryColor, accentColor }) {
    if (!isHexColor(primaryColor)) return "";

    const lightForeground = pickForeground(primaryColor);
    const darkAccent = liftForDark(primaryColor);
    const darkForeground = pickForeground(darkAccent);

    const rules = [
        `html:root{${themeDeclarations(primaryColor, lightForeground)}${isHexColor(accentColor) ? `;--brand-secondary:${accentColor}` : ""}}`,
        `html.dark:root{${themeDeclarations(darkAccent, darkForeground)}${isHexColor(accentColor) ? `;--brand-secondary:${liftForDark(accentColor)}` : ""}}`,
    ];
    return rules.join("\n");
}

const MIN_UI_CONTRAST = 3;
const LIGHT_SURFACE = WHITE;

/** Advisory contrast warnings for a draft primary color (same rules the server applies). */
export function colorWarnings(primaryColor) {
    if (!isHexColor(primaryColor)) return [];
    const warnings = [];
    if (contrastRatio(primaryColor, pickForeground(primaryColor)) < MIN_TEXT_CONTRAST) warnings.push("textOnPrimary");
    if (contrastRatio(primaryColor, LIGHT_SURFACE) < MIN_UI_CONTRAST) warnings.push("lightBackground");
    if (contrastRatio(primaryColor, DARK_SURFACE) < MIN_UI_CONTRAST) warnings.push("darkBackground");
    return warnings;
}
