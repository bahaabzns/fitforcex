'use client';

import { useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        fname: '',
        lname: '',
        email: '',
        password: '',
    });

    const router = useRouter();

    const handleSubmit = async (e) => {

        e.preventDefault();

        try {
            await api.post('/api/auth/register', formData);
            router.push('/login');
        } catch (err) {
            console.log(err);
        }

    }

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
    }

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h1 className="auth-title">Coach Register</h1>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <input type="text" 
                        placeholder="First Name" 
                        value={formData.fname} 
                        onChange={handleChange}
                        name="fname" 
                        className="input-field">
                    </input>

                    <input type="text"
                        placeholder="Last Name"
                        value={formData.lname}
                        onChange={handleChange}
                        name="lname"
                        className="input-field">
                    </input>

                    <input type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        name="email"
                        className="input-field">
                    </input>

                    <input type="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        name="password"
                        className="input-field">
                    </input>

                    <button type="submit" className="btn-primary">Register</button>

                    <p className="auth-link">
                        Already have an account? 
                        <a href="/login"> Login here</a>  
                    </p>
                </form>
            </div>
            
        </div>
    );
}
