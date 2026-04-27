'use client';
import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/login', formData)
            router.push('/dashboard');
        } catch (err) {
            console.log(err);
        }
     
    }

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    }
    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Coach Login</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    name="email"
                    className="input-field"></input>
                    
                    <input type="password" placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    name="password"
                    className="input-field"></input>

                    <button type="submit" className="btn-primary">Login</button>

                    <p className="auth-link">
                        Don't have an account?
                        <a href="/register"> Register here</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
