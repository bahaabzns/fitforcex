import { Accordion } from "@heroui/react/accordion";
import { Chip } from "@heroui/react/chip";

const faqs = [
    {
        id: "1",
        question: "Can I try FitForce for free?",
        answer:
            "Yes — every new account starts with a 14-day free trial. No credit card required. You get full access to all features so you can explore the platform before choosing a plan.",
    },
    {
        id: "2",
        question: "How many clients can I manage?",
        answer:
            "The FitForce plan supports up to 20 clients. The TeamForce plan gives you unlimited clients. You can upgrade or downgrade your plan at any time from your billing settings.",
    },
    {
        id: "3",
        question: "Can my clients access their plans on mobile?",
        answer:
            "Absolutely. The client portal is fully responsive and works on any device — phone, tablet, or desktop. Clients can view their training and nutrition plans, log check-ins, and track progress from anywhere.",
    },
    {
        id: "4",
        question: "Do I need any technical knowledge to get started?",
        answer:
            "Not at all. FitForce is built to be intuitive from day one. Most coaches are fully set up within an hour. We also provide onboarding guides and support to help you get started quickly.",
    },
    {
        id: "5",
        question: "How does plan delivery work?",
        answer:
            "You build the plan inside FitForce and then send it to your client with one click. Clients receive access through their personal portal. You can also export any plan as a branded PDF if you prefer to share it directly.",
    },
    {
        id: "6",
        question: "Can I add my own exercises and foods?",
        answer:
            "Yes. In addition to the built-in exercise and food libraries, you can add your own custom items to build a database that matches your coaching style and client needs.",
    },
    {
        id: "7",
        question: "Can I cancel my subscription at any time?",
        answer:
            "Yes, you can cancel anytime from your account settings with no penalties. Your access continues until the end of the current billing period. We don't lock you into long-term contracts.",
    },
];

export default function LandingFaq() {
    return (
        <section id="faq" className="py-16 md:py-24 px-6">
            <div className="mx-auto max-w-3xl flex flex-col gap-12">

                {/* ── Heading ── */}
                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">
                        FAQ
                    </Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-white/50 leading-relaxed">
                        Everything you need to know before you start.
                    </p>
                </div>

                {/* ── Accordion ── */}
                <Accordion variant="surface" allowsMultipleExpanded>
                    {faqs.map(({ id, question, answer }) => (
                        <Accordion.Item key={id} id={id}>
                            <Accordion.Heading>
                                <Accordion.Trigger>
                                    <span className="text-left font-medium text-foreground">
                                        {question}
                                    </span>
                                    <Accordion.Indicator />
                                </Accordion.Trigger>
                            </Accordion.Heading>
                            <Accordion.Panel>
                                <Accordion.Body>
                                    <p className="text-foreground/60 leading-relaxed">
                                        {answer}
                                    </p>
                                </Accordion.Body>
                            </Accordion.Panel>
                        </Accordion.Item>
                    ))}
                </Accordion>

            </div>
        </section>
    );
}
