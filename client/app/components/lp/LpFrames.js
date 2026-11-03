// The only two screenshot frames. Sizes are set in landing.css.

// Glass frame for dashboard screens.
export function LpBrowser({ children, className = "" }) {
    return <div className={`lp-glass lp-browser ${className}`}>{children}</div>;
}

// Phone frame for client-app screens.
export function LpPhoneFrame({ children, className = "" }) {
    return (
        <div className={`lp-phone-frame ${className}`}>
            <div className="lp-phone-frame__screen">{children}</div>
        </div>
    );
}
