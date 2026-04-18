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
        <div className="p-8">
            <h1 className="text-3xl font-bold">Coach Register</h1>
            <form onSubmit={handleSubmit}>
                <input type="text" 
                    placeholder="First Name" 
                    value={formData.fname} 
                    onChange={handleChange}
                    name="fname">
                </input>

                <input type="text"
                    placeholder="Last Name"
                    value={formData.lname}
                    onChange={handleChange}
                    name="lname">

                    </input>
                <input type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    name="email">

                </input>
                <input type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    name="password">

                </input>
                <button type="submit">Register</button>
            </form>
        </div>
    );
}
