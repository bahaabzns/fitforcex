"use client";
import { useState, useRef } from "react";

const ACTIVITY_LEVELS = [
    { value: 1.2,   label: "Sedentary",    sub: "Little or no exercise"        },
    { value: 1.375, label: "Light",        sub: "1–3 days/week"                },
    { value: 1.55,  label: "Moderate",     sub: "3–5 days/week"                },
    { value: 1.725, label: "Active",       sub: "6–7 days/week"                },
    { value: 1.9,   label: "Very Active",  sub: "Hard exercise + physical job"  },
];

const BF_CATEGORIES_MALE = [
    { label: "Essential Fat", range: "2–5%"   },
    { label: "Athletes",      range: "6–13%"  },
    { label: "Fitness",       range: "14–17%" },
    { label: "Average",       range: "18–24%" },
    { label: "Obese",         range: "25%+"   },
];
const BF_CATEGORIES_FEMALE = [
    { label: "Essential Fat", range: "10–13%" },
    { label: "Athletes",      range: "14–20%" },
    { label: "Fitness",       range: "21–24%" },
    { label: "Average",       range: "25–31%" },
    { label: "Obese",         range: "32%+"   },
];

function calcNavyBodyFat(gender, { neck, waist, hip, height }) {
    if (!neck || !waist || !height) return null;
    if (gender === "male") {
        const val = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
        return Math.max(0, Math.round(val * 10) / 10);
    } else {
        if (!hip) return null;
        const val = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(height)) - 450;
        return Math.max(0, Math.round(val * 10) / 10);
    }
}

function calcBMR(formula, gender, { age, weight, height, neck, waist, hip }) {
    if (formula === "mifflin") {
        const base = 10 * weight + 6.25 * height - 5 * age;
        return gender === "male" ? base + 5 : base - 161;
    }
    if (formula === "harris") {
        return gender === "male"
            ? 13.397 * weight + 4.799 * height - 5.677 * age + 88.362
            : 9.247 * weight + 3.098 * height - 4.33 * age + 447.593;
    }
    if (formula === "katch") {
        const bf = calcNavyBodyFat(gender, { neck, waist, hip, height });
        if (bf === null) return null;
        const lbm = weight * (1 - bf / 100);
        return 370 + 21.6 * lbm;
    }
    return null;
}

function SectionLabel({ children }) {
    return (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            {children}
        </p>
    );
}

function InputWithUnit({ label, unit, value, onChange, placeholder, step, min, max, required }) {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className="text-xs font-medium text-gray-500">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
            )}
            <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[#FAFAFA] overflow-hidden focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition">
                <input
                    type="number"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    step={step}
                    min={min}
                    max={max}
                    className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-gray-900 min-w-0"
                />
                {unit && (
                    <span className="px-3 text-xs font-medium text-gray-400 border-l border-[var(--border-color)] shrink-0">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function CycleCalculator({ cycle, onApply }) {
    const [formula, setFormula]   = useState("mifflin");
    const [gender, setGender]     = useState("male");
    const [activity, setActivity] = useState(1.2);
    const [age, setAge]           = useState("25");
    const [weight, setWeight]     = useState("70");
    const [height, setHeight]     = useState("175");
    const [neck, setNeck]         = useState("38");
    const [waist, setWaist]       = useState("80");
    const [hip, setHip]           = useState("95");
    const [bfMode, setBfMode]     = useState("navy");
    const [directBf, setDirectBf] = useState("");
    const [result, setResult]     = useState(null);
    const [tdee, setTdee]         = useState("");
    const [macros, setMacros]     = useState({ protein: 30, carbs: 40, fats: 30 });

    const scrollContainerRef = useRef(null);
    const resultsRef         = useRef(null);

    const needsMeasurements = formula === "katch" && bfMode === "navy";
    const totalPct = macros.protein + macros.carbs + macros.fats;

    const gramsFrom = (pct, kcalPerGram) =>
        tdee ? Math.round((Number(tdee) * pct) / 100 / kcalPerGram) : 0;
    const proteinG = gramsFrom(macros.protein, 4);
    const carbsG   = gramsFrom(macros.carbs,   4);
    const fatsG    = gramsFrom(macros.fats,     9);

    const handleCalculate = () => {
        const a = Number(age), w = Number(weight), h = Number(height);
        if (!a || !w || !h) return;

        let bmr, bf = null;
        if (formula === "katch") {
            if (bfMode === "direct") {
                const bfVal = Number(directBf);
                if (!directBf || isNaN(bfVal) || bfVal <= 0) return;
                bmr = 370 + 21.6 * (w * (1 - bfVal / 100));
                bf  = bfVal;
            } else {
                const n = Number(neck), wa = Number(waist), hi = Number(hip);
                if (!n || !wa || (gender === "female" && !hi)) return;
                bmr = calcBMR(formula, gender, { age: a, weight: w, height: h, neck: n, waist: wa, hip: hi });
                bf  = calcNavyBodyFat(gender, { neck: n, waist: wa, hip: hi, height: h });
            }
        } else {
            const n = Number(neck), wa = Number(waist), hi = Number(hip);
            bmr = calcBMR(formula, gender, { age: a, weight: w, height: h, neck: n, waist: wa, hip: hi });
            if (bfMode === "navy" && n && wa && h && (gender === "male" || (gender === "female" && hi))) {
                bf = calcNavyBodyFat(gender, { neck: n, waist: wa, hip: hi, height: h });
            } else if (bfMode === "direct" && directBf) {
                bf = Number(directBf);
            }
        }

        if (bmr == null) return;
        setResult({ bmr: Math.round(bmr), bodyFat: bf });
        setTdee(String(Math.round(bmr * Number(activity))));
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
    };

    const handleMacroPct = (key, val) => {
        setMacros(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(val))) }));
    };

    const handleApply = () => {
        onApply({
            goal_calories: Number(tdee),
            goal_protein:  proteinG,
            goal_carbs:    carbsG,
            goal_fats:     fatsG,
            body_fat:      result?.bodyFat ?? null,
        });
    };

    const bfCategories = gender === "male" ? BF_CATEGORIES_MALE : BF_CATEGORIES_FEMALE;

    const macroConfig = [
        { key: "protein", label: "Protein", bar: "bg-blue-400",  text: "text-blue-500",  g: proteinG },
        { key: "carbs",   label: "Carbs",   bar: "bg-amber-400", text: "text-amber-500", g: carbsG   },
        { key: "fats",    label: "Fats",    bar: "bg-pink-400",  text: "text-pink-500",  g: fatsG    },
    ];

    return (
        <div ref={scrollContainerRef} className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0 pr-0.5">

            {/* ── Formula ── */}
            <div>
                <SectionLabel>BMR Formula</SectionLabel>
                <div className="flex flex-row gap-1.5">
                    {[
                        { value: "mifflin", label: "Mifflin-St Jeor",       sub: "Most accurate general formula" },
                        { value: "harris",  label: "Harris-Benedict (rev.)", sub: "Classic revised formula"       },
                        { value: "katch",   label: "Katch-McArdle",          sub: "Requires body fat %"           },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setFormula(opt.value)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                                formula === opt.value
                                    ? "border-[var(--accent)] bg-blue-50"
                                    : "border-[var(--border-color)] hover:border-gray-300 bg-[#FAFAFA]"
                            }`}
                        >
                            <p className={`text-sm font-medium ${formula === opt.value ? "text-[var(--accent)]" : "text-gray-700"}`}>
                                {opt.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Gender ── */}
            <div>
                <SectionLabel>Gender</SectionLabel>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                    {["male", "female"].map(g => (
                        <button
                            key={g}
                            onClick={() => setGender(g)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                gender === g
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {g === "male" ? "Male" : "Female"}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Activity Level ── */}
            <div>
                <SectionLabel>Activity Level</SectionLabel>
                <div className="flex flex-col gap-1">
                    {ACTIVITY_LEVELS.map(l => (
                        <button
                            key={l.value}
                            onClick={() => setActivity(l.value)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                                activity === l.value
                                    ? "border-[var(--accent)] bg-blue-50"
                                    : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                            }`}
                        >
                            <span className={`text-sm font-medium ${activity === l.value ? "text-[var(--accent)]" : "text-gray-700"}`}>
                                {l.label}
                            </span>
                            <span className="text-xs text-gray-400">{l.sub}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body Metrics ── */}
            <div>
                <SectionLabel>Body Metrics</SectionLabel>
                <div className="grid grid-cols-3 gap-2.5">
                    <InputWithUnit label="Age"    unit="yrs" required value={age}    onChange={e => setAge(e.target.value)}    min={1} max={120} />
                    <InputWithUnit label="Weight" unit="kg"  required value={weight} onChange={e => setWeight(e.target.value)} min={1} />
                    <InputWithUnit label="Height" unit="cm"  required value={height} onChange={e => setHeight(e.target.value)} min={1} />
                </div>
            </div>

            {/* ── Body Fat ── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <SectionLabel>
                        Body Fat{formula === "katch" && <span className="text-red-400 ml-1">*</span>}
                    </SectionLabel>
                    <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg mb-2">
                        {[{ key: "navy", label: "Measure" }, { key: "direct", label: "Direct %" }].map(m => (
                            <button
                                key={m.key}
                                onClick={() => setBfMode(m.key)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                    bfMode === m.key
                                        ? "bg-white text-gray-800 shadow-sm"
                                        : "text-gray-400 hover:text-gray-600"
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {bfMode === "direct" ? (
                    <InputWithUnit
                        unit="%"
                        value={directBf}
                        onChange={e => setDirectBf(e.target.value)}
                        placeholder="e.g. 18"
                        step="0.1"
                        min={0} max={70}
                        required={formula === "katch"}
                    />
                ) : (
                    <div className="flex flex-col gap-2">
                        {needsMeasurements && (
                            <p className="text-xs text-amber-600 font-medium">Required for Katch-McArdle</p>
                        )}
                        <div className={`grid gap-2.5 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
                            <InputWithUnit label="Neck"  unit="cm" value={neck}  onChange={e => setNeck(e.target.value)}  min={0} required={needsMeasurements} />
                            <InputWithUnit label="Waist" unit="cm" value={waist} onChange={e => setWaist(e.target.value)} min={0} required={needsMeasurements} />
                            {gender === "female" && (
                                <InputWithUnit label="Hip" unit="cm" value={hip} onChange={e => setHip(e.target.value)} min={0} required={needsMeasurements} />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Calculate ── */}
            <button className="btn-primary w-full text-sm font-semibold py-2.5" onClick={handleCalculate}>
                Calculate
            </button>

            {/* ── Results ── */}
            {result && (
                <div ref={resultsRef} className="flex flex-col gap-4 pt-4 border-t border-gray-100">

                    {/* BMR */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-[var(--border-color)]">
                        <span className="text-xs font-semibold text-gray-500">Basal Metabolic Rate (BMR)</span>
                        <span className="text-sm font-bold text-gray-800">{result.bmr.toLocaleString()} kcal</span>
                    </div>

                    {/* TDEE */}
                    <div className="flex flex-col items-center gap-1 py-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Daily Calorie Target</span>
                        <input
                            type="number"
                            value={tdee}
                            onChange={e => setTdee(e.target.value)}
                            className="text-4xl font-bold text-blue-600 bg-transparent text-center outline-none w-36"
                            min={0}
                        />
                        <span className="text-xs text-blue-400">kcal / day · tap to adjust</span>
                    </div>

                    {/* Macros */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <SectionLabel>Macro Split</SectionLabel>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                totalPct === 100 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                            }`}>
                                {totalPct}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-3">
                            {macroConfig.map(({ key, label, bar, text, g }) => (
                                <div key={key} className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold w-12 shrink-0 ${text}`}>{label}</span>
                                    <div className="flex items-center rounded-lg border border-[var(--border-color)] bg-[#FAFAFA] overflow-hidden focus-within:border-[var(--accent)] transition shrink-0">
                                        <input
                                            type="number"
                                            className="w-12 px-2 py-1.5 bg-transparent outline-none text-sm text-center text-gray-800"
                                            value={macros[key]}
                                            onChange={e => handleMacroPct(key, e.target.value)}
                                            min={0} max={100}
                                        />
                                        <span className="pr-2 text-xs text-gray-400">%</span>
                                    </div>
                                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${macros[key]}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 w-10 text-right shrink-0">{g}g</span>
                                </div>
                            ))}
                        </div>
                        {totalPct !== 100 && (
                            <p className="text-xs text-red-500 mt-2">Macros must add up to 100%</p>
                        )}
                    </div>

                    {/* Body Fat Result */}
                    {result.bodyFat !== null && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-[var(--border-color)]">
                                <span className="text-xs font-semibold text-gray-500">Estimated Body Fat</span>
                                <span className="text-sm font-bold text-gray-800">{result.bodyFat}%</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {bfCategories.map(({ label, range }) => {
                                    const bf = result.bodyFat;
                                    const isHighlighted = (() => {
                                        if (label === "Obese")         return gender === "male" ? bf >= 25 : bf >= 32;
                                        if (label === "Average")       return gender === "male" ? bf >= 18 && bf < 25 : bf >= 25 && bf < 32;
                                        if (label === "Fitness")       return gender === "male" ? bf >= 14 && bf < 18 : bf >= 21 && bf < 25;
                                        if (label === "Athletes")      return gender === "male" ? bf >= 6  && bf < 14 : bf >= 14 && bf < 21;
                                        if (label === "Essential Fat") return gender === "male" ? bf < 6              : bf < 14;
                                        return false;
                                    })();
                                    return (
                                        <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${isHighlighted ? "bg-amber-50 border border-amber-200" : ""}`}>
                                            <span className={`text-xs font-medium ${isHighlighted ? "text-amber-600" : "text-gray-400"}`}>
                                                {isHighlighted && "▶ "}{label}
                                            </span>
                                            <span className={`text-xs font-semibold ${isHighlighted ? "text-amber-600" : "text-gray-400"}`}>
                                                {range}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Apply */}
                    <button
                        className="btn-primary w-full text-sm font-semibold py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleApply}
                        disabled={totalPct !== 100 || !tdee}
                    >
                        Apply to Cycle Goals
                    </button>
                </div>
            )}
        </div>
    );
}