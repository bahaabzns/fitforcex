'use client';

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

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
    { code: "+1", name: "United States" }, { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

function CountryCodeSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
    );

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-24 px-3 py-2 rounded-md bg-background border border-input text-foreground text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring truncate transition-colors"
            >
                {value || "+?"}
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-20 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    <input
                        type="text"
                        placeholder="Search country or code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-background border-b border-border text-foreground text-xs placeholder:text-muted-foreground focus-visible:outline-none"
                        autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((c, i) => (
                            <button
                                key={`${c.code}-${i}`}
                                type="button"
                                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                                className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex justify-between ${
                                    value === c.code
                                        ? "bg-primary/10 text-primary"
                                        : "text-foreground hover:bg-default"
                                }`}
                            >
                                <span>{c.name}</span>
                                <span className="text-muted-foreground">{c.code}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-3 py-2 text-muted-foreground text-xs">No results</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RegisterPage() {
    const searchParams = useSearchParams();
    const planSlug = searchParams.get('plan');

    const [formData, setFormData] = useState({
        fname: '', lname: '', email: '', password: '',
        countryCode: '+20', phoneNumber: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const phone = formData.phoneNumber.trim()
            ? `${formData.countryCode}${formData.phoneNumber.trim()}`
            : undefined;
        try {
            const res = await api.post('/api/auth/register', {
                fname: formData.fname,
                lname: formData.lname,
                email: formData.email,
                password: formData.password,
                phone,
            });
            const slug = res.data?.workspace_slug;
            router.push(slug ? `/${slug}/settings?tab=billing` : '/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const set = (field) => (val) => setFormData(prev => ({ ...prev, [field]: val }));

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Create Account</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-3">
                        <TextField fullWidth isRequired value={formData.fname} onChange={set('fname')}>
                            <Label>First Name</Label>
                            <Input type="text" placeholder="John" />
                        </TextField>
                        <TextField fullWidth isRequired value={formData.lname} onChange={set('lname')}>
                            <Label>Last Name</Label>
                            <Input type="text" placeholder="Doe" />
                        </TextField>
                    </div>
                    <TextField fullWidth isRequired value={formData.email} onChange={set('email')}>
                        <Label>Email</Label>
                        <Input type="email" placeholder="you@example.com" />
                    </TextField>
                    <TextField fullWidth isRequired value={formData.password} onChange={set('password')}>
                        <Label>Password</Label>
                        <Input type="password" placeholder="••••••••" />
                    </TextField>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">Phone Number</label>
                        <div className="flex gap-2">
                            <CountryCodeSelect
                                value={formData.countryCode}
                                onChange={(code) => setFormData(prev => ({ ...prev, countryCode: code }))}
                            />
                            <input
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                placeholder="1012345678"
                                className={`flex-1 ${inputCls}`}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                        {loading ? 'Creating account…' : 'Register'}
                    </Button>
                    <p className="auth-link">
                        Already have an account?{" "}
                        <a href="/login">Login here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
