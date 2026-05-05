'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: '', password: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/login', formData);
            const me = await api.get('/api/auth/me');
            const slug = me.data?.currentWorkspace?.slug;
            router.push(slug ? `/${slug}/dashboard` : '/login');
        } catch (err) {
            console.log(err);
        }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Coach Login</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    <Button type="submit" className="w-full mt-2">Login</Button>
                    <p className="auth-link">
                        Don&apos;t have an account?{" "}
                        <a href="/register">Register here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
