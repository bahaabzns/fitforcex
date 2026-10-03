// Landing-page hero video: the general "How to use FitForce" walkthrough,
// embedded from YouTube. Replaces the per-module autoplay carousel.
const HERO_VIDEO_ID = "j4p2_PcHV_M";
const HERO_VIDEO_TITLE = "How to use FitForce";

export default function LandingHeroVideo() {
    return (
        <div className="relative mt-8 w-full max-w-5xl min-w-0">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-3xl blur-lg"
                style={{
                    background:
                        "linear-gradient(90deg, color-mix(in oklch, var(--color-primary) 15%, transparent), color-mix(in oklch, var(--color-primary) 8%, transparent))",
                }}
            />
            <div
                className="relative w-full aspect-video rounded-2xl border-2 overflow-hidden bg-black/40"
                style={{
                    borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                    boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
                }}
            >
                <iframe
                    src={`https://www.youtube-nocookie.com/embed/${HERO_VIDEO_ID}?rel=0`}
                    title={HERO_VIDEO_TITLE}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        </div>
    );
}
