'use client';

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

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


    useEffect(() => {
        const fetchClients = async () => {
            try {
                const result = await api.get('/api/clients');
                setClients(result.data);
            } catch (err) {
                console.log(err);
            }
        }
        fetchClients();
    }, []);
    
    return (
        <div className="p-8">

            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Clients</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 flex-shrink-0">
                    + Add Client
                </button>
                {showForm && (
                    <form>
                        <input type="text" name="fname" value={formData.fname} placeholder="First Name" onChange={handle}></input>
                        
                    </form>
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
                                <td className="py-3 px-4">{client.fname} {client.lname}</td>
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
