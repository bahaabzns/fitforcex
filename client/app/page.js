import Link from "next/link";

const features = [
    {
        icon: "🏋️",
        title: "Training Programs",
        description:
            "Build and assign custom workout plans with an extensive exercise library.",
    },
    {
        icon: "🥗",
        title: "Nutrition Tracking",
        description:
            "Create macro-based meal plans and cycle calories to match your clients' goals.",
    },
    {
        icon: "📊",
        title: "Client Dashboard",
        description:
            "Monitor progress, measurements, and check-ins from a single dashboard.",
    },
];

const stats = [
    { value: "500+", label: "Coaches" },
    { value: "10k+", label: "Clients managed" },
    { value: "99.9%", label: "Uptime" },
];

const footerLinks = ["Privacy", "Terms", "Contact"];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-background text-foreground flex flex-col">

            {/* ── Nav ── */}
            <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-surface/80 backdrop-blur-md border-b border-border">
                <span className="text-xl font-bold tracking-tight">
                    FitForce<span className="text-accent">X</span>
                </span>
                <div className="flex items-center gap-2">
                    <Link href="/login" className="button button--ghost button--md">
                        Log In
                    </Link>
                    <Link href="/register" className="button button--primary button--md">
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* ── Hero ── */}
            {/* FIX 1 & Enhancement 1: radial gradient + readable subtitle */}
            <section
                className="flex flex-col items-center justify-center flex-1 text-center px-6 py-28 gap-6"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 55% at 50% -5%, color-mix(in oklch, var(--color-accent) 10%, transparent), transparent)",
                }}
            >
                <span className="chip chip--soft chip--accent chip--lg">
                    <span className="chip__label">Built for fitness coaches</span>
                </span>

                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
                    The all-in-one platform for{" "}
                    <span className="text-accent">fitness coaches</span>
                </h1>

                {/* FIX 1: use text-foreground/60 instead of text-muted for readable subtitle */}
                <p className="text-lg text-foreground/60 max-w-xl">
                    Manage your clients, build training programs, track nutrition,
                    and grow your coaching business — all in one place.
                </p>

                <div className="flex flex-wrap justify-center gap-3 mt-2">
                    <Link href="/register" className="button button--primary button--lg">
                        Start for Free
                    </Link>
                    {/* FIX 3: force a visible border on the outline button */}
                    <Link
                        href="/login"
                        className="button button--outline button--lg"
                        style={{ borderColor: "color-mix(in oklch, var(--color-foreground) 25%, transparent)" }}
                    >
                        Log In
                    </Link>
                </div>

                {/* FIX 2: stats labels now use text-foreground/50 so they render visibly */}
                <div className="flex items-center gap-10 mt-10 pt-10 border-t border-border w-full max-w-sm justify-center">
                    {stats.map(({ value, label }) => (
                        <div key={label} className="flex flex-col items-center gap-1">
                            <span className="text-2xl font-bold text-foreground">{value}</span>
                            <span className="text-xs text-foreground/50">{label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section className="px-8 pb-20 max-w-5xl mx-auto w-full">
                {/* Enhancement 3: section heading */}
                <div className="text-center mb-10">
                    <span className="chip chip--soft chip--accent chip--md">
                        <span className="chip__label">Features</span>
                    </span>
                    <h2 className="text-3xl font-bold mt-4 text-foreground">
                        Everything you need
                    </h2>
                    {/* FIX 1 applied here too */}
                    <p className="text-foreground/55 mt-2">
                        All the tools to run and scale your coaching business.
                    </p>
                </div>

                {/* FIX 4 & Enhancement 2 & 4: icon containers + visible card content + hover lift */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {features.map(({ icon, title, description }) => (
                        <div
                            key={title}
                            className="card card--default transition-transform duration-200 hover:-translate-y-1"
                        >
                            {/* Enhancement 2: colored icon container */}
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                                style={{ backgroundColor: "color-mix(in oklch, var(--color-accent) 10%, transparent)" }}
                            >
                                {icon}
                            </div>
                            <div className="card__header gap-1.5">
                                <h3 className="card__title text-base font-semibold">{title}</h3>
                                {/* FIX 4: description readable via text-foreground/55 */}
                                <p className="text-sm text-foreground/55 leading-relaxed">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA Banner ── */}
            {/* FIX 5: section has a heading now, visually separate from features */}
            <section className="px-8 pb-24 max-w-5xl mx-auto w-full">
                <div
                    className="card flex flex-col items-center gap-4 text-center py-14 px-8 overflow-hidden relative"
                    style={{
                        background:
                            "radial-gradient(ellipse 100% 120% at 50% 110%, color-mix(in oklch, var(--color-accent) 8%, var(--color-surface-secondary)), var(--color-surface-secondary))",
                    }}
                >
                    <h2 className="text-3xl font-bold text-foreground">
                        Ready to grow your coaching business?
                    </h2>
                    <p className="text-foreground/55 max-w-md">
                        Join hundreds of coaches already using FitForceX to manage
                        their clients and scale their business.
                    </p>
                    <Link href="/register" className="button button--primary button--lg mt-2">
                        Get Started — It&apos;s Free
                    </Link>
                </div>
            </section>

            {/* ── Footer ── Enhancement 5: links row */}
            <footer className="py-8 border-t border-border">
                <div className="max-w-5xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-xs text-foreground/45">
                        © {new Date().getFullYear()} FitForceX. All rights reserved.
                    </span>
                    <div className="flex gap-6">
                        {footerLinks.map((link) => (
                            <a
                                key={link}
                                href="#"
                                className="text-xs text-foreground/45 hover:text-foreground transition-colors"
                            >
                                {link}
                            </a>
                        ))}
                    </div>
                </div>
            </footer>
        </main>
    );
}
