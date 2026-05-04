"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

export default function SettingsPage() {
    const [coach, setCoach] = useState(null);
    const [newSlug, setNewSlug] = useState("");
    const [loading, setLoading] = useState(true);
    const [customizing, setCustomizing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const fetchCoach = async () => {
            try {
                const res = await api.get("/api/auth/me");
                setCoach(res.data);
                setNewSlug(res.data.coach_slug || "");
            } catch (err) {
                console.error(err);
                setError("Failed to load coach profile");
            } finally {
                setLoading(false);
            }
        };
        fetchCoach();
    }, []);

    const handleCustomizeSlug = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setCustomizing(true);

        try {
            const res = await api.put("/api/auth/coach-slug", { new_slug: newSlug });
            setCoach(res.data);
            setSuccess("Portal slug updated successfully!");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update slug");
        } finally {
            setCustomizing(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">Settings</h1>
                <div className="space-y-4">
                    <div className="h-10 rounded-lg bg-secondary animate-pulse" />
                    <div className="h-10 rounded-lg bg-secondary animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl">
            <h1 className="text-3xl font-bold text-foreground mb-8">Settings</h1>

            {/* Coach Profile Card */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mb-8">
                <h2 className="text-xl font-bold text-foreground mb-4">Coach Profile</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                        <p className="text-lg text-foreground">
                            {coach?.fname} {coach?.lname}
                        </p>
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="text-lg text-foreground">{coach?.email}</p>
                    </div>
                </div>
            </div>

            {/* Portal Slug Card */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Client Portal</h2>

                <div className="space-y-6">
                    {/* Current Slug Display */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground block mb-2">
                            Your Portal URL
                        </label>
                        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                            <code className="text-sm text-foreground break-all">
                                {typeof window !== "undefined"
                                    ? `${window.location.origin}/portal/${coach?.coach_slug}`
                                    : `/portal/${coach?.coach_slug}`}
                            </code>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Share this link with your clients to access their training and nutrition plans.
                        </p>
                    </div>

                    {/* Customize Slug Form (only if not customized yet) */}
                    {coach && !coach.slug_customized && (
                        <div className="pt-4 border-t border-border">
                            <p className="text-sm text-muted-foreground mb-4">
                                Customize your portal slug to something more memorable. You can only do this once.
                            </p>

                            <form onSubmit={handleCustomizeSlug} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-2">
                                        Custom Portal Slug
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                                /portal/
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="your-slug"
                                                value={newSlug}
                                                onChange={(e) => setNewSlug(e.target.value)}
                                                className="w-full px-3 py-2 pl-16 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                                                disabled={customizing}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Use lowercase letters, numbers, and hyphens only.
                                    </p>
                                </div>

                                {error && (
                                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}

                                {success && (
                                    <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                        {success}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={customizing || !newSlug.trim()}
                                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
                                >
                                    {customizing ? "Updating…" : "Customize Slug"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Slug already customized message */}
                    {coach?.slug_customized && (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <p className="text-sm text-blue-900">
                                ✓ Your portal slug has been customized and cannot be changed.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
