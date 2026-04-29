
import Link from "next/link";

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-[#D2D2D7]">
                <span className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                    FitForce<span className="text-[#007AFF]">X</span>
                </span>
                <div className="flex gap-3">
                    <Link
                        href="/login"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[#007AFF] border border-[#007AFF] hover:bg-[#007AFF] hover:text-white transition-colors"
                    >
                        Log In
                    </Link>
                    <Link
                        href="/register"
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[#007AFF] text-white hover:bg-[#0056CC] transition-colors"
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="flex flex-col items-center justify-center flex-1 text-center px-6 py-24 gap-6">
                <h1 className="text-5xl font-extrabold tracking-tight leading-tight max-w-2xl">
                    The all-in-one platform for{" "}
                    <span className="text-[#007AFF]">fitness coaches</span>
                </h1>
                <p className="text-lg text-[#86868B] max-w-xl">
                    Manage your clients, build training programs, track nutrition, and grow your coaching business — all in one place.
                </p>
                <div className="flex gap-4 mt-2">
                    <Link
                        href="/register"
                        className="px-6 py-3 rounded-xl bg-[#007AFF] text-white font-semibold text-base hover:bg-[#0056CC] transition-colors shadow"
                    >
                        Start for Free
                    </Link>
                    <Link
                        href="/login"
                        className="px-6 py-3 rounded-xl border border-[#D2D2D7] bg-white text-[#1D1D1F] font-semibold text-base hover:bg-[#F0F0F5] transition-colors"
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
                        className="bg-white rounded-2xl border border-[#D2D2D7] p-6 flex flex-col gap-3 shadow-sm"
                    >
                        <span className="text-3xl">{icon}</span>
                        <h3 className="font-semibold text-lg">{title}</h3>
                        <p className="text-sm text-[#86868B]">{desc}</p>
                    </div>
                ))}
            </section>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-[#86868B] border-t border-[#D2D2D7]">
                © {new Date().getFullYear()} FitForceX. All rights reserved.
            </footer>
        </main>
    );
}
