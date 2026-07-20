'use client';

import { useTranslations } from "next-intl";
import { Accordion } from "@heroui/react/accordion";
import { Chip } from "@heroui/react/chip";
import { HelpCircle } from "lucide-react";

const FAQ_IDS = ["q1", "q2", "q3", "q4", "q6", "q7", "q8"];

export default function LandingFaq() {
    const t = useTranslations("landing.faq");
    const faqs = FAQ_IDS.map((id) => ({ id, ...t.raw(id) }));

    return (
        <section id="faq" className="py-16 md:py-24 px-6">
            <div className="mx-auto max-w-3xl flex flex-col gap-8">

                {/* ── Heading ── */}
                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">
                        FAQ
                    </Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">
                        {t("title")}
                    </h2>
                    <p className="text-white/50 leading-relaxed">
                        {t("subtitle")}
                    </p>
                    <p className="flex items-center justify-center gap-1.5 text-primary text-sm">
                        <HelpCircle className="h-4 w-4" />
                        {t("stillHaveQuestions")}
                    </p>
                </div>

                {/* ── Accordion ── */}
                <Accordion variant="surface" allowsMultipleExpanded defaultExpandedKeys={["q1"]}>
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
