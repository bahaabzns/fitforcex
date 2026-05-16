'use client';

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Users, ClipboardList, TrendingUp, AlertCircle } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";

const STATUS_CHIP = {
    Active:      "bg-green-500/15 text-green-700",
    Expired:     "bg-destructive/10 text-destructive",
    Frozen:      "bg-accent/15 text-accent",
    "Pre-start": "bg-yellow-500/15 text-yellow-600",
    Cancelled:   "bg-secondary text-muted-foreground",
    Refunded:    "bg-purple-500/15 text-purple-600",
};

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const router = useRouter();
    const { workspaceSlug } = useParams();

    useEffect(() => {
        api.get('/api/dashboard')
            .then(res => setData(res.data))
            .catch(() => router.push('/login'));
    }, [router]);

    if (!data) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-52 rounded-lg mb-8" />
                <div className="flex gap-4 flex-wrap mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-28 w-44 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-5 w-32 rounded mb-3" />
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 rounded-lg mb-2" />
                ))}
            </div>
        );
    }

    const { fname, stats, recentClients } = data;

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Greeting */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    Welcome back, {fname}!
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Here's what's happening in your workspace.</p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
                {[
                    { icon: Users,         label: "Total Clients",  value: stats.totalClients },
                    { icon: TrendingUp,    label: "Active Clients", value: stats.activeClients,
                      sub: stats.totalClients > 0
                          ? `${Math.round((stats.activeClients / stats.totalClients) * 100)}% of total`
                          : undefined },
                    { icon: AlertCircle,   label: "Expired",        value: stats.expiredClients },
                    { icon: ClipboardList, label: "Pending Forms",  value: stats.pendingForms,
                      sub: stats.pendingForms > 0 ? "awaiting response" : "all caught up" },
                ].map(({ icon: Icon, label, value, sub, accent }) => (
                    <Card key={label} className="min-w-40">
                        <Card.Content className="flex flex-col gap-3 p-5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10"}`}>
                                <Icon size={17} className={accent ? "text-white" : "text-primary"} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{value}</p>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                            </div>
                        </Card.Content>
                    </Card>
                ))}
            </div>

            {/* Recent clients */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-foreground">Recent Clients</h2>
                    <Link
                        href={`/${workspaceSlug}/clients`}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                        View all →
                    </Link>
                </div>

                {recentClients.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                        <p className="text-sm text-muted-foreground">No clients yet.</p>
                        <Link
                            href={`/${workspaceSlug}/clients`}
                            className="mt-2 inline-block text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                            Add your first client →
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                        {recentClients.map((client, idx) => (
                            <Link
                                key={client.id}
                                href={`/${workspaceSlug}/clients/${client.id}`}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-default/40 transition-colors ${
                                    idx < recentClients.length - 1 ? "border-b border-border" : ""
                                }`}
                            >
                                <Avatar size="sm" color="primary" className="shrink-0">
                                    <Avatar.Fallback>
                                        {`${client.fname?.[0] ?? ""}${client.lname?.[0] ?? ""}`.toUpperCase() || "?"}
                                    </Avatar.Fallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {client.fname} {client.lname}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                </div>
                                <Chip
                                    size="sm"
                                    className={`shrink-0 ${STATUS_CHIP[client.subscription_status] ?? "bg-secondary text-muted-foreground"}`}
                                >
                                    {client.subscription_status}
                                </Chip>
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {new Date(client.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
