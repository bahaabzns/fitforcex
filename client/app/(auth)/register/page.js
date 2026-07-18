'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { redirectToDashboard, redirectToWorkspace } from "@/lib/coachSlug";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Autocomplete } from "@heroui/react/autocomplete";
import { EmptyState } from "@heroui/react/empty-state";
import { SearchField } from "@heroui/react/search-field";
import { ListBox } from "@heroui/react/list-box";
import { useFilter } from "@heroui/react/rac";
import { ChevronsUpDown } from 'lucide-react';
import { usePageTitle } from "@/hooks/usePageTitle";

const COUNTRY_CODES = [
    { code: "+93", name: "Afghanistan" }, { code: "+355", name: "Albania" }, { code: "+213", name: "Algeria" },
    { code: "+376", name: "Andorra" }, { code: "+244", name: "Angola" }, { code: "+54", name: "Argentina" },
    { code: "+374", name: "Armenia" }, { code: "+61", name: "Australia" }, { code: "+43", name: "Austria" },
    { code: "+994", name: "Azerbaijan" }, { code: "+973", name: "Bahrain" }, { code: "+880", name: "Bangladesh" },
    { code: "+375", name: "Belarus" }, { code: "+32", name: "Belgium" }, { code: "+55", name: "Brazil" },
    { code: "+1", name: "Canada / USA" }, { code: "+86", name: "China" }, { code: "+57", name: "Colombia" },
    { code: "+385", name: "Croatia" }, { code: "+357", name: "Cyprus" }, { code: "+420", name: "Czech Republic" },
    { code: "+45", name: "Denmark" }, { code: "+20", name: "Egypt" }, { code: "+358", name: "Finland" },
    { code: "+33", name: "France" }, { code: "+995", name: "Georgia" }, { code: "+49", name: "Germany" },
    { code: "+233", name: "Ghana" }, { code: "+30", name: "Greece" }, { code: "+36", name: "Hungary" },
    { code: "+354", name: "Iceland" }, { code: "+91", name: "India" }, { code: "+62", name: "Indonesia" },
    { code: "+98", name: "Iran" }, { code: "+964", name: "Iraq" }, { code: "+353", name: "Ireland" },
    { code: "+972", name: "Israel" }, { code: "+39", name: "Italy" }, { code: "+81", name: "Japan" },
    { code: "+962", name: "Jordan" }, { code: "+7", name: "Kazakhstan / Russia" }, { code: "+254", name: "Kenya" },
    { code: "+965", name: "Kuwait" }, { code: "+961", name: "Lebanon" }, { code: "+218", name: "Libya" },
    { code: "+60", name: "Malaysia" }, { code: "+960", name: "Maldives" }, { code: "+52", name: "Mexico" },
    { code: "+212", name: "Morocco" }, { code: "+31", name: "Netherlands" }, { code: "+64", name: "New Zealand" },
    { code: "+234", name: "Nigeria" }, { code: "+47", name: "Norway" }, { code: "+968", name: "Oman" },
    { code: "+92", name: "Pakistan" }, { code: "+970", name: "Palestine" }, { code: "+507", name: "Panama" },
    { code: "+63", name: "Philippines" }, { code: "+48", name: "Poland" }, { code: "+351", name: "Portugal" },
    { code: "+974", name: "Qatar" }, { code: "+40", name: "Romania" }, { code: "+250", name: "Rwanda" },
    { code: "+966", name: "Saudi Arabia" }, { code: "+221", name: "Senegal" }, { code: "+381", name: "Serbia" },
    { code: "+65", name: "Singapore" }, { code: "+27", name: "South Africa" }, { code: "+82", name: "South Korea" },
    { code: "+34", name: "Spain" }, { code: "+94", name: "Sri Lanka" }, { code: "+249", name: "Sudan" },
    { code: "+46", name: "Sweden" }, { code: "+41", name: "Switzerland" }, { code: "+963", name: "Syria" },
    { code: "+886", name: "Taiwan" }, { code: "+255", name: "Tanzania" }, { code: "+66", name: "Thailand" },
    { code: "+216", name: "Tunisia" }, { code: "+90", name: "Turkey" }, { code: "+256", name: "Uganda" },
    { code: "+380", name: "Ukraine" }, { code: "+971", name: "United Arab Emirates" }, { code: "+44", name: "United Kingdom" },
    { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

export default function RegisterPage() {
    const t = useTranslations('auth');
    const tCommon = useTranslations('common');
    usePageTitle(t('createAccount'));
    const searchParams = useSearchParams();
    const planSlug = searchParams.get('plan');
    const periodKey = searchParams.get('period');

    const [formData, setFormData] = useState({
        fname: '', lname: '', email: '', password: '',
        countryCode: '+20', phoneNumber: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const router = useRouter();
    const { contains } = useFilter({ sensitivity: "base" });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const me = await api.get('/api/auth/me');
                const slug = me.data?.currentWorkspace?.slug;
                if (slug) {
                    // Logged in → the coach app lives on the `my.` subdomain.
                    redirectToDashboard(slug);
                    return;
                }
                setCheckingAuth(false);
            } catch {
                // Not authenticated, allow registration
                setCheckingAuth(false);
            }
        };
        checkAuth();
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!formData.phoneNumber.trim()) {
            setError(t('phoneRequired'));
            return;
        }
        setLoading(true);
        const phone = `${formData.countryCode}${formData.phoneNumber.trim()}`;
        try {
            const res = await api.post('/api/auth/register', {
                fname: formData.fname,
                lname: formData.lname,
                email: formData.email,
                password: formData.password,
                phone,
                plan: planSlug,
                period: periodKey,
            });
            const slug = res.data?.workspace_slug;
            if (!slug) { router.push('/login'); return; }
            // Register now auto-logs the coach in, so go straight into the workspace
            // (on the my. subdomain). ?welcome=1 triggers the onboarding popup there —
            // a query param survives the cross-origin redirect (localStorage would not).
            // With a selected plan, land on billing to pay instead.
            const subpath = planSlug
                ? `settings/subscription?plan=${encodeURIComponent(planSlug)}`
                : 'dashboard?welcome=1';
            redirectToWorkspace(slug, subpath);
            return;
        } catch (err) {
            setError(err.response?.data?.message || t('registrationFailed'));
        } finally {
            setLoading(false);
        }
    };

    const set = (field) => (val) => setFormData(prev => ({ ...prev, [field]: val }));

    if (checkingAuth) {
        return (
            <div className="auth-wrapper">
                <div className="auth-card flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-center text-muted-foreground">{tCommon('loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">{t('createAccount')}</h1>
                {planSlug && (
                    <p className="mb-4 text-sm text-primary/70 text-center">
                        {t('selectedPlan', { plan: planSlug })}
                    </p>
                )}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-3">
                        <TextField variant="secondary" fullWidth isRequired value={formData.fname} onChange={set('fname')}>
                            <Label>{t('firstName')}</Label>
                            <Input type="text" placeholder="John" />
                        </TextField>
                        <TextField variant="secondary" fullWidth isRequired value={formData.lname} onChange={set('lname')}>
                            <Label>{t('lastName')}</Label>
                            <Input type="text" placeholder="Doe" />
                        </TextField>
                    </div>
                    <TextField variant="secondary" fullWidth isRequired value={formData.email} onChange={set('email')}>
                        <Label>{t('email')}</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    <TextField variant="secondary" fullWidth isRequired value={formData.password} onChange={set('password')}>
                        <Label>{t('password')}</Label>
                        <Input type="password" placeholder="••••••••" />
                    </TextField>

                    <div className="flex flex-col gap-1.5">
                        <Label>{t('phoneNumber')} <span className="text-destructive">*</span></Label>
                        <div className="flex gap-2">
                            <Autocomplete
                                variant="secondary"
                                value={formData.countryCode}
                                onChange={(code) => { if (code) setFormData(prev => ({ ...prev, countryCode: code })); }}
                            >
                                <Autocomplete.Trigger className="w-28">
                                    <Autocomplete.Value>
                                        {({ isPlaceholder }) => isPlaceholder ? '+?' : formData.countryCode}
                                    </Autocomplete.Value>
                                    <Autocomplete.Indicator className="size-3">
                                        <ChevronsUpDown />
                                    </Autocomplete.Indicator>
                                </Autocomplete.Trigger>
                                <Autocomplete.Popover>
                                    <Autocomplete.Filter filter={contains}>
                                        <SearchField autoFocus name="search" variant="secondary">
                                            <SearchField.Group>
                                                <SearchField.SearchIcon />
                                                <SearchField.Input placeholder={t('searchCountry')} />
                                                <SearchField.ClearButton />
                                            </SearchField.Group>
                                        </SearchField>
                                        <ListBox renderEmptyState={() => <EmptyState>{t('noResults')}</EmptyState>}>
                                            {COUNTRY_CODES.map((c) => (
                                                <ListBox.Item key={c.code} id={c.code} textValue={`${c.name} ${c.code}`}>
                                                    <span className="w-10 shrink-0 text-muted-foreground">{c.code}</span>
                                                    <span className="flex-1">{c.name}</span>
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            ))}
                                        </ListBox>
                                    </Autocomplete.Filter>
                                </Autocomplete.Popover>
                            </Autocomplete>
                            <Input
                                type="tel"
                                variant="secondary"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                placeholder="1012345678"
                                fullWidth
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? t('creatingAccount') : t('register')}
                    </Button>
                    <p className="auth-link">
                        {t('hasAccount')}{" "}
                        <a href="/login">{t('loginHere')}</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
