'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
    const [formData, setFormData] = useState({ fname: '', lname: '', email: '', password: '' });
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/register', formData);
            router.push('/login');
        } catch (err) {
            console.log(err);
        }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Coach Register</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fname">First Name</Label>
                            <Input id="fname" type="text" name="fname" placeholder="John" value={formData.fname} onChange={handleChange} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="lname">Last Name</Label>
                            <Input id="lname" type="text" name="lname" placeholder="Doe" value={formData.lname} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />
                    </div>
                    <Button type="submit" className="w-full mt-2">Register</Button>
                    <p className="auth-link">
                        Already have an account?{" "}
                        <a href="/login">Login here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
