// The document/lines glyph used for every plan card — the builder's LeftPanel
// (nutrition + training) and the Load Plan modal all show the same icon so a
// plan reads as "a plan" consistently wherever it appears in the app.
export default function PlanIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
    );
}
