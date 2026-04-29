'use client';

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { Eye, EyeOff, RefreshCw, Copy, Check, Send } from "lucide-react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";

function generatePassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const EMPTY_FORM = { fname: '', lname: '', email: '', phone: '', password: '' };

function validate(data) {
    const errors = {};
    if (!data.fname.trim()) errors.fname = 'First name is required';
    if (!data.lname.trim()) errors.lname = 'Last name is required';
    if (!data.email.trim()) {
        errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.email = 'Enter a valid email address';
    }
    if (data.phone && !/^\+?[\d\s\-().]{7,20}$/.test(data.phone)) {
        errors.phone = 'Enter a valid phone number';
    }
    if (!data.password) {
        errors.password = 'Password is required';
    } else if (data.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
    }
    return errors;
}

export default function ClientsPage() {
    const [clients, setClients] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM, password: generatePassword() });
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    // Request Form state
    const [requestModal, setRequestModal] = useState(false);
    const [requestClientId, setRequestClientId] = useState(null);
    const [activeForms, setActiveForms] = useState([]);
    const [selectedFormIds, setSelectedFormIds] = useState([]);
    const [requestSending, setRequestSending] = useState(false);
    const [requestError, setRequestError] = useState('');
    const [requestMode, setRequestMode] = useState('now');
    const [scheduledAt, setScheduledAt] = useState('');

    const copyCredentials = (client) => {
        if (!client.plain_password) return;
        const text = `Email: ${client.email}\nPassword: ${client.plain_password}`;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(client.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        const errs = validate(formData);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        try {
            await api.post('/api/clients', formData);
            await fetchClients();
            setFormData({ ...EMPTY_FORM, password: generatePassword() });
            setErrors({});
            setShowForm(false);
        } catch (err) {
            setSubmitError(err.response?.data?.error || 'Failed to create client');
        }
    };

    const handleOpen = () => {
        setFormData({ ...EMPTY_FORM, password: generatePassword() });
        setErrors({});
        setSubmitError('');
        setShowPassword(false);
        setShowForm(true);
    };

    const handleClose = () => {
        setShowForm(false);
        setErrors({});
        setSubmitError('');
    };

    const openRequestModal = async (clientId) => {
        setRequestClientId(clientId);
        setSelectedFormIds([]);
        setRequestError('');
        setRequestMode('now');
        setScheduledAt('');
        try {
            const res = await api.get('/api/forms');
            setActiveForms(res.data.filter(f => f.status === 'active'));
        } catch (e) {
            setActiveForms([]);
        }
        setRequestModal(true);
    };

    const handleSendRequests = async () => {
        if (selectedFormIds.length === 0) { setRequestError('Select at least one form'); return; }
        if (requestMode === 'schedule' && !scheduledAt) {
            setRequestError('Choose schedule date and time');
            return;
        }

        if (requestMode === 'schedule') {
            const selectedTime = new Date(scheduledAt);
            if (Number.isNaN(selectedTime.getTime()) || selectedTime.getTime() <= Date.now()) {
                setRequestError('Schedule time must be in the future');
                return;
            }
        }

        setRequestSending(true);
        setRequestError('');
        try {
            await api.post('/api/forms/requests', {
                form_ids: selectedFormIds,
                client_id: requestClientId,
                mode: requestMode,
                scheduled_at: requestMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
            });
            setRequestModal(false);
        } catch (e) {
            setRequestError(e.response?.data?.error || 'Failed to send requests');
        } finally {
            setRequestSending(false);
        }
    };

    const toggleFormSelection = (id) => {
        setSelectedFormIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const fetchClients = async () => {
        try {
            const result = await api.get('/api/clients');
            setClients(result.data);
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const clientsData = clients.map(c => ({ ...c, full_name: `${c.fname} ${c.lname}` }));
    const clientColumns = [
        { key: "client_code", label: "Code", filterType: "text", sortable: true },
        { key: "full_name", label: "Name", filterType: "text", sortable: true, render: (row) => (
            <Link href={`/clients/${row.id}`} className="text-[#007AFF] hover:underline">
                {row.fname} {row.lname}
            </Link>
        )},
        { key: "email", label: "Email", filterType: "text", sortable: true },
        { key: "phone", label: "Phone", filterType: "text" },
        { key: "actions", label: "Actions", cardPriority: "hidden", render: (row) => (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => openRequestModal(row.id)}
                    title="Request Form"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-purple-500 hover:border-purple-300 transition-colors cursor-pointer"
                >
                    <Send size={13} />
                    Request Form
                </button>
                {row.plain_password ? (
                    <button
                        onClick={() => copyCredentials(row)}
                        title="Copy credentials"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors cursor-pointer"
                    >
                        {copiedId === row.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        {copiedId === row.id ? 'Copied!' : 'Copy Credentials'}
                    </button>
                ) : (
                    <span className="text-xs text-gray-400">—</span>
                )}
            </div>
        )},
    ];

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Clients</h1>
                <button onClick={handleOpen} className="btn-primary px-4 shrink-0">
                    + Add Client
                </button>
            </div>

            {/* Create Client Modal */}
            <Modal open={showForm} onClose={handleClose} title="Add New Client">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>

                            {/* First Name */}
                            <div className="flex flex-col gap-1">
                                <input
                                    type="text"
                                    name="fname"
                                    value={formData.fname}
                                    placeholder="First Name *"
                                    onChange={handleChange}
                                    className={`input-field ${errors.fname ? 'border-red-400' : ''}`}
                                />
                                {errors.fname && <p className="text-xs text-red-500">{errors.fname}</p>}
                            </div>

                            {/* Last Name */}
                            <div className="flex flex-col gap-1">
                                <input
                                    type="text"
                                    name="lname"
                                    value={formData.lname}
                                    placeholder="Last Name *"
                                    onChange={handleChange}
                                    className={`input-field ${errors.lname ? 'border-red-400' : ''}`}
                                />
                                {errors.lname && <p className="text-xs text-red-500">{errors.lname}</p>}
                            </div>

                            {/* Email */}
                            <div className="flex flex-col gap-1">
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    placeholder="Email *"
                                    onChange={handleChange}
                                    className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                                />
                                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                            </div>

                            {/* Phone */}
                            <div className="flex flex-col gap-1">
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    placeholder="Phone"
                                    onChange={handleChange}
                                    className={`input-field ${errors.phone ? 'border-red-400' : ''}`}
                                />
                                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                            </div>

                            {/* Portal Password */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-gray-500">Portal Password *</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            placeholder="Portal password"
                                            onChange={handleChange}
                                            className={`input-field w-full pr-10 ${errors.password ? 'border-red-400' : ''}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        title="Generate new password"
                                        onClick={() => {
                                            const p = generatePassword();
                                            setFormData(prev => ({ ...prev, password: p }));
                                            setShowPassword(true);
                                            if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                                        }}
                                        className="cursor-pointer p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors shrink-0"
                                    >
                                        <RefreshCw size={15} />
                                    </button>
                                </div>
                                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                                <p className="text-xs text-gray-400">The client will use this password to log in to their portal.</p>
                            </div>

                            {submitError && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {submitError}
                                </p>
                            )}

                            <div className="flex gap-2 mt-1">
                                <button type="submit" className="btn-primary flex-1">Create</button>
                                <button type="button" onClick={handleClose} className="btn-danger flex-1">Cancel</button>
                            </div>
                        </form>
            </Modal>

            <DataTable columns={clientColumns} data={clientsData} rowKey="id" />

            {/* Request Form Modal */}
            <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Request Form from Client">
                <div className="flex flex-col gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Request Timing</p>
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setRequestMode('now')}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    requestMode === 'now'
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                Request Now
                            </button>
                            <button
                                onClick={() => setRequestMode('schedule')}
                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    requestMode === 'schedule'
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                Schedule
                            </button>
                        </div>
                        {requestMode === 'schedule' && (
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                                className="input-field"
                            />
                        )}
                    </div>

                    {activeForms.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">No active forms available. Activate a form first.</p>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                            {activeForms.map(form => (
                                <label key={form.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedFormIds.includes(form.id)}
                                        onChange={() => toggleFormSelection(form.id)}
                                        className="mt-0.5 cursor-pointer"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{form.title}</p>
                                        {form.description && <p className="text-xs text-gray-400 mt-0.5">{form.description}</p>}
                                        <p className="text-xs text-gray-400">{form.question_count} question{form.question_count !== 1 ? 's' : ''}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                    {requestError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{requestError}</p>}
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={handleSendRequests}
                            disabled={requestSending || activeForms.length === 0}
                            className="btn-primary flex-1 disabled:opacity-50"
                        >
                            {requestSending ? 'Sending...' : 'Send Request'}
                        </button>
                        <button onClick={() => setRequestModal(false)} className="btn-danger flex-1">Cancel</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
