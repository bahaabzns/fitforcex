'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function RegisterPage() {
    const [formData, setFormData] = useState({ fname: '', lname: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('/api/auth/register', formData);
            router.push('/login');
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
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" fullWidth isDisabled={loading} className="mt-2">
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
