'use client';

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Link from "next/link";

export default function ClientsPage() {
    const [clients, setClients] = useState([]);
    const [showForm, setShowForm] = useState(false); // toggle form visibility
    const [formData, setFormData] = useState({
        fname: '', lname: '', email: '', phone: ''
    }); // form data state

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    }

    const handleSubmit = async (e) => {
        // prevent default form submission behavior
        e.preventDefault();

        try {
            // send POST request to create new client
            await api.post('/api/clients', formData);

            // fetch updated client list
            await fetchClients();

            // reset form and hide it
            setFormData({ fname: '', lname: '', email: '', phone: '' });
            setShowForm(false);
        } catch (err) {
            console.log(err);
        }
        

    }

    const fetchClients = async () => {
            try {
                const result = await api.get('/api/clients');
                setClients(result.data);
            } catch (err) {
                console.log(err);
            }
        }


    useEffect(() => {
        fetchClients();
    }, []);
    
    return (
        <div className="p-8">

            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Clients</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 shrink-0">
                    + Add Client
                </button>
                {showForm && (
                    <div onClick={() => setShowForm(false)} className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
                        <div onClick={(e) => e.stopPropagation()} className="card p-6 w-80">
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <input type="text" name="fname" value={formData.fname} placeholder="First Name" onChange={handleChange} className="input-field"></input>
                                <input type="text" name="lname" value={formData.lname} placeholder="Last Name" onChange={handleChange} className="input-field"></input>
                                <input type="text" name="email" value={formData.email} placeholder="Email" onChange={handleChange} className="input-field"></input>
                                <input type="text" name="phone" value={formData.phone} placeholder="Phone" onChange={handleChange} className="input-field"></input>
                                <button type="submit" className="btn-primary px-4">Create</button>
                            </form>
                        </div>
                        
                    </div>
                )}
            </div>

            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="text-left py-3 px-4">Code</th>
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Email</th>
                            <th className="text-left py-3 px-4">Phone</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map((client) => (
                            <tr key={client.id}>
                                <td className="py-3 px-4">{client.client_code}</td>
                                <td className="py-3 px-4"><Link href={`/clients/${client.id}`}>{client.fname} {client.lname}</Link></td>
                                <td className="py-3 px-4">{client.email}</td>
                                <td className="py-3 px-4">{client.phone}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
