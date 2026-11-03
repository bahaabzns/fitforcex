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
    // No photo or bio yet: the card shows amber placeholders until they are added.
    { id: "coach3", image: null, instagramUrl: "https://instagram.com/belghamdi", instagramHandle: "@belghamdi" },
];

// ── Product screenshots ──────────────────────────────────────────────────────
// Every screenshot is one of two frame types: a glass browser frame (kind "browser", dashboard
// screens) or a phone frame (kind "phone", client app). Positions are % of the source image;
// `focus` zooms into the important part. Marker and card labels live in messages `lp.shots.<id>`
// in the same order as the arrays here. `toolMarker` is the one marker shown in the bento crop
// (it must stay inside the zoomed crop on every screen size). Arabic screens are mirrored, so x flips unless mirror is false.
export const LANDING_SHOTS = {
    addClient: { kind: "browser", file: "b-{l}-add-client", w: 2304, h: 1440, focus: { x: 50, y: 50, zoom: 1.15 } },
    nutrition: { kind: "browser", file: "b-{l}-nutrition", w: 2304, h: 1440, focus: { x: 52, y: 45, zoom: 1.3 } },
    foodDiary: { kind: "browser", file: "b-{l}-food-diary", w: 2304, h: 1440, focus: { x: 44, y: 33, zoom: 1.5 } },
    finance: { kind: "browser", file: "b-{l}-finance", w: 1500, h: 940, focus: { x: 50, y: 50, zoom: 1 } },
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
export const LANDING_DAY_SCOPES = ["coach", "coach", "client", "coach", "coach"];
export const LANDING_DAY_STEPS = [["addClient"], ["nutrition"], ["phoneNutrition", "training"], ["foodDiary"], ["finance"]];
export const LANDING_PHONE_SCREENS = ["phoneNutrition", "shopping", "swap"];

export function shotSrc(shot, locale) {
    return `/lp/${shot.file.replace("{l}", locale)}.webp`;
}
