"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import Link from "next/link";
import { Eye, EyeOff, RefreshCw, Copy, Check } from "lucide-react";
import Modal from "@/app/components/Modal";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function ClientOverviewPage({ params }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState({ fname: "", lname: "", email: "", phone: "" });

  // password reset inside edit modal
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // info card credential reveal + copy
  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    const loadClient = async () => {
      try {
        const result = await api.get(`/api/clients/${id}`);
        setClient(result.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching client:", error);
        setLoading(false);
      }
    };
    loadClient();
  }, [id]);

  async function handleUpdate(e) {
    e.preventDefault();
    setPasswordError("");

    // validate new password if provided
    if (newPassword && newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      const updated = await api.put(`/api/clients/${id}`, formData);
      let updatedClient = { ...client, ...updated.data };

      if (newPassword) {
        await api.post(`/api/clients/${id}/set-password`, { password: newPassword });
        updatedClient = { ...updatedClient, plain_password: newPassword };
      }

      setClient(updatedClient);
      setShowEditForm(false);
      setNewPassword("");
    } catch (error) {
      console.error("Error updating client:", error);
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleDelete() {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await api.delete(`/api/clients/${id}`);
        router.push("/clients");
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  }

  const copyCredentials = () => {
    if (!client?.plain_password) return;
    const text = `Email: ${client.email}\nPassword: ${client.plain_password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {loading ? (
        <div className="p-8">Loading...</div>
      ) : !client ? (
        <div className="p-8">Client not found.</div>
      ) : (
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold flex-1">
              #{client.client_code} — {client.fname} {client.lname}
            </h1>
            <button
              onClick={() => {
                setShowEditForm(true);
                setFormData({ fname: client.fname, lname: client.lname, email: client.email, phone: client.phone || "" });
                setNewPassword("");
                setPasswordError("");
                setShowNewPassword(false);
              }}
              className="btn-primary px-4"
            >
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger px-4">
              Delete
            </button>
          </div>

          {/* Info Card */}
          <div className="card mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="card-title">Email:</span>
                <span>{client.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="card-title">Phone:</span>
                <span>{client.phone}</span>
              </div>
              <div className="flex gap-2">
                <span className="card-title">Client Code:</span>
                <span className="font-semibold" style={{ color: "var(--accent)" }}>
                  #{client.client_code}
                </span>
              </div>
              {/* Portal Password row */}
              <div className="flex items-center gap-2">
                <span className="card-title shrink-0">Portal Password:</span>
                {client.plain_password ? (
                  <>
                    <span className="font-mono text-sm">
                      {showStoredPassword ? client.plain_password : "•".repeat(client.plain_password.length)}
                    </span>
                    <button
                      onClick={() => setShowStoredPassword(v => !v)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      title={showStoredPassword ? "Hide" : "Show"}
                    >
                      {showStoredPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">Not set</span>
                )}
              </div>
              {/* Copy Credentials button */}
              {client.plain_password && (
                <div>
                  <button
                    onClick={copyCredentials}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-500 hover:border-blue-300 transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Credentials"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit Modal */}
          <Modal open={showEditForm} onClose={() => setShowEditForm(false)} title="Edit Client">
                <form onSubmit={handleUpdate} className="flex flex-col gap-3">
                  <input
                    type="text"
                    name="fname"
                    placeholder="First Name"
                    value={formData.fname}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="text"
                    name="lname"
                    placeholder="Last Name"
                    value={formData.lname}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field"
                  />

                  {/* Reset Password section */}
                  <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">
                      New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                          placeholder="New portal password"
                          className={`input-field w-full pr-10 ${passwordError ? "border-red-400" : ""}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        title="Generate password"
                        onClick={() => { setNewPassword(generatePassword()); setShowNewPassword(true); setPasswordError(""); }}
                        className="cursor-pointer p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors shrink-0"
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button type="submit" className="btn-primary flex-1">Save Changes</button>
                    <button type="button" onClick={() => setShowEditForm(false)} className="btn-danger flex-1">Cancel</button>
                  </div>
                </form>
          </Modal>
        </div>
      )}
    </>
  );
}
