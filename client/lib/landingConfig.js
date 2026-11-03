// Landing-page facts that are not translated copy.

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

// Persist an explicit language choice; i18n/request.js reads this cookie before any default.
export function setLocaleCookie(code) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

// General "How to use FitForce" walkthrough on YouTube; the poster is self-hosted in /lp.
export const DEMO_VIDEO_ID = "j4p2_PcHV_M";

// `name` and `description` come from messages `lp.coaches.<id>`.
export const LANDING_COACHES = [
    { id: "coach1", image: "/lp/coach-elbasuony.webp", instagramUrl: "https://instagram.com/basuoo", instagramHandle: "@basuoo" },
    { id: "coach2", image: "/lp/coach-gamal.webp", instagramUrl: "https://instagram.com/dr.agamal", instagramHandle: "@dr.agamal" },
];

// ── Product screenshots ──────────────────────────────────────────────────────
// Every screenshot is one of two frame types: a glass browser frame (kind "browser", dashboard
// screens) or a phone frame (kind "phone", client app). Positions are % of the source image;
// `focus` zooms into the important part. Marker and card labels live in messages `lp.shots.<id>`
// in the same order as the arrays here. `toolMarker` is the one marker shown in the bento crop
// (it must stay inside the zoomed crop on every screen size). Arabic screens are mirrored, so x flips unless mirror is false.
export const LANDING_SHOTS = {
    addClient: { kind: "browser", file: "b-{l}-add-client", w: 2304, h: 1440, focus: { x: 50, y: 48, zoom: 1.9 },
        markers: [{ x: 35, y: 42 }, { x: 66, y: 51 }, { x: 68, y: 70 }], cards: [{ x: 86, y: 16 }] },
    nutrition: { kind: "browser", file: "b-{l}-nutrition", w: 2304, h: 1440, focus: { x: 52, y: 45, zoom: 1.6 },
        markers: [{ x: 49, y: 33 }, { x: 58, y: 56 }, { x: 30, y: 33 }], cards: [{ x: 84, y: 16 }] },
    foodDiary: { kind: "browser", file: "b-{l}-food-diary", w: 2304, h: 1440, focus: { x: 45, y: 40, zoom: 1.45 },
        markers: [{ x: 26, y: 19 }, { x: 55, y: 32 }, { x: 34, y: 52 }], cards: [{ x: 84, y: 20 }] },
    clients: { kind: "browser", file: "b-{l}-clients", w: 2304, h: 1440, focus: { x: 65, y: 48, zoom: 1.5 },
        markers: [{ x: 79, y: 37 }, { x: 68, y: 37 }, { x: 96, y: 22 }], cards: [] },
    library: { kind: "browser", file: "b-{l}-library", w: 2400, h: 1500, focus: { x: 58, y: 46, zoom: 1.25 },
        toolMarker: 1,
        markers: [{ x: 22, y: 36 }, { x: 40, y: 45 }, { x: 92, y: 24 }], cards: [{ x: 64, y: 78 }] },
    branding: { kind: "browser", file: "b-{l}-branding", w: 2400, h: 1500, focus: { x: 66, y: 56, zoom: 1.35 },
        markers: [{ x: 49, y: 43 }, { x: 36, y: 76 }, { x: 82, y: 55 }], cards: [{ x: 20, y: 18 }] },
    messenger: { kind: "browser", file: "b-{l}-messenger", w: 2400, h: 1500, focus: { x: 55, y: 40, zoom: 1.15 },
        markers: [{ x: 34, y: 14 }, { x: 60, y: 30 }, { x: 87, y: 18 }], cards: [] },
    team: { kind: "browser", file: "b-{l}-team", w: 2400, h: 1500, focus: { x: 40, y: 45, zoom: 1.5 },
        markers: [{ x: 33, y: 28 }, { x: 47, y: 52 }, { x: 53, y: 51 }], cards: [{ x: 80, y: 16 }] },
    compare: { kind: "crop", file: "{l}-compare", w: 640, h: 1180, focus: { x: 50, y: 50, zoom: 1 }, mirror: false,
        markers: [{ x: 51, y: 40 }, { x: 22, y: 85 }], cards: [{ x: 76, y: 78 }] },
    phoneNutrition: { kind: "phone", file: "{l}-portal-nutrition", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        markers: [{ x: 32, y: 22 }, { x: 40, y: 65 }, { x: 74, y: 89 }], cards: [{ x: 68, y: 41 }] },
    training: { kind: "phone", file: "{l}-portal-training", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        markers: [{ x: 88, y: 28 }, { x: 88, y: 66 }, { x: 82, y: 89 }], cards: [] },
    shopping: { kind: "phone", file: "{l}-shopping", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        toolFocus: { x: 50, y: 40, zoom: 1.1 },
        markers: [{ x: 82, y: 31 }, { x: 76, y: 62 }], cards: [{ x: 70, y: 12 }] },
    swap: { kind: "phone", file: "{l}-swap", w: 1170, h: 2532, focus: { x: 50, y: 50, zoom: 1 },
        toolFocus: { x: 50, y: 56, zoom: 1.1 },
        markers: [{ x: 92, y: 58 }, { x: 92, y: 47 }, { x: 88, y: 92 }], cards: [{ x: 70, y: 12 }] },
};

// Order matters: matches `lp.day.steps`, `lp.tools.items` and `lp.phones.screens` in the messages.
// Day step 3 is the client's phone, shown as two phones in the same stage.
export const LANDING_DAY_STEPS = [["addClient"], ["nutrition"], ["phoneNutrition", "training"], ["foodDiary"], ["clients"]];
export const LANDING_TOOLS = ["library", "compare", "branding", "team", "messenger", "shopping", "swap"];
export const LANDING_PHONE_SCREENS = ["phoneNutrition", "shopping", "swap", "training"];

export function shotSrc(shot, locale) {
    return `/lp/${shot.file.replace("{l}", locale)}.webp`;
}
