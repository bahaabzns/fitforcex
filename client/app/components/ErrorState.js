"use client";

// Reusable error state — imported by every error.js boundary in the app
export default function ErrorState({ error, reset }) {
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div
                className="border rounded-2xl p-8 max-w-md w-full text-center"
                style={{
                    background: "rgba(255,59,48,0.06)",
                    borderColor: "rgba(255,59,48,0.25)",
                }}
            >
                {/* Warning icon */}
                <div
                    className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,59,48,0.12)" }}
                >
                    <svg
                        className="w-6 h-6"
                        style={{ color: "#FF3B30" }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                    </svg>
                </div>

                <h2
                    className="text-xl font-bold mb-2"
                    style={{ color: "#1D1D1F" }}
                >
                    Something went wrong
                </h2>
                <p
                    className="text-sm mb-6"
                    style={{ color: "#86868B" }}
                >
                    {error?.message || "An unexpected error occurred while loading this page."}
                </p>

                <button
                    onClick={() => reset()}
                    className="btn-primary px-5 py-2.5 text-sm"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
