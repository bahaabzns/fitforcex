// Landing-page facts that are not translated copy.

export const WHATSAPP_NUMBER = "201501233314";
export const whatsappLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
export const WHATSAPP_URL = "https://wa.me/201501233314?text=Hello!%20I'm%20interested%20in%20FitForce.";

// Section anchors shared by the nav and the sections themselves.
export const LANDING_SECTIONS = {
    demo: "demo",
    features: "features",
    coaches: "coaches",
    day: "day",
    app: "app",
    pricing: "pricing",
    faq: "faq",
};

// Persist an explicit language choice for a year; i18n/request.js reads this cookie before the Arabic default.
// It is scoped to the whole root domain (landing, my., coach slugs) so a choice made on the landing page is still
// remembered after signing up. localhost can't take a domain, so there it stays per host.
const COOKIE_ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
const ONE_YEAR_SECONDS = 31536000;

export function setLocaleCookie(code) {
    const onRootDomain = COOKIE_ROOT_DOMAIN !== "localhost"
        && (window.location.hostname === COOKIE_ROOT_DOMAIN || window.location.hostname.endsWith(`.${COOKIE_ROOT_DOMAIN}`));
    // Clear any older per-host cookie first so it can't shadow the shared one.
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0; SameSite=Lax";
    const domain = onRootDomain ? `; domain=.${COOKIE_ROOT_DOMAIN}` : "";
    document.cookie = `NEXT_LOCALE=${code}; path=/${domain}; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

// General "How to use FitForce" walkthrough on YouTube; the poster is self-hosted in /lp.
export const DEMO_VIDEO_ID = "j4p2_PcHV_M";

// `name` and `description` come from messages `lp.coaches.<id>`.
export const LANDING_COACHES = [
    { id: "coach1", image: "/lp/coach-elbasuony.webp", instagramUrl: "https://www.instagram.com/elbasuony87/", instagramHandle: "@elbasuony87" },
    { id: "coach2", image: "/lp/coach-gamal.webp", instagramUrl: "https://www.instagram.com/dr.abdallahgamal/", instagramHandle: "@dr.abdallahgamal" },
    // Empty name/bio in messages render as amber placeholders until the real copy is supplied.
    { id: "coach3", image: "/lp/coach-belghamdi.webp", instagramUrl: "https://www.instagram.com/belghamdi.coaching/", instagramHandle: "@belghamdi.coaching" },
    { id: "coach4", image: "/lp/coach-fitness-savior.webp", instagramUrl: "https://www.instagram.com/fitness_savior/", instagramHandle: "@fitness_savior" },
    { id: "coach5", image: "/lp/coach-arafa.webp", instagramUrl: "https://www.instagram.com/arafacoaching/", instagramHandle: "@arafacoaching" },
    { id: "coach6", image: "/lp/coach-shaady.webp", instagramUrl: "https://www.instagram.com/shaadytarek/", instagramHandle: "@shaadytarek" },
];

// ── Product screenshots ──────────────────────────────────────────────────────
// Every screenshot is one of two frame types: a glass browser frame (kind "browser", dashboard
// screens) or a phone frame (kind "phone", client app). Positions are % of the source image;
// `focus` zooms into the important part. Marker and card labels live in messages `lp.shots.<id>`
// in the same order as the arrays here. `toolMarker` is the one marker shown in the bento crop
// (it must stay inside the zoomed crop on every screen size). Arabic screens are mirrored, so x flips unless mirror is false.
export const LANDING_SHOTS = {
    addClient: { kind: "browser", file: "stage-{l}-add-client", w: 2400, h: 1650, focus: { x: 50, y: 50, zoom: 1 } },
    nutrition: { kind: "browser", file: "stage-{l}-nutrition", w: 2400, h: 1650, focus: { x: 50, y: 50, zoom: 1 } },
    foodDiary: { kind: "browser", file: "stage-{l}-adherence", w: 2400, h: 1650, focus: { x: 50, y: 50, zoom: 1 } },
    finance: { kind: "browser", file: "stage-{l}-payments", w: 2400, h: 1650, focus: { x: 50, y: 50, zoom: 1 } },
    clients: { kind: "browser", file: "b-{l}-clients", w: 2304, h: 1440, focus: { x: 65, y: 48, zoom: 1.5 } },
    phoneNutrition: { kind: "phone", file: "{l}-portal-nutrition", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 } },
    training: { kind: "phone", file: "{l}-portal-training", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 } },
    shopping: { kind: "phone", file: "{l}-shopping", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        toolFocus: { x: 50, y: 40, zoom: 1.1 } },
    swap: { kind: "phone", file: "{l}-swap", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        toolFocus: { x: 50, y: 56, zoom: 1.1 } },
};

// Order matters: matches `lp.day.steps` and `lp.phones.screens` in the messages.
// Day step 3 is the client's phone, shown as two phones in the same stage.
// Which app each day step shows, for the small label on the stage.
export const LANDING_DAY_SCOPES = ["coach", "coach", "coach", "coach"];
export const LANDING_DAY_STEPS = [["addClient"], ["nutrition"], ["foodDiary"], ["finance"]];
export const LANDING_PHONE_SCREENS = ["phoneNutrition", "shopping", "swap"];

// Bump when screenshots are retaken: file names stay the same, so returning visitors and CDNs
// would otherwise keep showing the old images.
export const LANDING_ASSET_VERSION = "2026-11-04b";
export const assetUrl = (path) => `${path}?v=${LANDING_ASSET_VERSION}`;

export function shotSrc(shot, locale) {
    return assetUrl(`/lp/${shot.file.replace("{l}", locale)}.webp`);
}
