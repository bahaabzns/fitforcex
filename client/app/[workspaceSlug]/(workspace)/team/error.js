"use client";

export default function TeamError({ error, reset }) {
    return (
        <div className="p-8 flex flex-col gap-4">
            <h1 className="text-3xl font-bold text-foreground">Team</h1>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-destructive">{error?.message || "Failed to load team page."}</p>
                <button
                    onClick={reset}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
