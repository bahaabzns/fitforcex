import Link from "next/link";

export default function LandingCta() {
    return (
        <section className="px-6 py-16 md:py-24">
            <div className="mx-auto max-w-4xl">
                <div
                    className="relative rounded-3xl overflow-hidden flex flex-col items-center text-center gap-6 px-6 py-12 sm:px-8 sm:py-20"
                    style={{
                        background:
                            "radial-gradient(ellipse 80% 60% at 50% 110%, color-mix(in oklch, var(--color-primary) 20%, #0d1626), #0a0f1c)",
                        border: "1px solid color-mix(in oklch, var(--color-primary) 20%, rgba(255,255,255,0.06))",
                        boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.5), 0 0 80px color-mix(in oklch, var(--color-primary) 10%, transparent)",
                    }}
                >
                    {/* Top glow ring */}
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px"
                        style={{
                            background:
                                "linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-primary) 50%, transparent), transparent)",
                        }}
                    />

                    <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight max-w-2xl">
                        Ready to Transform Your{" "}
                        <span className="text-primary">Coaching Business?</span>
                    </h2>

                    <p className="text-white/55 max-w-lg leading-relaxed text-lg">
                        Join hundreds of coaches already using FitForce to manage
                        their clients, deliver plans, and scale their business.
                    </p>

                    <div className="flex flex-col items-center gap-2 mt-2">
                        <Link
                            href="/register"
                            className="button button--primary button--lg"
                        >
                            Get Started – It&apos;s FREE!
                        </Link>
                        <p className="text-white/50 text-sm">✓ No credit card needed, cancel any time</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
