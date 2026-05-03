"use client";

export default function ErrorState({ error, reset }) {
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="border border-destructive/25 rounded-lg p-8 max-w-md w-full text-center bg-destructive/5">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center bg-destructive/10">
                    <svg
                        className="w-6 h-6 text-destructive"
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
                <h2 className="text-xl font-bold mb-2 text-foreground">Something went wrong</h2>
                <p className="text-sm mb-6 text-muted-foreground">
                    {error?.message || "An unexpected error occurred while loading this page."}
                </p>
                <button
                    onClick={() => reset()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
