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
        <div className="p-8">
            <h1 className="text-3xl font-bold">Coach Login</h1>
            <form onSubmit={handleSubmit}>
                <input type="email" placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                name="email"></input>
                
                <input type="password" placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                name="password"></input>

                <button type="submit">Login</button>
            </form>
        </div>
    );
}
