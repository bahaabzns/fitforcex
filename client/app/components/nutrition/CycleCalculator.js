"use client";
import { useState } from "react";

const ACTIVITY_LEVELS = [
    { value: 1.2,   label: "Sedentary (little or no exercise)" },
    { value: 1.375, label: "Light (1-3 days/week)" },
    { value: 1.55,  label: "Moderate (3-5 days/week)" },
    { value: 1.725, label: "Active (6-7 days/week)" },
    { value: 1.9,   label: "Very Active (hard exercise, physical job)" },
];

const BF_CATEGORIES_MALE = [
    { label: "Essential Fat", range: "2–5%" },
    { label: "Athletes",      range: "6–13%" },
    { label: "Fitness",       range: "14–17%" },
    { label: "Average",       range: "18–24%" },
    { label: "Obese",         range: "25%+" },
];

const BF_CATEGORIES_FEMALE = [
    { label: "Essential Fat", range: "10–13%" },
    { label: "Athletes",      range: "14–20%" },
    { label: "Fitness",       range: "21–24%" },
    { label: "Average",       range: "25–31%" },
    { label: "Obese",         range: "32%+" },
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

export default function CycleCalculator({ cycle, onApply }) {
    const [formula, setFormula]       = useState("mifflin");
    const [gender, setGender]         = useState("male");
    const [activity, setActivity]     = useState(1.2);
    const [age, setAge]               = useState("25");
    const [weight, setWeight]         = useState("70");
    const [height, setHeight]         = useState("175");
    const [neck, setNeck]             = useState("38");
    const [waist, setWaist]           = useState("80");
    const [hip, setHip]               = useState("95");
    const [bfMode, setBfMode]         = useState("navy"); // "direct" | "navy"
    const [directBf, setDirectBf]     = useState("");
    const [result, setResult]         = useState(null);
    const [tdee, setTdee]             = useState("");
    const [macros, setMacros]         = useState({ protein: 30, carbs: 40, fats: 30 });

    const needsMeasurements = formula === "katch" && bfMode === "navy";

    const totalPct = macros.protein + macros.carbs + macros.fats;

    const gramsFrom = (pct, kcalPerGram) =>
        tdee ? Math.round((Number(tdee) * pct) / 100 / kcalPerGram) : 0;

    const proteinG = gramsFrom(macros.protein, 4);
    const carbsG   = gramsFrom(macros.carbs, 4);
    const fatsG    = gramsFrom(macros.fats, 9);

    const handleCalculate = () => {
        const a = Number(age), w = Number(weight), h = Number(height);
        if (!a || !w || !h) return;

        let bmr;
        let bf = null;

        if (formula === "katch") {
            if (bfMode === "direct") {
                const bfVal = Number(directBf);
                if (!directBf || isNaN(bfVal) || bfVal <= 0) return;
                const lbm = w * (1 - bfVal / 100);
                bmr = 370 + 21.6 * lbm;
                bf = bfVal;
            } else {
                const n = Number(neck), wa = Number(waist), hi = Number(hip);
                if (!n || !wa) return;
                if (gender === "female" && !hi) return;
                bmr = calcBMR(formula, gender, { age: a, weight: w, height: h, neck: n, waist: wa, hip: hi });
                bf = calcNavyBodyFat(gender, { neck: n, waist: wa, hip: hi, height: h });
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

        if (bmr === null || bmr === undefined) return;

        const bmrRounded = Math.round(bmr);
        const tdeeVal = Math.round(bmr * Number(activity));
        setResult({ bmr: bmrRounded, bodyFat: bf });
        setTdee(String(tdeeVal));
    };

    const handleMacroPct = (key, val) => {
        const num = Math.max(0, Math.min(100, Number(val)));
        setMacros(prev => ({ ...prev, [key]: num }));
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

    return (
        <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 pr-1 p-1">

            {/* Formula */}
            <div>
                <label className="block text-xs text-gray-500 mb-1">BMR Formula <span className="text-red-500">*</span></label>
                <select className="input-field w-full" value={formula} onChange={e => setFormula(e.target.value)}>
                    <option value="mifflin">Mifflin-St Jeor</option>
                    <option value="harris">Revised Harris-Benedict</option>
                    <option value="katch">Katch-McArdle</option>
                </select>
                {formula === "katch" && (
                    <p className="text-xs text-amber-600 mt-1">
                        Katch-McArdle requires body fat %
                        {bfMode === "navy"
                            ? ` — estimated from measurements (neck, waist${gender === "female" ? ", hip" : ""})`
                            : " — enter it directly in the Body Fat section below"}.
                    </p>
                )}
            </div>

            {/* Gender */}
            <div>
                <label className="block text-xs text-gray-500 mb-1">Gender <span className="text-red-500">*</span></label>
                <div className="flex gap-4">
                    {["male", "female"].map(g => (
                        <label key={g} className="flex items-center gap-2 cursor-pointer capitalize">
                            <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} />
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                        </label>
                    ))}
                </div>
            </div>

            {/* Activity */}
            <div>
                <label className="block text-xs text-gray-500 mb-1">Activity Level</label>
                <select className="input-field w-full" value={activity} onChange={e => setActivity(Number(e.target.value))}>
                    {ACTIVITY_LEVELS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                </select>
            </div>

            {/* Age / Weight / Height */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Age", val: age, set: setAge },
                    { label: "Weight (kg)", val: weight, set: setWeight },
                    { label: "Height (cm)", val: height, set: setHeight },
                ].map(({ label, val, set }) => (
                    <div key={label}>
                        <label className="block text-xs text-gray-500 mb-1">{label} <span className="text-red-500">*</span></label>
                        <input type="number" className="input-field w-full" value={val} onChange={e => set(e.target.value)} min={0} />
                    </div>
                ))}
            </div>

            {/* Body Fat */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                        Body Fat %{formula === "katch" && <span className="text-red-500 ml-1">*</span>}
                    </span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                        <button
                            className={`cursor-pointer px-3 py-1 transition-colors ${
                                bfMode === "direct" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                            onClick={() => setBfMode("direct")}
                        >
                            Direct %
                        </button>
                        <button
                            className={`cursor-pointer px-3 py-1 border-l border-gray-200 transition-colors ${
                                bfMode === "navy" ? "bg-blue-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                            onClick={() => setBfMode("navy")}
                        >
                            Measure
                        </button>
                    </div>
                </div>
                {bfMode === "direct" ? (
                    <div>
                        {/* <label className="block text-xs text-gray-500 mb-1">
                            Body Fat %{formula === "katch" && <span className="text-red-500"> *</span>}
                        </label> */}
                        <input
                            type="number" step="0.1"
                            className="input-field w-full"
                            value={directBf}
                            onChange={e => setDirectBf(e.target.value)}
                            min={0} max={70}
                            placeholder="e.g. 18"
                        />
                    </div>
                ) : (
                    <div>
                        <p className={`text-xs mb-2 ${needsMeasurements ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            {needsMeasurements ? "Required for Katch-McArdle" : "Optional — used for body fat estimate"}
                        </p>
                        <div className={`grid gap-3 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
                            {[
                                { label: "Neck (cm)", val: neck, set: setNeck },
                                { label: "Waist (cm)", val: waist, set: setWaist },
                                ...(gender === "female" ? [{ label: "Hip (cm)", val: hip, set: setHip }] : []),
                            ].map(({ label, val, set }) => (
                                <div key={label}>
                                    <label className="block text-xs text-gray-500 mb-1">
                                        {label}{needsMeasurements && <span className="text-red-500"> *</span>}
                                    </label>
                                    <input type="number" className="input-field w-full" value={val} onChange={e => set(e.target.value)} min={0} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Calculate */}
            <button className="btn btn-primary w-full" onClick={handleCalculate}>
                Calculate
            </button>

            {/* Results */}
            {result && (
                <div className="flex flex-col gap-4 border-t pt-4">

                    {/* BMR */}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">BMR</span>
                        <span className="font-bold text-green-500">{result.bmr.toLocaleString()} cal/day</span>
                    </div>

                    {/* TDEE */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">CALORIE TARGET (TDEE)</label>
                        <input
                            type="number"
                            className="input-field w-full text-center text-lg font-bold text-green-500"
                            value={tdee}
                            onChange={e => setTdee(e.target.value)}
                            min={0}
                        />
                    </div>

                    {/* Macros */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Daily Macros</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalPct === 100 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {totalPct}%
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { key: "protein", label: "Protein", color: "text-pink-500" },
                                { key: "carbs",   label: "Carbs",   color: "text-blue-500" },
                                { key: "fats",    label: "Fats",    color: "text-teal-500" },
                            ].map(({ key, label, color }) => (
                                <div key={key} className="card px-3 py-2 bg-gray-100 flex flex-col gap-1">
                                    <span className={`text-xs font-semibold ${color}`}>{label}</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            className="input-field w-12 text-center p-1 text-sm"
                                            value={macros[key]}
                                            onChange={e => handleMacroPct(key, e.target.value)}
                                            min={0} max={100}
                                        />
                                        <span className="text-xs text-gray-500">%</span>
                                    </div>
                                    <span className="text-xs text-gray-600">
                                        {key === "protein" ? proteinG : key === "carbs" ? carbsG : fatsG} g
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body Fat */}
                    {result.bodyFat !== null && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500 uppercase tracking-wide">Estimated Body Fat</span>
                                <span className="font-bold text-pink-500">{result.bodyFat}%</span>
                            </div>
                            <table className="w-full text-xs">
                                <tbody>
                                    {bfCategories.map(({ label, range }) => {
                                        const isHighlighted = (() => {
                                            const bf = result.bodyFat;
                                            if (label === "Obese") return gender === "male" ? bf >= 25 : bf >= 32;
                                            if (label === "Average") return gender === "male" ? bf >= 18 && bf < 25 : bf >= 25 && bf < 32;
                                            if (label === "Fitness") return gender === "male" ? bf >= 14 && bf < 18 : bf >= 21 && bf < 25;
                                            if (label === "Athletes") return gender === "male" ? bf >= 6 && bf < 14 : bf >= 14 && bf < 21;
                                            if (label === "Essential Fat") return gender === "male" ? bf < 6 : bf < 14;
                                            return false;
                                        })();
                                        return (
                                            <tr key={label} className={isHighlighted ? "text-amber-500 font-semibold" : "text-gray-500"}>
                                                <td className="py-1">{label}</td>
                                                <td className="py-1 text-right">{range}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Apply */}
                    <button
                        className="btn btn-primary w-full"
                        onClick={handleApply}
                        disabled={totalPct !== 100 || !tdee}
                    >
                        Apply to Daily Goal
                    </button>
                    {totalPct !== 100 && (
                        <p className="text-xs text-red-500 text-center -mt-2">Macros must add up to 100%</p>
                    )}
                </div>
            )}
        </div>
    );
}
