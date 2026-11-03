import Image from "next/image";
import { useLocale } from "next-intl";
import { LANDING_SHOTS, shotSrc } from "@/lib/landingConfig";

// One screenshot, zoomed into the important part. The image layer always covers its frame, so
// the zoom point stays right at any frame shape. Plain and static: no markers, cards or overlays.
export default function LpShotImage({ shotId, alt, priority = false }) {
    const shot = LANDING_SHOTS[shotId];
    const locale = useLocale();
    // Arabic screens are mirrored, so the focus point flips too.
    const focusX = locale === "ar" && shot.mirror !== false ? 100 - shot.focus.x : shot.focus.x;

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
                <Image src={shotSrc(shot, locale)} alt={alt} fill sizes="(min-width: 1000px) 700px, 100vw" unoptimized priority={priority} />
            </div>
        </div>
    );
}
