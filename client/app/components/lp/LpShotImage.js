import { useLocale } from "next-intl";
import { LANDING_SHOTS, shotSrc } from "@/lib/landingConfig";

// One screenshot, zoomed into the important part. The image layer always covers its frame, so
// the zoom point stays right at any frame shape. Plain and static: no markers, cards or overlays.
// Dashboard shots ship two sizes so phones download the small one and zoomed desktops the full one.
export default function LpShotImage({ shotId, alt }) {
    const shot = LANDING_SHOTS[shotId];
    const locale = useLocale();
    // Arabic screens are mirrored, so the focus point flips too.
    const focusX = locale === "ar" && shot.mirror !== false ? 100 - shot.focus.x : shot.focus.x;
    const full = shotSrc(shot, locale);
    const small = shot.kind === "browser" ? full.replace(".webp", "-m.webp") : null;

    return (
        <div className="lp-zoom">
            <div
                className="lp-zoom__layer"
                style={{
                    "--ar": shot.w / shot.h,
                    "--z": shot.focus.zoom,
                    "--tx": `${50 - focusX}%`,
                    "--ty": `${50 - shot.focus.y}%`,
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={full}
                    srcSet={small ? `${small} 1200w, ${full} ${shot.w}w` : undefined}
                    sizes={small ? "(min-width: 1000px) 700px, 100vw" : undefined}
                    alt={alt}
                    width={shot.w}
                    height={shot.h}
                    loading="lazy"
                    decoding="async"
                />
            </div>
        </div>
    );
}
