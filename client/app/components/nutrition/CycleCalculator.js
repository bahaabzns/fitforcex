"use client";
import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { ProgressBar } from "@heroui/react/progress-bar";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { InputGroup } from "@heroui/react/input-group";
import Typography from "@/app/components/Typography";

const ACTIVITY_LEVEL_VALUES = [1.2, 1.375, 1.55, 1.725, 1.9];

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
        <Typography type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wider mb-2">
            {children}
        </Typography>
    );
}

function InputWithUnit({ label, unit, value, onChange, placeholder, step, min, max, required }) {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className="text-xs font-medium text-muted-foreground">
                    {label}{required && <span className="text-destructive ml-0.5">*</span>}
                </label>
            )}
            <InputGroup variant="secondary">
                <InputGroup.Input
                    type="number"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    step={step}
                    min={min}
                    max={max}
                />
                {unit && <InputGroup.Suffix>{unit}</InputGroup.Suffix>}
            </InputGroup>
        </div>
    );
}

export default function CycleCalculator({ cycle, onApply }) {
    const t = useTranslations("nutrition");

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

    const formulaOptions = [
        { value: "mifflin", label: t("calcFormulaMifflin"), sub: t("calcFormulaMifflinSub") },
        { value: "harris",  label: t("calcFormulaHarris"),  sub: t("calcFormulaHarrisSub") },
        { value: "katch",   label: t("calcFormulaKatch"),   sub: t("calcFormulaKatchSub") },
    ];

    const activityOptions = [
        { value: 1.2,   label: t("calcActivitySedentary"),  sub: t("calcActivitySedentarySub") },
        { value: 1.375, label: t("calcActivityLight"),       sub: t("calcActivityLightSub") },
        { value: 1.55,  label: t("calcActivityModerate"),    sub: t("calcActivityModerateSub") },
        { value: 1.725, label: t("calcActivityActive"),      sub: t("calcActivityActiveSub") },
        { value: 1.9,   label: t("calcActivityVeryActive"),  sub: t("calcActivityVeryActiveSub") },
    ];

    const bfModeOptions = [
        { key: "navy",   label: t("calcBfMeasure") },
        { key: "direct", label: t("calcBfDirect") },
    ];

    const BF_LABEL_MAP = {
        "Essential Fat": t("bfEssentialFat"),
        "Athletes":      t("bfAthletes"),
        "Fitness":       t("bfFitness"),
        "Average":       t("bfAverage"),
        "Obese":         t("bfObese"),
    };

    const macroConfig = [
        { key: "protein", label: t("protein"), bar: "bg-blue-400",  text: "text-primary",  g: proteinG },
        { key: "carbs",   label: t("carbs"),   bar: "bg-amber-400", text: "text-amber-500", g: carbsG   },
        { key: "fats",    label: t("fat"),     bar: "bg-pink-400",  text: "text-pink-500",  g: fatsG    },
    ];

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

    return (
        <div ref={scrollContainerRef} className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0 pr-0.5">

            {/* ── Formula ── */}
            <div>
                <SectionLabel>{t("calcBmrFormula")}</SectionLabel>
                <div className="flex flex-row gap-1.5">
                    {formulaOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setFormula(opt.value)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                formula === opt.value
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-border bg-secondary"
                            }`}
                        >
                            <p className={`text-sm font-medium ${formula === opt.value ? "text-primary" : "text-foreground"}`}>
                                {opt.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Gender ── */}
            <div>
                <SectionLabel>{t("calcGender")}</SectionLabel>
                <div className="flex gap-1 p-1 bg-secondary rounded-lg">
                    {["male", "female"].map(g => (
                        <button
                            key={g}
                            onClick={() => setGender(g)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                gender === g
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {g === "male" ? t("calcMale") : t("calcFemale")}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Activity Level ── */}
            <div>
                <SectionLabel>{t("calcActivityLevel")}</SectionLabel>
                <div className="flex flex-col gap-1">
                    {activityOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setActivity(opt.value)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                                activity === opt.value
                                    ? "border-primary bg-primary/10"
                                    : "border-transparent hover:border-border hover:bg-default"
                            }`}
                        >
                            <span className={`text-sm font-medium ${activity === opt.value ? "text-primary" : "text-foreground"}`}>
                                {opt.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{opt.sub}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body Metrics ── */}
            <div>
                <SectionLabel>{t("calcBodyMetrics")}</SectionLabel>
                <div className="grid grid-cols-3 gap-2.5">
                    <InputWithUnit label={t("calcAge")}    unit="yrs" required value={age}    onChange={e => setAge(e.target.value)}    min={1} max={120} />
                    <InputWithUnit label={t("calcWeight")} unit="kg"  required value={weight} onChange={e => setWeight(e.target.value)} min={1} />
                    <InputWithUnit label={t("calcHeight")} unit="cm"  required value={height} onChange={e => setHeight(e.target.value)} min={1} />
                </div>
            </div>

            {/* ── Body Fat ── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <SectionLabel>
                        {t("calcBodyFat")}{formula === "katch" && <span className="text-destructive ml-1">*</span>}
                    </SectionLabel>
                    <div className="flex gap-1 p-0.5 bg-secondary rounded-lg mb-2">
                        {bfModeOptions.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setBfMode(m.key)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                    bfMode === m.key
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
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
                            <p className="text-xs text-amber-600 font-medium">{t("calcBfKatchRequired")}</p>
                        )}
                        <div className={`grid gap-2.5 ${gender === "female" ? "grid-cols-3" : "grid-cols-2"}`}>
                            <InputWithUnit label={t("calcNeck")}  unit="cm" value={neck}  onChange={e => setNeck(e.target.value)}  min={0} required={needsMeasurements} />
                            <InputWithUnit label={t("calcWaist")} unit="cm" value={waist} onChange={e => setWaist(e.target.value)} min={0} required={needsMeasurements} />
                            {gender === "female" && (
                                <InputWithUnit label={t("calcHip")} unit="cm" value={hip} onChange={e => setHip(e.target.value)} min={0} required={needsMeasurements} />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Calculate ── */}
            <Button variant="primary" fullWidth onClick={handleCalculate}>
                {t("calcButtonCalculate")}
            </Button>

            {/* ── Results ── */}
            {result && (
                <div ref={resultsRef} className="flex flex-col gap-4 pt-4 border-t border-border">

                    {/* BMR */}
                    <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-lg border border-border">
                        <span className="text-xs font-semibold text-muted-foreground">{t("calcBmrLabel")}</span>
                        <span className="text-sm font-bold text-foreground">{result.bmr.toLocaleString()} kcal</span>
                    </div>

                    {/* TDEE */}
                    <div className="flex flex-col items-center gap-1 py-4 bg-primary/10 rounded-lg border border-primary/20">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">{t("calcDailyCalTarget")}</span>
                        <TextField value={String(tdee)} onChange={setTdee} aria-label={t("calcDailyCalTarget")} className="w-36">
                            <Input type="number" min={0} className="text-4xl sm:text-4xl font-bold text-primary text-center bg-transparent border-0 shadow-none px-0 h-auto py-0" />
                        </TextField>
                        <span className="text-xs text-primary/70">{t("calcKcalPerDay")}</span>
                    </div>

                    {/* Macros */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <SectionLabel>{t("calcMacroSplit")}</SectionLabel>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                totalPct === 100 ? "bg-green-500/15 text-green-700" : "bg-destructive/10 text-destructive"
                            }`}>
                                {totalPct}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-3">
                            {macroConfig.map(({ key, label, bar, text, g }) => (
                                <div key={key} className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold w-12 shrink-0 ${text}`}>{label}</span>
                                    <InputGroup variant="secondary" className="w-24 shrink-0">
                                        <InputGroup.Input
                                            type="number"
                                            className="text-center"
                                            value={macros[key]}
                                            onChange={e => handleMacroPct(key, e.target.value)}
                                            min={0} max={100}
                                        />
                                        <InputGroup.Suffix>%</InputGroup.Suffix>
                                    </InputGroup>
                                    <ProgressBar value={macros[key]} className="flex-1">
                                        <ProgressBar.Track className="h-1.5">
                                            <ProgressBar.Fill className={bar} />
                                        </ProgressBar.Track>
                                    </ProgressBar>
                                    <span className="text-xs font-semibold text-foreground w-10 text-right shrink-0">{g}g</span>
                                </div>
                            ))}
                        </div>
                        {totalPct !== 100 && (
                            <p className="text-xs text-destructive mt-2">{t("calcMacrosMustAdd")}</p>
                        )}
                    </div>

                    {/* Body Fat Result */}
                    {result.bodyFat !== null && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-lg border border-border">
                                <span className="text-xs font-semibold text-muted-foreground">{t("calcEstimatedBodyFat")}</span>
                                <span className="text-sm font-bold text-foreground">{result.bodyFat}%</span>
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
                                        <div key={label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${isHighlighted ? "bg-amber-500/10 border border-amber-500/20" : ""}`}>
                                            <span className={`text-xs font-medium ${isHighlighted ? "text-amber-600" : "text-muted-foreground"}`}>
                                                {isHighlighted && "▶ "}{BF_LABEL_MAP[label]}
                                            </span>
                                            <span className={`text-xs font-semibold ${isHighlighted ? "text-amber-600" : "text-muted-foreground"}`}>
                                                {range}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Apply */}
                    <Button variant="primary" fullWidth isDisabled={totalPct !== 100 || !tdee} onClick={handleApply}>
                        {t("calcApplyCycle")}
                    </Button>
                </div>
            )}
        </div>
    );
}
