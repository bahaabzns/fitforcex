"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Clock, CheckCircle, ClipboardList } from "lucide-react";

export default function ClientFormsListPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // "all" | "pending" | "submitted"

    useEffect(() => {
        api.get("/api/client-portal/form-requests")
            .then(res => setRequests(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = requests.filter((r) => {
        if (filter === "all") return true;
        if (filter === "pending") return r.status === "pending";
        if (filter === "submitted") return r.status !== "pending";
        return true;
    });
    const pendingCount = requests.filter(r => r.status === "pending").length;

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-sm text-gray-400">Loading…</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex-1">Forms</h1>
                {pendingCount > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                        {pendingCount} pending
                    </span>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-5 border-b border-gray-200 -mt-2">
                {[
                    { key: "all", label: "All" },
                    { key: "pending", label: "Pending" },
                    { key: "submitted", label: "Submitted" },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer -mb-px border-b-2 ${
                            filter === tab.key
                                ? "text-blue-600 border-blue-500"
                                : "text-gray-500 border-transparent hover:text-gray-700"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <ClipboardList size={40} className="text-gray-200" />
                    <p className="text-base font-medium text-gray-600">
                        {filter === "pending" ? "No pending forms" : filter === "submitted" ? "No submitted forms yet" : "No forms yet"}
                    </p>
                    <p className="text-sm text-gray-400">Your coach will send forms for you to fill out.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map(req => (
                        <div key={req.id} className="card flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900">{req.form_title}</p>
                                {req.form_description && (
                                    <p className="text-sm text-gray-400 mt-0.5">{req.form_description}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Requested {new Date(req.requested_at).toLocaleDateString()}
                                    {req.submitted_at && ` · Submitted ${new Date(req.submitted_at).toLocaleDateString()}`}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {req.status === "pending" ? (
                                    <>
                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                            <Clock size={11} /> Pending
                                        </span>
                                        <Link
                                            href={`/client/forms/${req.id}`}
                                            className="btn-primary px-3 py-1.5 text-sm"
                                        >
                                            Fill Form
                                        </Link>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                                            <CheckCircle size={11} /> Submitted
                                        </span>
                                        <Link
                                            href={`/client/forms/${req.id}`}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors"
                                        >
                                            View Answers
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
