"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { calcMeal } from "@/lib/nutritionCalc";

export default function ClientDashboardPage() {
    const [client, setClient] = useState(null);
    const [plan, setPlan] = useState(null);
    const [trainingPlan, setTrainingPlan] = useState(null);
    const [activeCycleIndex, setActiveCycleIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [noplan, setNoPlan] = useState(false);
    const [noTrainingPlan, setNoTrainingPlan] = useState(false);
    const router = useRouter();

    useEffect(() => {
        async function load() {
            try {
                const [meRes, planRes, trainingRes] = await Promise.all([
                    api.get("/api/client-portal/me"),
                    api.get("/api/client-portal/active-plan").catch((e) => {
                        if (e.response?.status === 404) return null;
                        throw e;
                    }),
                    api.get("/api/client-portal/active-training-plan").catch((e) => {
                        if (e.response?.status === 404) return null;
                        throw e;
                    }),
                ]);
                setClient(meRes.data);
                if (!planRes) {
                    setNoPlan(true);
                } else {
                    setPlan(planRes.data);
                }
                if (!trainingRes) {
                    setNoTrainingPlan(true);
                } else {
                    setTrainingPlan(trainingRes.data);
                }
            } catch (err) {
                router.push("/client/login");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-gray-500">Loading…</p>
            </div>
        );
    }

    const cycle = plan?.cycles?.[activeCycleIndex] ?? null;

    return (
        <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
            {/* Page heading */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Nutrition Plan</h1>
                {client && <p className="text-sm text-gray-500 mt-0.5">Welcome back, {client.fname}!</p>}
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">Active Training Plan</h2>
                    {trainingPlan && <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">Active</span>}
                </div>
                {!trainingPlan || noTrainingPlan ? (
                    <p className="text-sm text-gray-500">No active training plan yet.</p>
                ) : (
                    <>
                        <p className="text-base font-semibold text-gray-800">{trainingPlan.name}</p>
                        <p className="text-sm text-gray-500 mt-1">{trainingPlan.days?.length ?? 0} days assigned</p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(trainingPlan.days ?? []).slice(0, 4).map((day) => (
                                <div key={day.id} className="rounded-lg border border-gray-200 px-3 py-2">
                                    <p className="text-sm font-semibold text-gray-800">{day.name}</p>
                                    <p className="text-xs text-gray-500">{day.exercises?.length ?? 0} exercises</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {noplan || !plan ? (
                    <div className="card flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <svg className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-base font-medium text-gray-600">No active plan yet</p>
                        <p className="text-sm text-gray-400">Your coach hasn&apos;t activated a nutrition plan for you yet.</p>
                    </div>
                ) : (
                    <>
                        {/* Plan Header */}
                        <div className="card flex items-center justify-between">
                            <div>
                                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Active Plan</p>
                                <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">Active</span>
                        </div>

                        {/* Cycle Tabs */}
                        {plan.cycles.length > 1 && (
                            <div className="flex gap-2 flex-wrap">
                                {plan.cycles.map((c, i) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setActiveCycleIndex(i)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                            activeCycleIndex === i
                                                ? "bg-blue-500 border-blue-500 text-white"
                                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                        }`}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {cycle && (
                            <>
                                {/* Cycle Goals */}
                                {(cycle.goal_calories || cycle.goal_protein || cycle.goal_carbs || cycle.goal_fats) && (
                                    <div className="card">
                                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Goals — {cycle.name}</h3>
                                        <div className="grid grid-cols-4 gap-3">
                                            {[
                                                { label: "Calories", value: cycle.goal_calories, unit: "kcal", color: "text-orange-500" },
                                                { label: "Protein",  value: cycle.goal_protein,  unit: "g",    color: "text-blue-500"   },
                                                { label: "Carbs",    value: cycle.goal_carbs,    unit: "g",    color: "text-yellow-500" },
                                                { label: "Fats",     value: cycle.goal_fats,     unit: "g",    color: "text-pink-500"   },
                                            ].map(({ label, value, unit, color }) => value ? (
                                                <div key={label} className="flex flex-col items-center bg-gray-50 rounded-xl p-3">
                                                    <span className={`text-lg font-bold ${color}`}>{value}</span>
                                                    <span className="text-xs text-gray-400">{unit}</span>
                                                    <span className="text-xs font-medium text-gray-600 mt-0.5">{label}</span>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </div>
                                )}

                                {/* Cycle Note */}
                                {cycle.note && (
                                    <div className="card bg-yellow-50 border border-yellow-200">
                                        <p className="text-xs font-semibold text-yellow-700 mb-1">Coach Note</p>
                                        <p className="text-sm text-yellow-800 whitespace-pre-wrap">{cycle.note}</p>
                                    </div>
                                )}

                                {/* Meals */}
                                <div className="flex flex-col gap-4">
                                    {cycle.meals.map((meal) => {
                                        const totals = calcMeal(meal);
                                        return (
                                            <div key={meal.id} className="card">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-semibold text-gray-900">{meal.name}</h4>
                                                    <div className="flex gap-3 text-xs text-gray-500">
                                                        <span>{Math.round(totals.calories)} kcal</span>
                                                        <span className="text-blue-500">P {Math.round(totals.protein)}g</span>
                                                        <span className="text-yellow-500">C {Math.round(totals.carbs)}g</span>
                                                        <span className="text-pink-500">F {Math.round(totals.fats)}g</span>
                                                    </div>
                                                </div>

                                                {meal.note && (
                                                    <p className="text-xs text-gray-500 italic mb-3">{meal.note}</p>
                                                )}

                                                <div className="flex flex-col divide-y divide-gray-100">
                                                    {meal.items.map((item) => (
                                                        <div key={item.id} className="py-2.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium text-gray-800">{item.name}</span>
                                                                <span className="text-sm text-gray-500">
                                                                    {item.amount}{item.serving_unit}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                                                                <span>{Math.round((item.amount / item.serving_size) * item.calories_per_serving)} kcal</span>
                                                                <span>P {Math.round((item.amount / item.serving_size) * item.protein_per_serving)}g</span>
                                                                <span>C {Math.round((item.amount / item.serving_size) * item.carbs_per_serving)}g</span>
                                                                <span>F {Math.round((item.amount / item.serving_size) * item.fats_per_serving)}g</span>
                                                            </div>
                                                            {item.alternatives?.length > 0 && (
                                                                <div className="mt-2 pl-3 border-l-2 border-gray-200">
                                                                    <p className="text-xs text-gray-400 mb-1">Alternatives:</p>
                                                                    {item.alternatives.map((alt) => (
                                                                        <div key={alt.id} className="flex items-center justify-between py-1">
                                                                            <span className="text-xs text-gray-600">{alt.name}</span>
                                                                            <span className="text-xs text-gray-400">{alt.amount}{alt.serving_unit}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </>
                )}
        </div>
    );
}
