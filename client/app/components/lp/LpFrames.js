import { Maximize2 } from "lucide-react";

// The only two screenshot frames. Sizes are set in landing.css.

// Glass browser frame for dashboard screens.
export function LpBrowser({ children, className = "", zoomHint = false }) {
    return (
        <div className={`lp-glass lp-browser ${className}`}>
            <LpChrome />
            <div className="lp-browser__screen">
                {children}
                {zoomHint && <span className="lp-zoom-hint" aria-hidden="true"><Maximize2 size={18} /></span>}
            </div>
        </div>
    );
}

// Browser title bar: three window dots. Decorative only.
export function LpChrome() {
    return (
        <div className="lp-chrome" aria-hidden="true">
            <i /><i /><i />
        </div>
    );
}

// Phone frame for client-app screens.
export function LpPhoneFrame({ children, className = "" }) {
    return (
        <div className={`lp-phone-frame ${className}`}>
            <div className="lp-phone-frame__screen">{children}</div>
        </div>
    );
}
