import Image from "next/image";
import { LpChrome } from "./LpFrames";

// Real product screenshot in a glass frame with a blue glow underneath.
// Served as-is (unoptimized) at native capture size, so zooming in stays sharp.
export default function LpShot({ src, alt, width = 2400, height = 1440, priority = false, sizes = "(min-width: 1000px) 60vw, 100vw", className = "" }) {
    return (
        <div className={`lp-glass lp-frame ${className}`}>
            <LpChrome />
            <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} unoptimized />
        </div>
    );
}
