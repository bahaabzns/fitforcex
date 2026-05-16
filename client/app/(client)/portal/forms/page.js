"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Clock, CheckCircle, ClipboardList, CalendarClock } from "lucide-react";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";

export default function ClientFormsListPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // "all" | "pending" | "scheduled" | "submitted"

    useEffect(() => {
        api.get("/api/client-portal/form-requests")
            .then(res => setRequests(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = requests.filter((r) => {
        if (filter === "all") return true;
        if (filter === "pending") return r.status === "pending";
        if (filter === "scheduled") return r.status === "scheduled";
        if (filter === "submitted") return r.status === "submitted" || r.status === "reviewed";
        return true;
    });
    const pendingCount = requests.filter(r => r.status === "pending").length;

    if (loading) {
        return (
            <div className="p-8 max-w-3xl mx-auto flex flex-col gap-3">
                <Skeleton className="h-8 w-32 rounded-lg mb-2" />
                {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-2xl font-bold text-foreground flex-1">Forms</h1>
                {pendingCount > 0 && (
                    <Chip size="sm" className="bg-yellow-500/15 text-yellow-600">{pendingCount} pending</Chip>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-5 border-b border-border -mt-2">
                {[
                    { key: "all", label: "All" },
                    { key: "pending", label: "Pending" },
                    { key: "scheduled", label: "Scheduled" },
                    { key: "submitted", label: "Submitted" },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer -mb-px border-b-2 ${
                            filter === tab.key
                                ? "text-primary border-primary"
                                : "text-muted-foreground border-transparent hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <Card>
                    <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <ClipboardList size={40} className="text-muted-foreground/30" />
                        <p className="text-base font-medium text-muted-foreground">
                            {filter === "pending"
                                ? "No pending forms"
                                : filter === "scheduled"
                                ? "No scheduled forms"
                                : filter === "submitted"
                                ? "No submitted forms yet"
                                : "No forms yet"}
                        </p>
                        <p className="text-sm text-muted-foreground/70">Your coach will send forms for you to fill out.</p>
                    </Card.Content>
                </Card>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map(req => (
                        <Card key={req.id}>
                            <Card.Content className="p-6 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground">{req.form_title}</p>
                                    {req.form_description && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{req.form_description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {req.status === "scheduled" && req.scheduled_at
                                            ? `Scheduled ${new Date(req.scheduled_at).toLocaleString()}`
                                            : `Requested ${new Date(req.requested_at).toLocaleDateString()}`}
                                        {req.submitted_at && ` · Submitted ${new Date(req.submitted_at).toLocaleDateString()}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {req.status === "pending" ? (
                                        <>
                                            <Chip size="sm" className="bg-yellow-500/15 text-yellow-600">
                                                <Clock size={11} className="mr-1" /> Pending
                                            </Chip>
                                            <Link
                                                href={`/client/forms/${req.id}`}
                                                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
                                            >
                                                Fill Form
                                            </Link>
                                        </>
                                    ) : req.status === "scheduled" ? (
                                        <div className="flex items-center gap-2">
                                            <Chip size="sm" className="bg-accent/15 text-accent">
                                                <CalendarClock size={11} className="mr-1" /> Scheduled
                                            </Chip>
                                            <span className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground">
                                                Not Open Yet
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Chip size="sm" className="bg-green-500/15 text-green-700">
                                                <CheckCircle size={11} className="mr-1" /> Submitted
                                            </Chip>
                                            <Link
                                                href={`/client/forms/${req.id}`}
                                                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                                            >
                                                View Answers
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </Card.Content>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
