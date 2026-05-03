import Link from "next/link";

export default function HomePage() {
    return (
        <main className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between px-8 py-5 bg-card border-b border-border">
                <span className="text-xl font-bold tracking-tight text-foreground">
                    FitForce<span className="text-primary">X</span>
                </span>
                <div className="flex gap-3">
                    <Link
                        href="/login"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-primary border border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                        Log In
                    </Link>
                    <Link
                        href="/register"
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="flex flex-col items-center justify-center flex-1 text-center px-6 py-24 gap-6">
                <h1 className="text-5xl font-extrabold tracking-tight leading-tight max-w-2xl">
                    The all-in-one platform for{" "}
                    <span className="text-primary">fitness coaches</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                    Manage your clients, build training programs, track nutrition, and grow your coaching business — all in one place.
                </p>
                <div className="flex gap-4 mt-2">
                    <Link
                        href="/register"
                        className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Start for Free
                    </Link>
                    <Link
                        href="/login"
                        className="px-6 py-3 rounded-lg border border-border bg-card text-foreground font-semibold text-base hover:bg-accent transition-colors"
                    >
                        Log In
                    </Link>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-8 pb-20 max-w-5xl mx-auto w-full">
                {[
                    {
                        icon: "🏋️",
                        title: "Training Programs",
                        desc: "Build and assign custom workout plans with an extensive exercise library.",
                    },
                    {
                        icon: "🥗",
                        title: "Nutrition Tracking",
                        desc: "Create macro-based meal plans and cycle calories to match your clients' goals.",
                    },
                    {
                        icon: "📊",
                        title: "Client Dashboard",
                        desc: "Monitor progress, measurements, and check-ins from a single dashboard.",
                    },
                ].map(({ icon, title, desc }) => (
                    <div
                        key={title}
                        className="bg-card rounded-lg border border-border p-6 flex flex-col gap-3 shadow-sm"
                    >
                        <span className="text-3xl">{icon}</span>
                        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                ))}
            </section>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
                © {new Date().getFullYear()} FitForceX. All rights reserved.
            </footer>
        </main>
    );
}
