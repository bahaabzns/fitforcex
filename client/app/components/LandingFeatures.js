import Link from "next/link";
import { Chip } from "@heroui/react/chip";
import { CheckCircle2 } from 'lucide-react';

function FeatureSection({ chip, heading, bullets, reversed, dimBg }) {
    return (
        <section
            className="py-16 md:py-24 px-6"
            style={dimBg ? { background: "rgba(255,255,255,0.015)" } : undefined}
        >
            <div
                className={`mx-auto max-w-7xl flex flex-col gap-14 items-center ${
                    reversed ? "md:flex-row-reverse" : "md:flex-row"
                }`}
            >
                {/* ── Text block ── */}
                <div className="flex-1 flex flex-col gap-6 max-w-lg">
                    <Chip color="accent" size="sm">
                        {chip}
                    </Chip>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                        {heading}
                    </h2>
                    <ul className="flex flex-col gap-4">
                        {bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <span className="text-white/60 leading-relaxed">{b}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-col gap-2 mt-2">
                        <Link
                            href="/register"
                            className="button button--primary button--md w-fit"
                        >
                            Get Started – It&apos;s FREE!
                        </Link>
                        <p className="text-white/50 text-sm">✓ No credit card needed, cancel any time</p>
                    </div>
                </div>

                {/* ── Image block ── */}
                <div className="flex-1 w-full">
                    <div
                        className="rounded-2xl border border-white/10 overflow-hidden"
                        style={{
                            boxShadow:
                                "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                        }}
                    >
                        <img
                            src="/image_placeholder.png"
                            alt={heading}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function LandingFeatures() {
    return (
        <div id="features">

            <FeatureSection
                chip="Client Management"
                heading="Unlimited Number of Clients"
                bullets={[
                    "Add as many clients as you want with no caps or restrictions",
                    "No forced upgrades or hidden fees as your business grows",
                    "Complete freedom to scale your coaching exactly the way you choose",
                ]}
                reversed={false}
                dimBg={false}
            />

            <FeatureSection
                chip="Accessibility"
                heading="Work From Anywhere"
                bullets={[
                    "Fully optimized for mobile, laptop, and tablet",
                    "Manage clients, send plans, and reply to chats from anywhere",
                    "Your entire workflow stays with you — gym, home, café, or traveling",
                ]}
                reversed={true}
                dimBg={true}
            />

            <FeatureSection
                chip="Plan Delivery"
                heading="Deliver Plans the Way You Want"
                bullets={[
                    "Choose between professional PDF, organized client portal, or mobile app",
                    "Pick the format that fits your brand and gives clients a premium experience",
                    "Fast, polished, and impressive delivery every single time",
                ]}
                reversed={false}
                dimBg={false}
            />

            <FeatureSection
                chip="Libraries"
                heading="Ready-to-Use Exercise & Food Libraries"
                bullets={[
                    "Hundreds of exercises with GIF demonstrations and full food database",
                    "No more collecting data from scratch or building lists manually",
                    "Every item is fully editable to tailor plans to your coaching style",
                ]}
                reversed={true}
                dimBg={true}
            />

            <FeatureSection
                chip="Progress Tracking"
                heading="Client Progress Tracking"
                bullets={[
                    "Check-ins, workout logs, progress photos — all in one place",
                    "Monitor every client day by day and make smarter decisions faster",
                    "Boosts engagement, speeds up results, and improves commitment",
                ]}
                reversed={false}
                dimBg={false}
            />

            <FeatureSection
                chip="User Experience"
                heading="Extremely Easy to Use"
                bullets={[
                    "Clean, intuitive interface helps you create full plans in minutes",
                    "Clients receive everything neatly organized in their own portal",
                    "No confusion, no complexity — just a smooth premium experience",
                ]}
                reversed={true}
                dimBg={true}
            />

        </div>
    );
}
