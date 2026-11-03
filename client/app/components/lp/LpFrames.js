// The only two frame types on the page. Sizes are set in landing.css (.lp-browser, .lp-phone-frame).

// Glass browser frame for dashboard screens.
export function LpBrowser({ children, className = "" }) {
    return (
        <div className={`lp-glass lp-browser ${className}`}>
            <div className="lp-browser__bar" aria-hidden="true"><i /><i /><i /></div>
            <div className="lp-browser__view">{children}</div>
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
