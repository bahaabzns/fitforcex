'use client';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { Modal } from '@heroui/react/modal';
import { Button } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';
import { ScrollShadow } from '@heroui/react/scroll-shadow';

function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

function RangeInput({ label, minValue, maxValue, onMinChange, onMaxChange, unit = '' }) {
    const tCommon = useTranslations('common');
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    min="0"
                    placeholder={tCommon('min')}
                    value={minValue}
                    onChange={(e) => onMinChange(e.target.value)}
                    className="w-16 text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                    type="number"
                    min="0"
                    placeholder={tCommon('max')}
                    value={maxValue}
                    onChange={(e) => onMaxChange(e.target.value)}
                    className="w-16 text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
            </div>
        </div>
    );
}

export default function LoadPlanModal({ open, onClose, type, onLoad }) {
    const tFilter = useTranslations('filter');
    const tTraining = useTranslations('training');
    const tNutrition = useTranslations('nutrition');
    const tModal = useTranslations('modal');
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [creatorFilter, setCreatorFilter] = useState('');

    const [minDays, setMinDays] = useState('');
    const [maxDays, setMaxDays] = useState('');
    const [minExercises, setMinExercises] = useState('');
    const [maxExercises, setMaxExercises] = useState('');

    const [minCalories, setMinCalories] = useState('');
    const [maxCalories, setMaxCalories] = useState('');
    const [minProtein, setMinProtein] = useState('');
    const [maxProtein, setMaxProtein] = useState('');
    const [minCarbs, setMinCarbs] = useState('');
    const [maxCarbs, setMaxCarbs] = useState('');
    const [minFats, setMinFats] = useState('');
    const [maxFats, setMaxFats] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setLoadError(false);
        setSelectedPlanId(null);
        setSearchQuery('');
        setCreatorFilter('');
        setMinDays(''); setMaxDays(''); setMinExercises(''); setMaxExercises('');
        setMinCalories(''); setMaxCalories('');
        setMinProtein(''); setMaxProtein('');
        setMinCarbs(''); setMaxCarbs('');
        setMinFats(''); setMaxFats('');

        const route = type === 'training' ? '/api/training/plans/workspace-library' : '/api/nutrition/plans/workspace-library';
        api.get(route)
            .then((res) => setPlans(res.data ?? []))
            .catch(() => setPlans([]))
            .finally(() => setLoading(false));
    }, [open, type]);

    const creators = useMemo(() => {
        const names = [...new Set(plans.map((p) => p.creator_name ?? 'Unknown'))].sort();
        return names;
    }, [plans]);

    const filteredPlans = useMemo(() => {
        return plans.filter((plan) => {
            if (searchQuery && !plan.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (creatorFilter && (plan.creator_name ?? 'Unknown') !== creatorFilter) return false;

            if (type === 'training') {
                const days = plan.day_count ?? 0;
                const exs = plan.exercise_count ?? 0;
                if (minDays !== '' && days < Number(minDays)) return false;
                if (maxDays !== '' && days > Number(maxDays)) return false;
                if (minExercises !== '' && exs < Number(minExercises)) return false;
                if (maxExercises !== '' && exs > Number(maxExercises)) return false;
            } else {
                const cal = plan.avg_calories ?? 0;
                const pro = plan.avg_protein ?? 0;
                const carb = plan.avg_carbs ?? 0;
                const fat = plan.avg_fats ?? 0;
                if (minCalories !== '' && cal < Number(minCalories)) return false;
                if (maxCalories !== '' && cal > Number(maxCalories)) return false;
                if (minProtein !== '' && pro < Number(minProtein)) return false;
                if (maxProtein !== '' && pro > Number(maxProtein)) return false;
                if (minCarbs !== '' && carb < Number(minCarbs)) return false;
                if (maxCarbs !== '' && carb > Number(maxCarbs)) return false;
                if (minFats !== '' && fat < Number(minFats)) return false;
                if (maxFats !== '' && fat > Number(maxFats)) return false;
            }
            return true;
        });
    }, [plans, searchQuery, creatorFilter, type, minDays, maxDays, minExercises, maxExercises, minCalories, maxCalories, minProtein, maxProtein, minCarbs, maxCarbs, minFats, maxFats]);

    async function handleLoad() {
        if (!selectedPlanId) return;
        setLoadError(false);
        const success = await onLoad(selectedPlanId);
        if (success === false) {
            setLoadError(true);
            return;
        }
        onClose();
    }

    const title = type === 'training' ? 'Load Training Plan' : 'Load Nutrition Plan';

    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-3xl w-full">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4 pb-2">

                            {/* Search */}
                            <input
                                type="text"
                                placeholder={tFilter('searchPlanName')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                            />

                            {/* Filters */}
                            <div className="flex flex-wrap gap-x-5 gap-y-3 p-3 rounded-xl bg-default border border-border">
                                {type === 'training' ? (
                                    <>
                                        <RangeInput label={tTraining('daysSection')} minValue={minDays} maxValue={maxDays} onMinChange={setMinDays} onMaxChange={setMaxDays} />
                                        <RangeInput label={tTraining('exercises')} minValue={minExercises} maxValue={maxExercises} onMinChange={setMinExercises} onMaxChange={setMaxExercises} />
                                    </>
                                ) : (
                                    <>
                                        <RangeInput label={tNutrition('caloriesLabel')} minValue={minCalories} maxValue={maxCalories} onMinChange={setMinCalories} onMaxChange={setMaxCalories} unit="kcal" />
                                        <RangeInput label={tNutrition('protein')} minValue={minProtein} maxValue={maxProtein} onMinChange={setMinProtein} onMaxChange={setMaxProtein} unit="g" />
                                        <RangeInput label={tNutrition('carbs')} minValue={minCarbs} maxValue={maxCarbs} onMinChange={setMinCarbs} onMaxChange={setMaxCarbs} unit="g" />
                                        <RangeInput label={tNutrition('fat')} minValue={minFats} maxValue={maxFats} onMinChange={setMinFats} onMaxChange={setMaxFats} unit="g" />
                                    </>
                                )}

                                {creators.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{tFilter('createdBy')}</span>
                                        <select
                                            value={creatorFilter}
                                            onChange={(e) => setCreatorFilter(e.target.value)}
                                            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                                        >
                                            <option value="">{tFilter('allMembers')}</option>
                                            {creators.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Plan list */}
                            <ScrollShadow className="max-h-72" hideScrollBar>
                                {loading ? (
                                    <div className="flex flex-col gap-2">
                                        {[1, 2, 3, 4].map((i) => (
                                            <Skeleton key={i} className="h-16 rounded-xl" />
                                        ))}
                                    </div>
                                ) : filteredPlans.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                                        <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-sm text-muted-foreground">
                                            {plans.length === 0 ? 'No plans in this workspace yet.' : 'No plans match the current filters.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {filteredPlans.map((plan) => {
                                            const isSelected = String(selectedPlanId) === String(plan.id);
                                            return (
                                                <button
                                                    key={plan.id}
                                                    onClick={() => setSelectedPlanId(plan.id)}
                                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-100 ${
                                                        isSelected
                                                            ? 'bg-primary/10 border-primary/40'
                                                            : 'bg-background border-border hover:bg-default hover:border-border/60'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                                {plan.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                                {plan.client_name ?? 'Unknown client'}
                                                                {plan.creator_name ? ` · by ${plan.creator_name}` : ''}
                                                            </p>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                                                            {formatRelativeTime(plan.updated_at)}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                                                        {type === 'training' ? (
                                                            <>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {plan.day_count ?? 0} {plan.day_count === 1 ? 'day' : 'days'}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {plan.exercise_count ?? 0} {plan.exercise_count === 1 ? 'exercise' : 'exercises'}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {plan.cycle_count ?? 0} {plan.cycle_count === 1 ? 'cycle' : 'cycles'}
                                                                </span>
                                                                {plan.avg_calories != null && (
                                                                    <span className="text-[11px] text-muted-foreground">{plan.avg_calories} kcal</span>
                                                                )}
                                                                {plan.avg_protein != null && (
                                                                    <span className="text-[11px] text-muted-foreground">P: {plan.avg_protein}g</span>
                                                                )}
                                                                {plan.avg_carbs != null && (
                                                                    <span className="text-[11px] text-muted-foreground">C: {plan.avg_carbs}g</span>
                                                                )}
                                                                {plan.avg_fats != null && (
                                                                    <span className="text-[11px] text-muted-foreground">F: {plan.avg_fats}g</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollShadow>

                        </Modal.Body>
                        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                            <p className={`text-xs ${loadError ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {loadError
                                    ? 'Could not load this plan — please try again.'
                                    : !loading && `${filteredPlans.length} of ${plans.length} plans`}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onClose}>{tModal('cancel')}</Button>
                                <Button
                                    variant="primary"
                                    isDisabled={!selectedPlanId}
                                    onClick={handleLoad}
                                >
                                    Load Selected Plan
                                </Button>
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
