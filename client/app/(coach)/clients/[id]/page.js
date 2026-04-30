"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Eye, EyeOff, RefreshCw, Copy, Check } from "lucide-react";
import Modal from "@/app/components/Modal";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function ClientOverviewPage() {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState({ fname: "", lname: "", email: "", phone: "" });

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    api.get(`/api/clients/${id}`)
      .then(res => setClient(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleUpdate(e) {
    e.preventDefault();
    setPasswordError("");
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
        <div className="p-8 flex flex-col gap-4">
          {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-[#F0F0F5] animate-pulse" />)}
        </div>
      ) : !client ? (
        <div className="p-8 text-[#86868B]">Client not found.</div>
      ) : (
        <div className="p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-[#1D1D1F] flex-1">
              #{client.code ?? client.client_code} — {client.fname} {client.lname}
            </h1>
            <button
              onClick={() => {
                setShowEditForm(true);
                setFormData({ fname: client.fname, lname: client.lname, email: client.email, phone: client.phone || "" });
                setNewPassword("");
                setPasswordError("");
                setShowNewPassword(false);
              }}
              className="bg-[#007AFF] hover:bg-[#0056CC] text-white font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer text-sm"
            >
              Delete
            </button>
          </div>

          {/* Info Card */}
          <div className="card">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="text-sm text-[#86868B] font-medium w-32 shrink-0">Email</span>
                <span className="text-sm text-[#1D1D1F]">{client.email || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-[#86868B] font-medium w-32 shrink-0">Phone</span>
                <span className="text-sm text-[#1D1D1F]">{client.phone || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-[#86868B] font-medium w-32 shrink-0">Client Code</span>
                <span className="text-sm font-semibold text-[#007AFF]">#{client.code ?? client.client_code}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-[#86868B] font-medium w-32 shrink-0">Package</span>
                <span className="text-sm text-[#1D1D1F]">{client.current_package || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#86868B] font-medium w-32 shrink-0">Portal Password</span>
                {client.plain_password ? (
                  <>
                    <span className="font-mono text-sm text-[#1D1D1F]">
                      {showStoredPassword ? client.plain_password : "•".repeat(client.plain_password.length)}
                    </span>
                    <button
                      onClick={() => setShowStoredPassword(v => !v)}
                      className="text-[#86868B] hover:text-[#1D1D1F] cursor-pointer transition-colors"
                    >
                      {showStoredPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-[#86868B]">Not set</span>
                )}
              </div>
              {client.plain_password && (
                <div>
                  <button
                    onClick={copyCredentials}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#D2D2D7] text-[#86868B] hover:text-[#007AFF] hover:border-[#007AFF] transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-[#34C759]" /> : <Copy size={14} />}
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
                onChange={e => setFormData({ ...formData, fname: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />
              <input
                type="text"
                name="lname"
                placeholder="Last Name"
                value={formData.lname}
                onChange={e => setFormData({ ...formData, lname: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
              />

              <div className="border-t border-[#D2D2D7] pt-3 mt-1 flex flex-col gap-1">
                <label className="text-xs font-medium text-[#86868B]">
                  New Password <span className="font-normal">(leave blank to keep current)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                      placeholder="New portal password"
                      className={`w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border text-[#1D1D1F] placeholder-[#86868B] text-sm focus:outline-none focus:bg-white transition-colors pr-10 ${passwordError ? "border-[#FF3B30]" : "border-[#D2D2D7] focus:border-[#007AFF]"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNewPassword(generatePassword()); setShowNewPassword(true); setPasswordError(""); }}
                    className="cursor-pointer p-2 rounded-xl border border-[#D2D2D7] text-[#86868B] hover:text-[#007AFF] hover:border-[#007AFF] transition-colors shrink-0"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                {passwordError && <p className="text-xs text-[#FF3B30]">{passwordError}</p>}
              </div>

              <div className="flex gap-2 mt-1">
                <button type="submit" className="bg-[#007AFF] hover:bg-[#0056CC] text-white font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer flex-1 text-sm">
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer flex-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </>
  );
}
